import { mapUserProfile } from '../../db/mappers.js'
import { prisma } from '../../db/prisma.js'
import type { RewardTier } from '../../types/domain.js'
import type { UsernamesClient } from '../../integrations/l1/usernames.js'
import type { RollupClient } from '../../integrations/rollup/client.js'

const resolveTier = (points: number): RewardTier => {
  if (points >= 10000) return 'Diamond'
  if (points >= 7000) return 'Gold'
  if (points >= 3500) return 'Silver'
  return 'Bronze'
}

export class UserService {
  constructor(
    private usernamesClient: UsernamesClient,
    private rollupClient: RollupClient,
  ) {}

  async ensureUser(initiaAddress: string) {
    const onchain = await this.rollupClient.syncRewards(initiaAddress).catch(() => null)
    const wallet = await this.rollupClient.getWalletSnapshot(initiaAddress).catch(() => ({
      nativeBalance: 0,
      lockedCollateralLend: 0,
    }))
    const resolvedUsername = await this.usernamesClient.resolveName(initiaAddress)
    const username = resolvedUsername ?? onchain?.username

    const existing = await prisma.user.findUnique({
      where: { initiaAddress },
    })

    if (existing) {
      const updated = await prisma.user.update({
        where: { initiaAddress },
        data: {
          username,
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

      return mapUserProfile(updated)
    }
    const now = new Date().toISOString()

    const user = await prisma.user.create({
      data: {
        id: `user-${initiaAddress.slice(-8)}`,
        initiaAddress,
        username,
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

    return mapUserProfile(user)
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
    const username = (await this.usernamesClient.resolveName(initiaAddress)) ?? onchain?.username

    const updated = await prisma.user.update({
      where: { initiaAddress },
      data: {
        username,
      },
    })

    return mapUserProfile(updated)
  }

  async addPoints(initiaAddress: string, delta: number) {
    if (this.rollupClient.canRead()) {
      return this.ensureUser(initiaAddress)
    }

    const user = await this.ensureUser(initiaAddress)
    const points = Math.max(0, user.rewards.points + delta)

    const updated = await prisma.user.update({
      where: { initiaAddress },
      data: {
        points,
        streak: delta > 0 ? user.rewards.streak + 1 : user.rewards.streak,
        tier: resolveTier(points),
      },
    })

    return mapUserProfile(updated)
  }
}
