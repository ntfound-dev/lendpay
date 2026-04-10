import { createHash, randomUUID } from 'node:crypto'
import { store } from '../../data/store.js'
import { env } from '../../config/env.js'
import { mapUserProfile } from '../../db/mappers.js'
import { prisma } from '../../db/prisma.js'
import type {
  FaucetState,
  LeaderboardEntry,
  LeaderboardState,
  LoanState,
  OnchainRewardsSnapshot,
  ReferralEntry,
  ReferralState,
  RewardTier,
  UserProfile,
  UsernameSource,
} from '../../types/domain.js'
import type { UsernameResolution, UsernamesClient } from '../../integrations/l1/usernames.js'
import type { RollupClient } from '../../integrations/rollup/client.js'
import { AppError } from '../../lib/errors.js'
import { createPrefixedId } from '../../lib/ids.js'
import { isPrismaRecoverableStorageError } from '../../lib/prisma-errors.js'

const resolveTier = (points: number): RewardTier => {
  if (points >= 10000) return 'Diamond'
  if (points >= 7000) return 'Gold'
  if (points >= 3500) return 'Silver'
  return 'Bronze'
}

const tierRank: Record<RewardTier, number> = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Diamond: 4,
}

const resolveTierFromHeldLend = (heldLend: number): RewardTier => {
  if (heldLend >= 10_000) return 'Diamond'
  if (heldLend >= 2_000) return 'Gold'
  if (heldLend >= 500) return 'Silver'
  return 'Bronze'
}

const resolveLeaderboardTier = (
  heldLend: number,
  points: number,
  storedTier?: RewardTier | null,
): RewardTier => {
  const candidates = [storedTier, resolveTierFromHeldLend(heldLend), resolveTier(points)].filter(
    Boolean,
  ) as RewardTier[]

  return candidates.sort((left, right) => tierRank[right] - tierRank[left])[0] ?? 'Bronze'
}

const buildReferralCode = (initiaAddress: string) => {
  const digest = createHash('sha256').update(initiaAddress).digest('hex').slice(0, 8).toUpperCase()
  return `LEND${digest || randomUUID().slice(0, 8).toUpperCase()}`
}

const formatUsd = (value: number) => `$${value.toFixed(0)}`

const parseScheduleLength = (scheduleJson: string) => {
  try {
    const parsed = JSON.parse(scheduleJson)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

const FAUCET_ACTION_TYPE = 'faucet_claim'
const FAUCET_TARGET_TYPE = 'wallet'

const deriveRepaidAmount = (loan: {
  principal: number
  installmentsPaid: number
  status: string
  tenorMonths: number
  scheduleJson: string
}) => {
  if (loan.status === 'repaid') {
    return loan.principal
  }

  if (loan.installmentsPaid <= 0) {
    return 0
  }

  const installmentsTotal = parseScheduleLength(loan.scheduleJson) || loan.tenorMonths || 1
  const completionRatio = Math.min(1, loan.installmentsPaid / Math.max(installmentsTotal, 1))
  return Number((loan.principal * completionRatio).toFixed(2))
}

const dedupeLeaderboardEntries = (entries: Array<Omit<LeaderboardEntry, 'rank'>>) =>
  entries.filter(
    (entry, index, self) => index === self.findIndex((candidate) => candidate.address === entry.address),
  )

const topEntries = (
  entries: Array<Omit<LeaderboardEntry, 'rank'>>,
  selfAddress: string,
): { items: LeaderboardEntry[]; myRank?: number } => {
  const ranked = dedupeLeaderboardEntries(entries).map((entry, index) => ({ ...entry, rank: index + 1 }))
  return {
    items: ranked.slice(0, 10),
    myRank: ranked.find((entry) => entry.address === selfAddress)?.rank,
  }
}

const rememberProfile = (profile: UserProfile) => {
  store.users.set(profile.initiaAddress, profile)
  return profile
}

type FaucetClaimRecord = {
  createdAt: Date
  txHash?: string
}

export class UserService {
  constructor(
    private usernamesClient: UsernamesClient,
    private rollupClient: RollupClient,
  ) {}

  private async syncL1UsernameAttestation(
    initiaAddress: string,
    l1Username: UsernameResolution,
    onchain: OnchainRewardsSnapshot | null,
  ): Promise<OnchainRewardsSnapshot | null> {
    if (!l1Username.verified || !l1Username.username || !this.rollupClient.canBroadcast()) {
      return onchain
    }

    const onchainUsername = onchain?.username?.trim()
    const verifiedOnRollup = Boolean(onchain?.usernameVerified)
    const normalizedL1Username = l1Username.username.trim()

    if (verifiedOnRollup && onchainUsername === normalizedL1Username) {
      return onchain
    }

    try {
      await this.rollupClient.attestUsername({
        userAddress: initiaAddress,
        username: normalizedL1Username,
      })

      return (await this.rollupClient.syncRewards(initiaAddress).catch(() => onchain)) ?? onchain
    } catch {
      return onchain
    }
  }

  private resolveIdentity(
    l1Username: UsernameResolution,
    onchain?: {
      username?: string
      usernameVerified?: boolean
    } | null,
  ): {
    username?: string
    usernameSource?: UsernameSource
    usernameVerified: boolean
    usernameVerifiedOnL1: boolean
    usernameAttestedOnRollup: boolean
  } {
    if (onchain?.username && onchain.usernameVerified) {
      return {
        username: onchain.username,
        usernameSource: 'rollup',
        usernameVerified: true,
        usernameVerifiedOnL1: l1Username.verified,
        usernameAttestedOnRollup: true,
      }
    }

    return {
      username: l1Username.username,
      usernameSource: l1Username.source,
      usernameVerified: l1Username.verified,
      usernameVerifiedOnL1: l1Username.verified,
      usernameAttestedOnRollup: false,
    }
  }

  private async ensureReferralCode(initiaAddress: string, currentCode?: string | null) {
    if (currentCode) {
      return currentCode
    }

    let candidate = buildReferralCode(initiaAddress)
    let suffix = 1

    while (true) {
      let existing: { initiaAddress: string } | null = null

      try {
        existing = await prisma.user.findFirst({
          where: {
            referralCode: candidate,
            NOT: { initiaAddress },
          },
          select: { initiaAddress: true },
        })
      } catch (error) {
        if (!isPrismaRecoverableStorageError(error, ['public.User'])) {
          throw error
        }

        return candidate
      }

      if (!existing) {
        return candidate
      }

      candidate = `${buildReferralCode(initiaAddress)}${suffix}`
      suffix += 1
    }
  }

  private async computeReferralStatus(refereeAddress: string): Promise<ReferralEntry['status']> {
    let loans: Array<{ status: string }> = []

    try {
      loans = await prisma.loan.findMany({
        where: { initiaAddress: refereeAddress },
        select: { status: true },
        orderBy: { id: 'desc' },
        take: 8,
      })
    } catch (error) {
      if (!isPrismaRecoverableStorageError(error, ['public.Loan'])) {
        throw error
      }

      loans = Array.from(store.loans.values())
        .filter((loan) => {
          const owner = (loan as LoanState & { initiaAddress?: string }).initiaAddress
          return owner === refereeAddress
        })
        .slice(0, 8)
        .map((loan) => ({ status: loan.status }))
    }

    if (loans.some((loan) => loan.status === 'defaulted')) {
      return 'defaulted'
    }

    if (loans.some((loan) => loan.status === 'active' || loan.status === 'repaid')) {
      return 'active'
    }

    return 'pending'
  }

  private async getLatestFaucetClaim(initiaAddress: string): Promise<FaucetClaimRecord | null> {
    try {
      const latestClaim = await prisma.operatorAction.findFirst({
        where: {
          actionType: FAUCET_ACTION_TYPE,
          targetType: FAUCET_TARGET_TYPE,
          targetId: initiaAddress,
          status: {
            in: ['submitted', 'confirmed'],
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return latestClaim
        ? {
            createdAt: latestClaim.createdAt,
            txHash: latestClaim.txHash ?? undefined,
          }
        : null
    } catch (error) {
      if (!isPrismaRecoverableStorageError(error, ['public.OperatorAction'])) {
        throw error
      }

      const latestClaim = store.operatorActions
        .filter(
          (action) =>
            action.actionType === FAUCET_ACTION_TYPE &&
            action.targetType === FAUCET_TARGET_TYPE &&
            action.targetId === initiaAddress &&
            (action.status === 'submitted' || action.status === 'confirmed'),
        )
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0]

      return latestClaim
        ? {
            createdAt: new Date(latestClaim.createdAt),
            txHash: latestClaim.txHash,
          }
        : null
    }
  }

  private async syncReferralLinkStatus(refereeAddress: string) {
    const status = await this.computeReferralStatus(refereeAddress)

    try {
      await prisma.referralLink.updateMany({
        where: { refereeAddress },
        data: { status },
      })
    } catch (error) {
      if (!isPrismaRecoverableStorageError(error, ['public.ReferralLink'])) {
        throw error
      }
    }

    return status
  }

  async ensureUser(initiaAddress: string) {
    let onchain = await this.rollupClient.syncRewards(initiaAddress).catch(() => null)
    const wallet = await this.rollupClient.getWalletSnapshot(initiaAddress).catch(() => ({
      nativeBalance: 0,
      lockedCollateralLend: 0,
    }))
    const resolvedUsername = await this.usernamesClient.resolveNameWithSource(initiaAddress)
    onchain = await this.syncL1UsernameAttestation(initiaAddress, resolvedUsername, onchain)
    const identity = this.resolveIdentity(resolvedUsername, onchain)
    const username = identity.username
    const buildStoredProfile = () => {
      const existing = store.users.get(initiaAddress)
      const now = new Date().toISOString()

      return rememberProfile({
        id: existing?.id ?? `user-${initiaAddress.slice(-8)}`,
        initiaAddress,
        username,
        usernameSource: identity.usernameSource,
        usernameVerified: identity.usernameVerified,
        usernameVerifiedOnL1: identity.usernameVerifiedOnL1,
        usernameAttestedOnRollup: identity.usernameAttestedOnRollup,
        referralCode: existing?.referralCode ?? buildReferralCode(initiaAddress),
        referredBy: existing?.referredBy,
        referralPointsEarned: existing?.referralPointsEarned ?? 0,
        wallet: {
          nativeBalance: wallet.nativeBalance,
          lockedCollateralLend: wallet.lockedCollateralLend,
        },
        rewards: {
          heldLend: onchain?.heldLend ?? existing?.rewards.heldLend ?? 0,
          liquidLend: onchain?.liquidLend ?? existing?.rewards.liquidLend ?? 0,
          stakedLend: onchain?.stakedLend ?? existing?.rewards.stakedLend ?? 0,
          claimableLend: onchain?.claimableLend ?? existing?.rewards.claimableLend ?? 0,
          claimableStakingRewards:
            onchain?.claimableStakingRewards ?? existing?.rewards.claimableStakingRewards ?? 0,
          points: onchain?.points ?? existing?.rewards.points ?? 0,
          streak: onchain?.streak ?? existing?.rewards.streak ?? 0,
          tier:
            onchain?.tier ??
            existing?.rewards.tier ??
            resolveTier(onchain?.points ?? existing?.rewards.points ?? 0),
          creditLimitBoostBps:
            onchain?.creditLimitBoostBps ?? existing?.rewards.creditLimitBoostBps ?? 0,
          interestDiscountBps:
            onchain?.interestDiscountBps ?? existing?.rewards.interestDiscountBps ?? 0,
          premiumChecksAvailable:
            onchain?.premiumChecksAvailable ?? existing?.rewards.premiumChecksAvailable ?? 0,
          badgeCount: onchain?.badgeCount ?? existing?.rewards.badgeCount ?? 0,
        },
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })
    }

    try {
      const existing = await prisma.user.findUnique({
        where: { initiaAddress },
      })

      const referralCode = await this.ensureReferralCode(initiaAddress, existing?.referralCode)

      if (existing) {
        const updated = await prisma.user.update({
          where: { initiaAddress },
          data: {
            username,
            referralCode,
            nativeBalance: wallet.nativeBalance,
            lockedCollateralLend: wallet.lockedCollateralLend,
            heldLend: onchain?.heldLend ?? existing.heldLend,
            liquidLend: onchain?.liquidLend ?? existing.liquidLend,
            stakedLend: onchain?.stakedLend ?? existing.stakedLend,
            claimableLend: onchain?.claimableLend ?? existing.claimableLend,
            claimableStakingRewards:
              onchain?.claimableStakingRewards ?? existing.claimableStakingRewards,
            points: onchain?.points ?? existing.points,
            streak: onchain?.streak ?? existing.streak,
            tier: onchain?.tier ?? existing.tier,
            creditLimitBoostBps: onchain?.creditLimitBoostBps ?? existing.creditLimitBoostBps,
            interestDiscountBps: onchain?.interestDiscountBps ?? existing.interestDiscountBps,
            premiumChecksAvailable:
              onchain?.premiumChecksAvailable ?? existing.premiumChecksAvailable,
            badgeCount: onchain?.badgeCount ?? existing.badgeCount,
          },
        })

        return rememberProfile(mapUserProfile(updated, identity))
      }

      const now = new Date().toISOString()

      const user = await prisma.user.create({
        data: {
          id: `user-${initiaAddress.slice(-8)}`,
          initiaAddress,
          username,
          referralCode,
          nativeBalance: wallet.nativeBalance,
          lockedCollateralLend: wallet.lockedCollateralLend,
          heldLend: onchain?.heldLend ?? 0,
          liquidLend: onchain?.liquidLend ?? 0,
          stakedLend: onchain?.stakedLend ?? 0,
          claimableLend: onchain?.claimableLend ?? 0,
          claimableStakingRewards: onchain?.claimableStakingRewards ?? 0,
          points: onchain?.points ?? 0,
          streak: onchain?.streak ?? 0,
          tier: onchain?.tier ?? resolveTier(onchain?.points ?? 0),
          creditLimitBoostBps: onchain?.creditLimitBoostBps ?? 0,
          interestDiscountBps: onchain?.interestDiscountBps ?? 0,
          premiumChecksAvailable: onchain?.premiumChecksAvailable ?? 0,
          badgeCount: onchain?.badgeCount ?? 0,
          createdAt: new Date(now),
        },
      })

      return rememberProfile(mapUserProfile(user, identity))
    } catch (error) {
      if (!isPrismaRecoverableStorageError(error, ['public.User'])) {
        throw error
      }

      return buildStoredProfile()
    }
  }

  async getProfile(initiaAddress: string) {
    return this.ensureUser(initiaAddress)
  }

  async syncProtocolState(initiaAddress: string, txHash?: string) {
    if (txHash && this.rollupClient.canRead()) {
      await this.rollupClient.waitForTx(txHash)
    }

    return this.ensureUser(initiaAddress)
  }

  async refreshUsername(initiaAddress: string) {
    await this.ensureUser(initiaAddress)
    const onchain = await this.rollupClient.syncRewards(initiaAddress).catch(() => null)
    const resolvedUsername = await this.usernamesClient.resolveNameWithSource(initiaAddress)
    const identity = this.resolveIdentity(resolvedUsername, onchain)
    const username = identity.username

    try {
      const updated = await prisma.user.update({
        where: { initiaAddress },
        data: {
          username,
        },
      })

      return rememberProfile(mapUserProfile(updated, identity))
    } catch (error) {
      if (!isPrismaRecoverableStorageError(error, ['public.User'])) {
        throw error
      }

      return this.ensureUser(initiaAddress)
    }
  }

  async getFaucetStatus(initiaAddress: string): Promise<FaucetState> {
    await this.ensureUser(initiaAddress)

    const latestClaim = await this.getLatestFaucetClaim(initiaAddress)
    const cooldownMs = env.FAUCET_COOLDOWN_HOURS * 60 * 60 * 1000
    const nextClaimAt = latestClaim ? new Date(latestClaim.createdAt.getTime() + cooldownMs) : null

    return {
      enabled: this.rollupClient.canBroadcast(),
      claimAmount: env.FAUCET_CLAIM_AMOUNT,
      nativeSymbol: env.ROLLUP_NATIVE_SYMBOL,
      cooldownHours: env.FAUCET_COOLDOWN_HOURS,
      canClaim: this.rollupClient.canBroadcast() && (!nextClaimAt || nextClaimAt.getTime() <= Date.now()),
      lastClaimAt: latestClaim?.createdAt.toISOString(),
      nextClaimAt: nextClaimAt?.toISOString(),
      txHash: latestClaim?.txHash ?? undefined,
    }
  }

  async claimFaucet(initiaAddress: string): Promise<FaucetState> {
    await this.ensureUser(initiaAddress)

    if (!this.rollupClient.canBroadcast()) {
      throw new AppError(
        503,
        'FAUCET_UNAVAILABLE',
        'Testnet faucet is not available right now. Live chain writes are disabled.',
      )
    }

    const status = await this.getFaucetStatus(initiaAddress)
    if (!status.canClaim) {
      throw new AppError(
        429,
        'FAUCET_COOLDOWN',
        status.nextClaimAt
          ? `You can claim testnet ${env.ROLLUP_NATIVE_SYMBOL} again after ${new Date(status.nextClaimAt).toLocaleString('en-US', { hour12: false })}.`
          : `You can claim testnet ${env.ROLLUP_NATIVE_SYMBOL} again later.`,
      )
    }

    let txHash = ''

    try {
      txHash = await this.rollupClient.sendNativeTokens(
        initiaAddress,
        env.FAUCET_CLAIM_AMOUNT,
        'lendpay.faucet',
      )
    } catch (error) {
      throw new AppError(
        502,
        'FAUCET_SEND_FAILED',
        error instanceof Error ? error.message : 'The faucet transaction could not be broadcast.',
      )
    }

    const operatorAction = {
      id: createPrefixedId('faucet'),
      actorAddress: env.ROLLUP_KEY_NAME || 'faucet-relayer',
      actionType: FAUCET_ACTION_TYPE,
      targetType: FAUCET_TARGET_TYPE,
      targetId: initiaAddress,
      reason: `Testnet faucet claim · ${env.FAUCET_CLAIM_AMOUNT} ${env.ROLLUP_NATIVE_SYMBOL}`,
      txHash,
      status: 'confirmed' as const,
      createdAt: new Date(),
    }

    try {
      await prisma.operatorAction.create({
        data: operatorAction,
      })
    } catch (error) {
      if (!isPrismaRecoverableStorageError(error, ['public.OperatorAction'])) {
        throw error
      }
    }

    store.operatorActions.unshift({
      ...operatorAction,
      createdAt: operatorAction.createdAt.toISOString(),
    })

    await this.ensureUser(initiaAddress)
    const nextStatus = await this.getFaucetStatus(initiaAddress)

    return {
      ...nextStatus,
      txHash,
    }
  }

  async addPoints(initiaAddress: string, delta: number) {
    if (this.rollupClient.canRead()) {
      return this.ensureUser(initiaAddress)
    }

    const user = await this.ensureUser(initiaAddress)
    const points = Math.max(0, user.rewards.points + delta)

    try {
      const updated = await prisma.user.update({
        where: { initiaAddress },
        data: {
          points,
          streak: delta > 0 ? user.rewards.streak + 1 : user.rewards.streak,
          tier: resolveTier(points),
        },
      })

      return mapUserProfile(updated)
    } catch (error) {
      if (!isPrismaRecoverableStorageError(error, ['public.User'])) {
        throw error
      }

      return rememberProfile({
        ...user,
        rewards: {
          ...user.rewards,
          points,
          streak: delta > 0 ? user.rewards.streak + 1 : user.rewards.streak,
          tier: resolveTier(points),
        },
        updatedAt: new Date().toISOString(),
      })
    }
  }

  async getReferral(initiaAddress: string): Promise<ReferralState> {
    const user = await this.ensureUser(initiaAddress)
    let links: Array<{
      refereeAddress: string
      joinedAt: Date
      pointsGenerated: number
      referee: {
        initiaAddress: string
        username: string | null
      }
    }> = []

    try {
      links = await prisma.referralLink.findMany({
        where: { referrerAddress: initiaAddress },
        include: {
          referee: {
            select: {
              initiaAddress: true,
              username: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      })
    } catch (error) {
      if (!isPrismaRecoverableStorageError(error, ['public.ReferralLink', 'public.User'])) {
        throw error
      }
    }

    const referralList: ReferralEntry[] = await Promise.all(
      links.map(async (link) => {
        const status = await this.syncReferralLinkStatus(link.refereeAddress)

        return {
          address: link.referee.initiaAddress,
          username: link.referee.username ?? undefined,
          joinedAt: link.joinedAt.toISOString(),
          status,
          pointsGenerated: link.pointsGenerated,
        }
      }),
    )

    return {
      referralCode: user.referralCode ?? buildReferralCode(initiaAddress),
      referredBy: user.referredBy ?? undefined,
      totalReferrals: referralList.length,
      activeReferrals: referralList.filter((entry) => entry.status === 'active').length,
      pointsEarned: user.referralPointsEarned ?? 0,
      referralList,
    }
  }

  async applyReferralCode(initiaAddress: string, code: string): Promise<ReferralState> {
    const user = await this.ensureUser(initiaAddress)
    const normalizedCode = code.trim().toUpperCase()

    if (!normalizedCode) {
      throw new AppError(400, 'INVALID_REFERRAL_CODE', 'Referral code is required.')
    }

    if (user.referredBy) {
      throw new AppError(400, 'REFERRAL_ALREADY_SET', 'This wallet already has a referral applied.')
    }

    const existingHistory = await Promise.all([
      prisma.loanRequest.count({ where: { initiaAddress } }),
      prisma.loan.count({ where: { initiaAddress } }),
    ])

    if (existingHistory[0] > 0 || existingHistory[1] > 0) {
      throw new AppError(
        400,
        'REFERRAL_WINDOW_CLOSED',
        'Referral codes can only be applied before the first loan request.',
      )
    }

    const referrer = await prisma.user.findFirst({
      where: { referralCode: normalizedCode },
    })

    if (!referrer) {
      throw new AppError(404, 'REFERRAL_NOT_FOUND', 'Referral code was not found.')
    }

    if (referrer.initiaAddress === initiaAddress) {
      throw new AppError(400, 'REFERRAL_SELF', 'You cannot apply your own referral code.')
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { initiaAddress },
        data: { referredBy: referrer.initiaAddress },
      }),
      prisma.referralLink.upsert({
        where: { refereeAddress: initiaAddress },
        update: { referrerAddress: referrer.initiaAddress, status: 'pending' },
        create: {
          id: createPrefixedId('ref'),
          referrerAddress: referrer.initiaAddress,
          refereeAddress: initiaAddress,
          status: 'pending',
          pointsGenerated: 0,
          firstLoanRewarded: false,
        },
      }),
    ])

    return this.getReferral(initiaAddress)
  }

  async rewardReferrerForFirstLoan(refereeAddress: string) {
    const referee = await prisma.user.findUnique({
      where: { initiaAddress: refereeAddress },
      select: { referredBy: true },
    })

    if (!referee?.referredBy) {
      return null
    }

    const link = await prisma.referralLink.findUnique({
      where: { refereeAddress },
    })

    if (!link || link.firstLoanRewarded) {
      return null
    }

    const referrer = await prisma.user.findUnique({
      where: { initiaAddress: referee.referredBy },
    })

    if (!referrer) {
      return null
    }

    await prisma.$transaction([
      prisma.referralLink.update({
        where: { refereeAddress },
        data: {
          status: 'active',
          pointsGenerated: link.pointsGenerated + 50,
          firstLoanRewarded: true,
        },
      }),
      prisma.user.update({
        where: { initiaAddress: referrer.initiaAddress },
        data: {
          referralPointsEarned: referrer.referralPointsEarned + 50,
        },
      }),
    ])

    return {
      referrerAddress: referrer.initiaAddress,
      points: 50,
      reason: 'first_loan',
    }
  }

  async rewardReferrerForRepayment(refereeAddress: string) {
    const referee = await prisma.user.findUnique({
      where: { initiaAddress: refereeAddress },
      select: { referredBy: true },
    })

    if (!referee?.referredBy) {
      return null
    }

    const link = await prisma.referralLink.findUnique({
      where: { refereeAddress },
    })

    if (!link || !link.firstLoanRewarded) {
      return null
    }

    const status = await this.syncReferralLinkStatus(refereeAddress)
    if (status === 'defaulted') {
      return null
    }

    const referrer = await prisma.user.findUnique({
      where: { initiaAddress: referee.referredBy },
    })

    if (!referrer) {
      return null
    }

    await prisma.$transaction([
      prisma.referralLink.update({
        where: { refereeAddress },
        data: {
          status: 'active',
          pointsGenerated: link.pointsGenerated + 20,
        },
      }),
      prisma.user.update({
        where: { initiaAddress: referrer.initiaAddress },
        data: {
          referralPointsEarned: referrer.referralPointsEarned + 20,
        },
      }),
    ])

    return {
      referrerAddress: referrer.initiaAddress,
      points: 20,
      reason: 'on_time_repayment',
    }
  }

  async getLeaderboard(initiaAddress: string): Promise<LeaderboardState> {
    const currentProfile = await this.ensureUser(initiaAddress)

    let users: Array<{
      initiaAddress: string
      username: string | null
      tier: string
      heldLend: number
      points: number
      streak: number
      referralPointsEarned: number
    }> = []
    let loans: Array<{
      initiaAddress: string
      principal: number
      installmentsPaid: number
      status: string
      tenorMonths: number
      scheduleJson: string
    }> = []
    let scores: Array<{
      initiaAddress: string
      score: number
      scannedAt: Date
    }> = []
    let referralLinks: Array<{
      referrerAddress: string
      refereeAddress: string
      pointsGenerated: number
      status: string
    }> = []

    try {
      ;[users, loans, scores, referralLinks] = await Promise.all([
        prisma.user.findMany({
          select: {
            initiaAddress: true,
            username: true,
            tier: true,
            heldLend: true,
            points: true,
            streak: true,
            referralPointsEarned: true,
          },
        }),
        prisma.loan.findMany({
          select: {
            initiaAddress: true,
            principal: true,
            installmentsPaid: true,
            status: true,
            tenorMonths: true,
            scheduleJson: true,
          },
        }),
        prisma.creditScore.findMany({
          select: {
            initiaAddress: true,
            score: true,
            scannedAt: true,
          },
          orderBy: { scannedAt: 'asc' },
        }),
        prisma.referralLink.findMany({
          select: {
            referrerAddress: true,
            refereeAddress: true,
            pointsGenerated: true,
            status: true,
          },
        }),
      ])
    } catch (error) {
      if (
        !isPrismaRecoverableStorageError(error, [
          'public.User',
          'public.Loan',
          'public.CreditScore',
          'public.ReferralLink',
        ])
      ) {
        throw error
      }

      users = [
        currentProfile,
        ...Array.from(store.users.values()).filter(
          (user) => user.initiaAddress !== currentProfile.initiaAddress,
        ),
      ].map((user) => ({
        initiaAddress: user.initiaAddress,
        username: user.username ?? null,
        tier: user.rewards.tier,
        heldLend: user.rewards.heldLend,
        points: user.rewards.points,
        streak: user.rewards.streak,
        referralPointsEarned: user.referralPointsEarned ?? 0,
      }))
      loans = Array.from(store.loans.values()).flatMap((loan) => {
        const owner = (loan as LoanState & { initiaAddress?: string }).initiaAddress
        return owner
          ? [
              {
                initiaAddress: owner,
                principal: loan.principal,
                installmentsPaid: loan.installmentsPaid,
                status: loan.status,
                tenorMonths: loan.tenorMonths,
                scheduleJson: JSON.stringify(loan.schedule),
              },
            ]
          : []
      })
      scores = Array.from(store.scores.entries())
        .flatMap(([address, history]) =>
          history.map((score) => ({
            initiaAddress: address,
            score: score.score,
            scannedAt: new Date(score.scannedAt),
          })),
        )
        .sort((left, right) => left.scannedAt.getTime() - right.scannedAt.getTime())
      referralLinks = []
    }

    const firstScores = new Map<string, number>()
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthlyBaseline = new Map<string, number>()
    const monthlyLatest = new Map<string, number>()

    for (const score of scores) {
      if (!firstScores.has(score.initiaAddress)) {
        firstScores.set(score.initiaAddress, score.score)
      }

      if (score.scannedAt < monthStart) {
        monthlyBaseline.set(score.initiaAddress, score.score)
        continue
      }

      if (!monthlyBaseline.has(score.initiaAddress)) {
        monthlyBaseline.set(score.initiaAddress, score.score)
      }
      monthlyLatest.set(score.initiaAddress, score.score)
    }

    const resolveIdentity = (user: (typeof users)[number]) => ({
      address: user.initiaAddress,
      username:
        user.initiaAddress === initiaAddress
          ? currentProfile.username ?? user.username ?? undefined
          : user.username ?? undefined,
      tier: resolveLeaderboardTier(
        user.initiaAddress === initiaAddress
          ? Math.max(user.heldLend, currentProfile.rewards.heldLend)
          : user.heldLend,
        user.initiaAddress === initiaAddress
          ? Math.max(user.points, currentProfile.rewards.points)
          : user.points,
        user.initiaAddress === initiaAddress
          ? (currentProfile.rewards.tier as RewardTier)
          : (user.tier as RewardTier),
      ),
    })

    const topBorrowersRaw = users
      .map((user) => {
        const userLoans = loans.filter((loan) => loan.initiaAddress === user.initiaAddress)
        const borrowedTotal = userLoans.reduce((sum, loan) => sum + loan.principal, 0)
        const repaidTotal = userLoans.reduce((sum, loan) => sum + deriveRepaidAmount(loan), 0)
        const repaidCount = userLoans.filter((loan) => loan.status === 'repaid').length

        return {
          ...resolveIdentity(user),
          value: formatUsd(borrowedTotal),
          metric: `${formatUsd(repaidTotal)} repaid`,
          badge: repaidCount > 0 ? `${repaidCount} loan${repaidCount === 1 ? '' : 's'} settled` : undefined,
          repaidCount,
          borrowedTotal,
          repaidTotal,
        }
      })
      .filter((entry) => entry.borrowedTotal > 0)
      .sort(
        (left, right) =>
          right.borrowedTotal - left.borrowedTotal || right.repaidTotal - left.repaidTotal,
      )
      .map(({ repaidCount: _repaidCount, borrowedTotal: _borrowedTotal, repaidTotal: _repaidTotal, ...entry }) => entry)

    const topRepayersRaw = users
      .map((user) => {
        const userLoans = loans.filter((loan) => loan.initiaAddress === user.initiaAddress)
        const installmentsPaid = userLoans.reduce((sum, loan) => sum + loan.installmentsPaid, 0)
        const defaultedLoans = userLoans.filter((loan) => loan.status === 'defaulted').length
        const hasRepaymentTrackRecord = user.streak > 0 || installmentsPaid > 0
        const onTimePercentage = hasRepaymentTrackRecord
          ? userLoans.length > 0
            ? Math.max(
                0,
                Math.round(((userLoans.length - defaultedLoans) / Math.max(userLoans.length, 1)) * 100),
              )
            : 100
          : 0

        return {
          ...resolveIdentity(user),
          value: `${user.streak} streak`,
          metric: `${onTimePercentage}% on time`,
          badge: user.streak >= 5 ? 'Reliable repayment streak' : undefined,
          streak: user.streak,
          installmentsPaid,
          onTimePercentage,
          hasRepaymentTrackRecord,
        }
      })
      .filter((entry) => entry.hasRepaymentTrackRecord)
      .sort(
        (left, right) =>
          right.streak - left.streak ||
          right.onTimePercentage - left.onTimePercentage ||
          right.installmentsPaid - left.installmentsPaid,
      )
      .map(
        ({
          streak: _streak,
          installmentsPaid: _installmentsPaid,
          onTimePercentage: _onTimePercentage,
          hasRepaymentTrackRecord: _hasRepaymentTrackRecord,
          ...entry
        }) => entry,
      )

    const topReferrersRaw = users
      .map((user) => {
        const links = referralLinks.filter((link) => link.referrerAddress === user.initiaAddress)
        const activeReferrals = links.filter((link) => link.status === 'active').length
        const totalPoints = links.reduce((sum, link) => sum + link.pointsGenerated, 0)

        return {
          ...resolveIdentity(user),
          value: `${activeReferrals} active`,
          metric: `${totalPoints} points earned`,
          badge: activeReferrals > 0 ? 'Healthy referrals' : undefined,
          activeReferrals,
          totalPoints,
          referralsCount: links.length,
        }
      })
      .sort((left, right) => right.activeReferrals - left.activeReferrals || right.totalPoints - left.totalPoints)
      .filter((entry) => entry.activeReferrals > 0 || entry.totalPoints > 0)
      .map(
        ({
          activeReferrals: _activeReferrals,
          totalPoints: _totalPoints,
          referralsCount: _referralsCount,
          ...entry
        }) => entry,
      )

    const risingStarsRaw = users
      .map((user) => {
        const baseline = monthlyBaseline.get(user.initiaAddress) ?? firstScores.get(user.initiaAddress) ?? 0
        const latest = monthlyLatest.get(user.initiaAddress) ?? 0
        const scoreGain = Math.max(0, latest - baseline)

        return {
          ...resolveIdentity(user),
          value: `+${scoreGain}`,
          metric: `Score ${latest} now`,
          badge: scoreGain > 0 ? 'Fast mover' : undefined,
          scoreGain,
          latest,
        }
      })
      .filter((entry) => entry.scoreGain > 0)
      .sort((left, right) => right.scoreGain - left.scoreGain || right.latest - left.latest)
      .map(({ scoreGain: _scoreGain, latest: _latest, ...entry }) => entry)

    const topBorrowers = topEntries(topBorrowersRaw, initiaAddress)
    const topRepayers = topEntries(topRepayersRaw, initiaAddress)
    const topReferrers = topEntries(topReferrersRaw, initiaAddress)
    const risingStars = topEntries(risingStarsRaw, initiaAddress)

    return {
      topBorrowers: topBorrowers.items,
      topRepayers: topRepayers.items,
      topReferrers: topReferrers.items,
      risingStars: risingStars.items,
      myRank: {
        borrowers: topBorrowers.myRank,
        repayers: topRepayers.myRank,
        referrers: topReferrers.myRank,
        risingStars: risingStars.myRank,
      },
    }
  }
}
