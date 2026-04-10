import { store } from '../../data/store.js'
import { mapLoan, mapLoanRequest, serializeJson } from '../../db/mappers.js'
import { prisma } from '../../db/prisma.js'
import type { RollupClient } from '../../integrations/rollup/client.js'
import { AppError } from '../../lib/errors.js'
import { isPrismaRecoverableStorageError } from '../../lib/prisma-errors.js'
import type {
  CreditProfileQuote,
  InstallmentState,
  LoanFeeState,
  LoanRequestState,
  LoanState,
  OnchainLoanSnapshot,
} from '../../types/domain.js'
import type { ActivityService } from '../activity/service.js'
import type { ScoreService } from '../scores/service.js'
import type { UserService } from '../users/service.js'
import { env } from '../../config/env.js'
import { createPrefixedId } from '../../lib/ids.js'
import { createViralDropApps, dedupeApps, enrichOnchainMerchant } from '../protocol/apps.js'

const addDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

const REQUEST_PENDING = 0
const REQUEST_APPROVED = 1
const REQUEST_REJECTED = 2
const REQUEST_CANCELLED = 3

const LOAN_ACTIVE = 10
const LOAN_REPAID = 11
const LOAN_DEFAULTED = 12
const COLLATERAL_NONE = 0
const COLLATERAL_LOCKED = 1
const COLLATERAL_RETURNED = 2
const COLLATERAL_LIQUIDATED = 3

const REQUEST_STATUS_MAP: Record<number, LoanRequestState['status']> = {
  [REQUEST_PENDING]: 'pending',
  [REQUEST_APPROVED]: 'approved',
  [REQUEST_REJECTED]: 'rejected',
  [REQUEST_CANCELLED]: 'cancelled',
}

const LOAN_STATUS_MAP: Record<number, LoanState['status']> = {
  [LOAN_ACTIVE]: 'active',
  [LOAN_REPAID]: 'repaid',
  [LOAN_DEFAULTED]: 'defaulted',
}

const COLLATERAL_STATUS_MAP: Record<number, LoanState['collateralStatus']> = {
  [COLLATERAL_NONE]: 'none',
  [COLLATERAL_LOCKED]: 'locked',
  [COLLATERAL_RETURNED]: 'returned',
  [COLLATERAL_LIQUIDATED]: 'liquidated',
}

const requiredCollateralFor = (amount: number, collateralRatioBps: number) =>
  Math.ceil((amount * collateralRatioBps) / 10_000)

const resolveEffectiveLimit = (scoreLimitUsd: number, profile: CreditProfileQuote) =>
  profile.requiresCollateral ? profile.maxPrincipal : Math.min(scoreLimitUsd, profile.maxPrincipal)

const buildSchedule = (principal: number, apr: number, tenorMonths: number): InstallmentState[] => {
  const total = principal * (1 + (apr / 100) * (tenorMonths / 12))
  const installmentAmount = Number((total / tenorMonths).toFixed(2))

  return Array.from({ length: tenorMonths }, (_, index) => ({
    installmentNumber: index + 1,
    amount: index === tenorMonths - 1 ? Number((total - installmentAmount * index).toFixed(2)) : installmentAmount,
    dueAt: addDays(30 * (index + 1)),
    status: index === 0 ? 'due' : 'upcoming',
  }))
}

const buildInstallmentPlanForChain = (principal: number, tenorMonths: number) => ({
  installmentAmount: Math.ceil(principal / tenorMonths),
  installmentsTotal: tenorMonths,
})

const scheduleFromOnchainLoan = (loan: OnchainLoanSnapshot): InstallmentState[] =>
  Array.from({ length: loan.installmentsTotal }, (_, index) => {
    const installmentNumber = index + 1
    const dueDate = new Date((loan.issuedAtSeconds + installmentNumber * 30 * 24 * 60 * 60) * 1000)
    const status =
      loan.status === LOAN_REPAID || installmentNumber <= loan.installmentsPaid
        ? 'paid'
        : installmentNumber === loan.installmentsPaid + 1
          ? 'due'
          : 'upcoming'

    return {
      installmentNumber,
      amount: loan.installmentAmount,
      dueAt: dueDate.toISOString(),
      status,
    }
  })

const BORROWER_MIRROR_CACHE_TTL_MS = 1_500

type BorrowerMirrorState = {
  requests: LoanRequestState[]
  loans: LoanState[]
}

export class LoanService {
  private borrowerMirrorSyncs = new Map<string, Promise<BorrowerMirrorState>>()
  private borrowerMirrorCache = new Map<
    string,
    {
      at: number
      state: BorrowerMirrorState
    }
  >()

  constructor(
    private rollupClient: RollupClient,
    private userService: UserService,
    private activityService: ActivityService,
    private scoreService: ScoreService,
  ) {}

  private getCachedBorrowerMirrors(initiaAddress: string) {
    const cached = this.borrowerMirrorCache.get(initiaAddress)
    if (!cached) return null

    if (Date.now() - cached.at > BORROWER_MIRROR_CACHE_TTL_MS) {
      this.borrowerMirrorCache.delete(initiaAddress)
      return null
    }

    return cached.state
  }

  private cacheBorrowerMirrors(initiaAddress: string, state: BorrowerMirrorState) {
    this.borrowerMirrorCache.set(initiaAddress, {
      at: Date.now(),
      state,
    })
    return state
  }

  private async syncBorrowerMirrors(initiaAddress: string) {
    const cached = this.getCachedBorrowerMirrors(initiaAddress)
    if (cached) {
      return cached
    }

    const inFlight = this.borrowerMirrorSyncs.get(initiaAddress)
    if (inFlight) {
      return inFlight
    }

    const syncPromise = this.runBorrowerMirrorSync(initiaAddress).finally(() => {
      if (this.borrowerMirrorSyncs.get(initiaAddress) === syncPromise) {
        this.borrowerMirrorSyncs.delete(initiaAddress)
      }
    })

    this.borrowerMirrorSyncs.set(initiaAddress, syncPromise)
    return syncPromise
  }

  private async runBorrowerMirrorSync(initiaAddress: string): Promise<BorrowerMirrorState> {
    await this.userService.ensureUser(initiaAddress)

    let dbRequests = []
    let dbLoans = []
    let fallbackState = this.cacheBorrowerMirrors(initiaAddress, {
      requests: Array.from(store.loanRequests.values())
        .filter((request) => request.id && true)
        .filter((request) => {
          const owner = (request as LoanRequestState & { initiaAddress?: string }).initiaAddress
          return !owner || owner === initiaAddress
        }),
      loans: Array.from(store.loans.values()).filter((loan) => {
        const owner = (loan as LoanState & { initiaAddress?: string }).initiaAddress
        return !owner || owner === initiaAddress
      }),
    })

    try {
      dbRequests = await prisma.loanRequest.findMany({
        where: { initiaAddress },
        orderBy: { submittedAt: 'desc' },
      })
      dbLoans = await prisma.loan.findMany({
        where: { initiaAddress },
        orderBy: { id: 'desc' },
      })
      fallbackState = this.cacheBorrowerMirrors(initiaAddress, {
        requests: dbRequests.map(mapLoanRequest),
        loans: dbLoans.map(mapLoan),
      })
    } catch (error) {
      if (!isPrismaRecoverableStorageError(error, ['public.LoanRequest', 'public.Loan'])) {
        throw error
      }

      return fallbackState
    }

    if (!this.rollupClient.canRead()) {
      return fallbackState
    }

    const [onchainRequests, onchainLoans] = await Promise.all([
      this.rollupClient.listBorrowerRequests(initiaAddress).catch(() => []),
      this.rollupClient.listBorrowerLoans(initiaAddress).catch(() => []),
    ])

    const requestCache = new Map(dbRequests.map((request) => [request.id, request]))
    const loanCache = new Map(dbLoans.map((loan) => [loan.id, loan]))
    const syncedRequestIds = new Set<string>()

    try {
      const syncedRequests = []

      for (const request of onchainRequests) {
        const requestId = String(request.id)
        const existing = requestCache.get(requestId)
        syncedRequestIds.add(requestId)

        syncedRequests.push(
          await prisma.loanRequest.upsert({
            where: { id: requestId },
            create: {
              id: requestId,
              initiaAddress,
              amount: request.amount,
              collateralAmount: request.collateralAmount,
              merchantId: existing?.merchantId,
              merchantCategory: existing?.merchantCategory,
              merchantAddress: existing?.merchantAddress,
              assetSymbol: existing?.assetSymbol ?? env.ROLLUP_NATIVE_SYMBOL,
              tenorMonths: request.tenorMonths,
              submittedAt: new Date(request.createdAtSeconds * 1000),
              status: REQUEST_STATUS_MAP[request.status] ?? 'pending',
              txHash: existing?.txHash,
            },
            update: {
              amount: request.amount,
              collateralAmount: request.collateralAmount,
              merchantId: existing?.merchantId,
              merchantCategory: existing?.merchantCategory,
              merchantAddress: existing?.merchantAddress,
              assetSymbol: existing?.assetSymbol ?? env.ROLLUP_NATIVE_SYMBOL,
              tenorMonths: request.tenorMonths,
              submittedAt: new Date(request.createdAtSeconds * 1000),
              status: REQUEST_STATUS_MAP[request.status] ?? 'pending',
              txHash: existing?.txHash,
            },
          }),
        )
      }

      for (const loan of onchainLoans) {
        const requestId = String(loan.requestId)
        if (syncedRequestIds.has(requestId)) continue

        const existing = requestCache.get(requestId)
        syncedRequestIds.add(requestId)

        syncedRequests.push(
          await prisma.loanRequest.upsert({
            where: { id: requestId },
            create: {
              id: requestId,
              initiaAddress,
              amount: loan.amount,
              collateralAmount: loan.collateralAmount,
              merchantId: existing?.merchantId,
              merchantCategory: existing?.merchantCategory,
              merchantAddress: existing?.merchantAddress,
              assetSymbol: existing?.assetSymbol ?? env.ROLLUP_NATIVE_SYMBOL,
              tenorMonths: loan.tenorMonths,
              submittedAt: new Date(loan.issuedAtSeconds * 1000),
              status: 'approved',
              txHash: existing?.txHash,
            },
            update: {
              amount: loan.amount,
              collateralAmount: loan.collateralAmount,
              merchantId: existing?.merchantId,
              merchantCategory: existing?.merchantCategory,
              merchantAddress: existing?.merchantAddress,
              assetSymbol: existing?.assetSymbol ?? env.ROLLUP_NATIVE_SYMBOL,
              tenorMonths: loan.tenorMonths,
              submittedAt: existing?.submittedAt ?? new Date(loan.issuedAtSeconds * 1000),
              status: 'approved',
              txHash: existing?.txHash,
            },
          }),
        )
      }

      const syncedLoans = []

      for (const loan of onchainLoans) {
        const loanId = String(loan.id)
        const existing = loanCache.get(loanId)
        const linkedRequest = requestCache.get(String(loan.requestId))

        syncedLoans.push(
          await prisma.loan.upsert({
            where: { id: loanId },
            create: {
              id: loanId,
              initiaAddress,
              requestId: String(loan.requestId),
              principal: loan.amount,
              collateralAmount: loan.collateralAmount,
              merchantId: existing?.merchantId ?? linkedRequest?.merchantId,
              merchantCategory: existing?.merchantCategory ?? linkedRequest?.merchantCategory,
              merchantAddress: existing?.merchantAddress ?? linkedRequest?.merchantAddress,
              collateralStatus: COLLATERAL_STATUS_MAP[loan.collateralState] ?? 'none',
              apr: loan.aprBps / 100,
              tenorMonths: loan.tenorMonths,
              installmentsPaid: loan.installmentsPaid,
              status: LOAN_STATUS_MAP[loan.status] ?? 'active',
              scheduleJson: serializeJson(scheduleFromOnchainLoan(loan)),
              txHashApprove: existing?.txHashApprove,
            },
            update: {
              requestId: String(loan.requestId),
              principal: loan.amount,
              collateralAmount: loan.collateralAmount,
              merchantId: existing?.merchantId ?? linkedRequest?.merchantId,
              merchantCategory: existing?.merchantCategory ?? linkedRequest?.merchantCategory,
              merchantAddress: existing?.merchantAddress ?? linkedRequest?.merchantAddress,
              collateralStatus: COLLATERAL_STATUS_MAP[loan.collateralState] ?? 'none',
              apr: loan.aprBps / 100,
              tenorMonths: loan.tenorMonths,
              installmentsPaid: loan.installmentsPaid,
              status: LOAN_STATUS_MAP[loan.status] ?? 'active',
              scheduleJson: serializeJson(scheduleFromOnchainLoan(loan)),
              txHashApprove: existing?.txHashApprove,
            },
          }),
        )
      }

      return this.cacheBorrowerMirrors(initiaAddress, {
        requests: syncedRequests
          .sort((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime())
          .map(mapLoanRequest),
        loans: syncedLoans
          .sort((left, right) => Number(right.id) - Number(left.id))
          .map(mapLoan),
      })
    } catch (error) {
      console.warn(
        `[LoanService] borrower mirror sync fallback for ${initiaAddress}:`,
        error instanceof Error ? error.message : error,
      )
      return fallbackState
    }
  }

  async listRequests(initiaAddress: string) {
    const state = await this.syncBorrowerMirrors(initiaAddress)
    return state.requests
  }

  async createRequest(
    initiaAddress: string,
    input: {
      amount: number
      collateralAmount?: number
      merchantId?: string
      tenorMonths: number
      profileId?: number
      txHash?: string
    },
  ) {
    const borrower = await this.userService.ensureUser(initiaAddress)
    const score = await this.scoreService.getLatest(initiaAddress)
    const collateralAmount = input.collateralAmount ?? 0
    const profileId = input.profileId ?? 1
    let resolvedOnchainRequest: Awaited<ReturnType<RollupClient['findLatestMatchingRequest']>> | null = null

    if (input.txHash && this.rollupClient.canRead()) {
      await this.rollupClient.waitForTx(input.txHash)
      resolvedOnchainRequest =
        (await this.rollupClient
          .findLatestMatchingRequest({
            borrowerAddress: initiaAddress,
            amount: input.amount,
            collateralAmount,
            tenorMonths: input.tenorMonths,
            profileId,
          })
          .catch(() => null)) ?? null
    }

    const borrowerState = await this.syncBorrowerMirrors(initiaAddress)
    const existingActiveLoan = borrowerState.loans.find((loan) => loan.status === 'active')
    const existingPendingRequest = borrowerState.requests.find((request) => request.status === 'pending')

    if (!resolvedOnchainRequest && existingActiveLoan) {
      throw new AppError(
        409,
        'ACTIVE_LOAN_EXISTS',
        'Finish the current active credit before requesting a new one.',
      )
    }

    if (!resolvedOnchainRequest && existingPendingRequest) {
      throw new AppError(
        409,
        'PENDING_REQUEST_EXISTS',
        'A credit request is already pending. Wait for a decision before sending another one.',
      )
    }

    if (input.amount <= 0) {
      throw new AppError(400, 'INVALID_AMOUNT', 'Requested amount must be positive.')
    }

    const profileQuote =
      (await this.rollupClient.getProfileQuote(initiaAddress, profileId).catch(() => null)) ?? null

    if (!profileQuote) {
      throw new AppError(400, 'PROFILE_UNAVAILABLE', 'The selected profile could not be loaded.')
    }

    if (!profileQuote.qualified) {
      throw new AppError(
        400,
        'PROFILE_NOT_QUALIFIED',
        'The wallet does not qualify for the selected credit profile yet.',
      )
    }

    if (input.tenorMonths > profileQuote.maxTenorMonths) {
      throw new AppError(
        400,
        'TENOR_NOT_ALLOWED',
        'Requested tenor is above the selected profile allowance.',
      )
    }

    const effectiveLimit = resolveEffectiveLimit(score.limitUsd, profileQuote)
    if (input.amount > effectiveLimit) {
      throw new AppError(400, 'LIMIT_EXCEEDED', 'Requested amount exceeds the approved limit.')
    }

    const [onchainMerchants, viralDropItems, knownAppRoutes] = await Promise.all([
      this.rollupClient.listMerchants().catch(() => []),
      this.rollupClient.listViralDropItems().catch(() => []),
      this.rollupClient.listKnownAppRoutes().catch(() => []),
    ])
    const knownRoutesByAddress = new Map(
      knownAppRoutes.map((route) => [route.merchantAddress.trim().toLowerCase(), route]),
    )
    const merchants = dedupeApps([
      ...onchainMerchants.map((merchant) =>
        enrichOnchainMerchant(
          merchant,
          knownRoutesByAddress.get(merchant.merchantAddress.trim().toLowerCase()) ?? null,
        ),
      ),
      ...createViralDropApps(viralDropItems),
    ])
    const activeMerchants = merchants.filter((merchant) => merchant.active)
    const merchant =
      input.merchantId != null
        ? merchants.find((entry) => entry.id === input.merchantId)
        : activeMerchants[0]

    if (input.merchantId && !merchant) {
      throw new AppError(400, 'APP_NOT_FOUND', 'The selected app was not found.')
    }

    if (merchant && !merchant.active) {
      throw new AppError(400, 'APP_INACTIVE', 'The selected app is not accepting credit right now.')
    }

    if (profileQuote.requiresCollateral) {
      const minimumCollateral = requiredCollateralFor(input.amount, profileQuote.collateralRatioBps)

      if (collateralAmount < minimumCollateral) {
        throw new AppError(
          400,
          'INSUFFICIENT_COLLATERAL',
          `Collateralized requests need at least ${minimumCollateral} LEND locked.`,
        )
      }

      if (collateralAmount > borrower.rewards.liquidLend) {
        throw new AppError(
          400,
          'COLLATERAL_BALANCE_LOW',
          'Liquid LEND balance is not high enough for this collateral lock.',
        )
      }
    } else if (collateralAmount > 0) {
      throw new AppError(
        400,
        'COLLATERAL_NOT_ALLOWED',
        'This profile does not accept collateral input.',
      )
    }

    let requestId = createPrefixedId(`request-${initiaAddress.slice(-6)}`)
    let requestStatus: LoanRequestState['status'] = 'pending'
    let submittedAt = new Date()

    if (resolvedOnchainRequest) {
      requestId = String(resolvedOnchainRequest.id)
      requestStatus = REQUEST_STATUS_MAP[resolvedOnchainRequest.status] ?? 'pending'
      submittedAt = new Date(resolvedOnchainRequest.createdAtSeconds * 1000)
    }

    const request = await prisma.loanRequest.upsert({
      where: { id: requestId },
      create: {
        id: requestId,
        initiaAddress,
        amount: input.amount,
        collateralAmount,
        merchantId: merchant?.id,
        merchantCategory: merchant?.category,
        merchantAddress: merchant?.merchantAddress,
        tenorMonths: input.tenorMonths,
        submittedAt,
        status: requestStatus,
        txHash: input.txHash || this.rollupClient.previewTxHash('request'),
        assetSymbol: env.ROLLUP_NATIVE_SYMBOL,
      },
      update: {
        collateralAmount,
        merchantId: merchant?.id,
        merchantCategory: merchant?.category,
        merchantAddress: merchant?.merchantAddress,
        submittedAt,
        status: requestStatus,
        txHash: input.txHash || this.rollupClient.previewTxHash('request'),
      },
    })

    await this.activityService.push(initiaAddress, {
      kind: 'loan',
      label: merchant ? 'Credit requested' : 'Loan requested',
      detail: profileQuote.requiresCollateral
        ? merchant
          ? `${input.amount.toFixed(2)} USD requested for ${merchant.name ?? merchant.category} over ${input.tenorMonths} month(s) with ${collateralAmount.toFixed(2)} LEND locked.`
          : `${input.amount.toFixed(2)} USD requested for ${input.tenorMonths} month(s) with ${collateralAmount.toFixed(2)} LEND locked.`
        : merchant
          ? `${input.amount.toFixed(2)} USD requested for ${merchant.name ?? merchant.category} over ${input.tenorMonths} month(s).`
          : `${input.amount.toFixed(2)} USD requested for ${input.tenorMonths} month(s).`,
    })

    return mapLoanRequest(request)
  }

  async approveRequest(requestId: string, operatorAddress: string, reason = 'Policy check passed') {
    const request = await prisma.loanRequest.findUnique({
      where: { id: requestId },
    })

    if (!request) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'Loan request was not found.')
    }

    if (request.status !== 'pending') {
      throw new AppError(400, 'REQUEST_NOT_PENDING', 'Only pending requests can be approved.')
    }

    const borrower = await prisma.user.findUnique({
      where: { initiaAddress: request.initiaAddress },
    })

    if (!borrower) {
      throw new AppError(404, 'BORROWER_NOT_FOUND', 'Borrower profile was not found.')
    }

    const score = await this.scoreService.getLatest(borrower.initiaAddress)
    const numericRequestId = Number.parseInt(request.id, 10)
    const plan = buildInstallmentPlanForChain(request.amount, request.tenorMonths)
    const broadcast = Number.isFinite(numericRequestId)
      ? await this.rollupClient.approveRequest({
          requestId: numericRequestId,
          aprBps: Math.round(score.apr * 100),
          installmentAmount: plan.installmentAmount,
          installmentsTotal: plan.installmentsTotal,
          gracePeriodSeconds: 7 * 24 * 60 * 60,
        })
      : {
          live: false,
          txHash: this.rollupClient.previewTxHash('approve'),
        }

    const approved = await prisma.loanRequest.update({
      where: { id: request.id },
      data: { status: 'approved' },
    })
    const onchainLoan =
      broadcast.live && Number.isFinite(numericRequestId)
        ? await this.rollupClient.findLatestLoanByRequestId(numericRequestId)
        : null

    const loan = await prisma.loan.upsert({
      where: { requestId: request.id },
      create: {
        id: onchainLoan ? String(onchainLoan.id) : createPrefixedId('loan'),
        initiaAddress: borrower.initiaAddress,
        requestId: request.id,
        principal: onchainLoan ? onchainLoan.amount : request.amount,
        collateralAmount: onchainLoan ? onchainLoan.collateralAmount : request.collateralAmount,
        merchantId: request.merchantId,
        merchantCategory: request.merchantCategory,
        merchantAddress: request.merchantAddress,
        collateralStatus: onchainLoan
          ? COLLATERAL_STATUS_MAP[onchainLoan.collateralState] ?? 'none'
          : request.collateralAmount > 0
            ? 'locked'
            : 'none',
        apr: onchainLoan ? onchainLoan.aprBps / 100 : score.apr,
        tenorMonths: onchainLoan ? onchainLoan.tenorMonths : request.tenorMonths,
        installmentsPaid: onchainLoan ? onchainLoan.installmentsPaid : 0,
        status: onchainLoan ? LOAN_STATUS_MAP[onchainLoan.status] ?? 'active' : 'active',
        scheduleJson: serializeJson(
          onchainLoan ? scheduleFromOnchainLoan(onchainLoan) : buildSchedule(request.amount, score.apr, request.tenorMonths),
        ),
        txHashApprove: broadcast.txHash,
      },
      update: {
        id: onchainLoan ? String(onchainLoan.id) : undefined,
        principal: onchainLoan ? onchainLoan.amount : request.amount,
        collateralAmount: onchainLoan ? onchainLoan.collateralAmount : request.collateralAmount,
        merchantId: request.merchantId,
        merchantCategory: request.merchantCategory,
        merchantAddress: request.merchantAddress,
        collateralStatus: onchainLoan
          ? COLLATERAL_STATUS_MAP[onchainLoan.collateralState] ?? 'none'
          : request.collateralAmount > 0
            ? 'locked'
            : 'none',
        apr: onchainLoan ? onchainLoan.aprBps / 100 : score.apr,
        tenorMonths: onchainLoan ? onchainLoan.tenorMonths : request.tenorMonths,
        installmentsPaid: onchainLoan ? onchainLoan.installmentsPaid : 0,
        status: onchainLoan ? LOAN_STATUS_MAP[onchainLoan.status] ?? 'active' : 'active',
        scheduleJson: serializeJson(
          onchainLoan ? scheduleFromOnchainLoan(onchainLoan) : buildSchedule(request.amount, score.apr, request.tenorMonths),
        ),
        txHashApprove: broadcast.txHash,
      },
    })

    await prisma.operatorAction.create({
      data: {
        id: createPrefixedId('operator'),
        actorAddress: operatorAddress,
        actionType: 'approve_request',
        targetType: 'loan_request',
        targetId: request.id,
        reason,
        txHash: broadcast.txHash,
        status: broadcast.live ? 'submitted' : 'preview',
        createdAt: new Date(),
      },
    })

    await this.activityService.push(borrower.initiaAddress, {
      kind: 'loan',
      label: 'Request approved',
      detail: request.merchantCategory
        ? `${request.amount.toFixed(2)} USD is now available to use in the selected app.`
        : `${request.amount.toFixed(2)} USD is now available to use.`,
    })
    await this.userService.rewardReferrerForFirstLoan(borrower.initiaAddress)

    return {
      loan: mapLoan(loan),
      request: mapLoanRequest(approved),
      txHash: broadcast.txHash,
      mode: broadcast.live ? 'live' : 'preview',
    }
  }

  async approveOwnPendingRequest(
    initiaAddress: string,
    requestId: string,
    reason = 'Borrower demo review',
  ) {
    if (!env.PREVIEW_APPROVAL_ENABLED) {
      throw new AppError(
        403,
        'DEMO_REVIEW_DISABLED',
        'Demo approval is disabled on this backend.',
      )
    }

    const request = await prisma.loanRequest.findUnique({
      where: { id: requestId },
    })

    if (!request) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'Loan request was not found.')
    }

    if (request.initiaAddress !== initiaAddress) {
      throw new AppError(
        403,
        'REQUEST_FORBIDDEN',
        'You can only review your own pending requests.',
      )
    }

    return this.approveRequest(requestId, 'preview-operator', reason)
  }

  async listLoans(initiaAddress: string) {
    const state = await this.syncBorrowerMirrors(initiaAddress)
    return state.loans
  }

  async getLoan(initiaAddress: string, loanId: string) {
    const loan = await this.requireLoan(initiaAddress, loanId)
    return loan
  }

  async getSchedule(initiaAddress: string, loanId: string) {
    const loan = await this.requireLoan(initiaAddress, loanId)
    return loan.schedule
  }

  async getFeeState(initiaAddress: string, loanId: string): Promise<LoanFeeState | null> {
    const loan = await this.requireLoan(initiaAddress, loanId)
    const numericLoanId = Number.parseInt(loan.id.replace(/\D/g, ''), 10)

    if (!Number.isFinite(numericLoanId)) {
      return null
    }

    return this.rollupClient.getFeeState(numericLoanId)
  }

  private async requireLoan(initiaAddress: string, loanId: string) {
    const state = await this.syncBorrowerMirrors(initiaAddress)
    const loan = state.loans.find((entry) => entry.id === loanId)

    if (!loan) {
      throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan was not found.')
    }

    return loan
  }
}
