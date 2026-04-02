import { mapLoan, mapLoanRequest, serializeJson } from '../../db/mappers.js'
import { prisma } from '../../db/prisma.js'
import type { RollupClient } from '../../integrations/rollup/client.js'
import { AppError } from '../../lib/errors.js'
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

const addDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

const REQUEST_PENDING = 0
const REQUEST_APPROVED = 1
const REQUEST_REJECTED = 2

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

export class LoanService {
  constructor(
    private rollupClient: RollupClient,
    private userService: UserService,
    private activityService: ActivityService,
    private scoreService: ScoreService,
  ) {}

  async listRequests(initiaAddress: string) {
    await this.userService.ensureUser(initiaAddress)
    const requests = await prisma.loanRequest.findMany({
      where: { initiaAddress },
      orderBy: { submittedAt: 'desc' },
    })

    return requests.map(mapLoanRequest)
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

    if (input.amount <= 0) {
      throw new AppError(400, 'INVALID_AMOUNT', 'Requested amount must be positive.')
    }

    const profileId = input.profileId ?? 1
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

    const collateralAmount = input.collateralAmount ?? 0
    const merchants = await this.rollupClient.listMerchants().catch(() => [])
    const activeMerchants = merchants.filter((merchant) => merchant.active)
    const merchant =
      input.merchantId != null
        ? merchants.find((entry) => entry.id === input.merchantId)
        : activeMerchants[0]

    if (input.merchantId && !merchant) {
      throw new AppError(400, 'MERCHANT_NOT_FOUND', 'The selected merchant checkout partner was not found.')
    }

    if (merchant && !merchant.active) {
      throw new AppError(400, 'MERCHANT_INACTIVE', 'The selected merchant is not accepting checkout credit right now.')
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

    let requestId = `request-${initiaAddress.slice(-6)}-${Date.now()}`
    let requestStatus: LoanRequestState['status'] = 'pending'

    if (input.txHash && this.rollupClient.canRead()) {
      await this.rollupClient.waitForTx(input.txHash)
      const onchainRequest = await this.rollupClient.findLatestMatchingRequest({
        borrowerAddress: initiaAddress,
        amount: input.amount,
        collateralAmount,
        tenorMonths: input.tenorMonths,
        profileId,
      })

      if (onchainRequest) {
        requestId = String(onchainRequest.id)
        requestStatus = REQUEST_STATUS_MAP[onchainRequest.status] ?? 'pending'
      }
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
        submittedAt: new Date(),
        status: requestStatus,
        txHash: input.txHash || this.rollupClient.previewTxHash('request'),
        assetSymbol: env.ROLLUP_NATIVE_SYMBOL,
      },
      update: {
        collateralAmount,
        merchantId: merchant?.id,
        merchantCategory: merchant?.category,
        merchantAddress: merchant?.merchantAddress,
        status: requestStatus,
        txHash: input.txHash || this.rollupClient.previewTxHash('request'),
      },
    })

    await this.activityService.push(initiaAddress, {
      kind: 'loan',
      label: merchant ? 'Checkout credit requested' : 'Loan requested',
      detail: profileQuote.requiresCollateral
        ? merchant
          ? `${input.amount.toFixed(2)} USD requested for ${merchant.category} checkout over ${input.tenorMonths} month(s) with ${collateralAmount.toFixed(2)} LEND locked.`
          : `${input.amount.toFixed(2)} USD requested for ${input.tenorMonths} month(s) with ${collateralAmount.toFixed(2)} LEND locked.`
        : merchant
          ? `${input.amount.toFixed(2)} USD requested for ${merchant.category} checkout over ${input.tenorMonths} month(s).`
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
        id: onchainLoan ? String(onchainLoan.id) : `loan-${Date.now()}`,
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
        id: `operator-${Date.now()}`,
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
        ? `${request.amount.toFixed(2)} USD approved for ${request.merchantCategory} checkout.`
        : `${request.amount.toFixed(2)} USD moved into active loan state.`,
    })

    return {
      loan: mapLoan(loan),
      request: mapLoanRequest(approved),
      txHash: broadcast.txHash,
      mode: broadcast.live ? 'live' : 'preview',
    }
  }

  async listLoans(initiaAddress: string) {
    await this.userService.ensureUser(initiaAddress)
    const loans = await prisma.loan.findMany({
      where: { initiaAddress },
      orderBy: { id: 'desc' },
    })

    return loans.map(mapLoan)
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
    await this.userService.ensureUser(initiaAddress)
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
    })

    if (!loan || loan.initiaAddress !== initiaAddress) {
      throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan was not found.')
    }

    return mapLoan(loan)
  }
}
