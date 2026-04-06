import { appEnv } from '../config/env'
import {
  formatDate,
  formatNumber,
  parseRpcTx,
  shortenAddress,
} from './format'
import type {
  CampaignState,
  CreditProfileQuote,
  CreditScoreState,
  MerchantState,
  RewardsState,
  TxExplorerState,
  ViralDropItemState,
  ViralDropPurchaseState,
} from '../types/domain'

export type RequestDraft = {
  amount: string
  collateralAmount: string
  merchantId: string
  tenorMonths: 1 | 3 | 6
  profileId: number
}

export type AppFamily = 'NFT' | 'Gaming' | 'DeFi' | 'Utilities'

export type PurchaseDeliverySummary = {
  headline: string
  detail: string
}

export type AppCategoryMeta = {
  family: AppFamily
  headline: string
  description: string
  examples: string[]
}

export const REDEEM_POINTS_BASE = 1000
export const REDEEM_LEND_OUTPUT = 10
export const LIMIT_BOOST_COST = 500
export const INTEREST_DISCOUNT_COST_PER_PERCENT = 300
export const PREMIUM_CHECK_COST = 200
export const BADGE_COST = 1000

export const parseNumericId = (value?: string | null) => Number(value?.replace(/\D/g, '') || 0)

export const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export const parseMoveAbort = (message: string) => {
  const codeMatch = message.match(/Failed with code (0x[0-9a-f]+)/i)
  const moduleMatch = message.match(/module ([a-zA-Z0-9_]+) at/i)

  if (!codeMatch) return null

  return {
    code: Number.parseInt(codeMatch[1], 16),
    codeHex: codeMatch[1].toLowerCase(),
    moduleName: moduleMatch?.[1]?.toLowerCase(),
  }
}

export const humanizeRepayError = (message: string) => {
  if (message.includes('does not exist on chain') || message.includes('account sequence')) {
    return `This wallet needs testnet ${appEnv.nativeSymbol} before it can sign a repayment. Claim faucet funds first.`
  }

  const moveAbort = parseMoveAbort(message)
  if (!moveAbort) return message

  if (moveAbort.moduleName === 'loan_book' && moveAbort.code === 10) {
    return 'This loan was not found on the active LendPay chain. The app is likely showing an older local loan record. Refresh your account first, then try again.'
  }

  if (moveAbort.moduleName === 'loan_book' && moveAbort.code === 12) {
    return 'This loan is no longer active onchain, so there is nothing left to repay.'
  }

  if (moveAbort.moduleName === 'loan_book' && moveAbort.code === 26) {
    return 'There is no installment due right now. Your loan does not need a payment yet.'
  }

  return message
}

export const describeDropItemDelivery = (item: ViralDropItemState) => {
  if (item.instantCollateralRequired > 0) {
    return `Receipt mints now. Full collectible unlocks after full repayment, or instantly with ${formatNumber(item.instantCollateralRequired)} LEND locked.`
  }

  return 'Receipt mints now. Full collectible unlocks after full repayment.'
}

export const describePurchaseDelivery = (purchase: ViralDropPurchaseState): PurchaseDeliverySummary => {
  if (purchase.collectibleClaimed) {
    return {
      headline: 'Final collectible delivered',
      detail: purchase.collectibleAddress
        ? `Receipt ${shortenAddress(purchase.receiptAddress)} stays as proof. Full collectible ${shortenAddress(purchase.collectibleAddress)} is already in your wallet.`
        : `Receipt ${shortenAddress(purchase.receiptAddress)} stays as proof. The full collectible has already been delivered to your wallet.`,
    }
  }

  if (purchase.collectibleClaimable) {
    return {
      headline: 'Final collectible ready to claim',
      detail: `Receipt ${shortenAddress(purchase.receiptAddress)} is in your wallet. The full collectible is unlocked and ready to claim now.`,
    }
  }

  return {
    headline: 'Receipt in wallet · final collectible locked',
    detail: `Receipt ${shortenAddress(purchase.receiptAddress)} is in your wallet now. The full collectible unlocks after full repayment.`,
  }
}

export const getAppPostApprovalCopy = (category?: string) => {
  const normalized = (category ?? '').toLowerCase()

  if (normalized.includes('defi')) {
    return 'Funds will be deposited directly into the vault onchain.'
  }

  if (normalized.includes('gaming') || normalized.includes('game')) {
    return 'Funds will be used to unlock your selected game item onchain.'
  }

  return 'Pick a live item there to finish the purchase onchain.'
}

export const formatMerchantCategory = (value?: string) =>
  value
    ? value.toLowerCase().includes('viral') ||
      value.toLowerCase().includes('drop') ||
      value.toLowerCase().includes('partner_app') ||
      value.toLowerCase().includes('marketplace')
      ? 'Viral Drops'
      : value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Initia app'

export const formatAppLabel = (merchant?: MerchantState | null) =>
  merchant?.name?.trim() || formatMerchantCategory(merchant?.category)

export const getAppUpdateDescription = (app: MerchantState) => {
  const category = (app.category ?? '').toLowerCase()
  const name = (app.name ?? '').toLowerCase()

  if (category.includes('nft') && name.includes('viral')) {
    return 'NFT drops and collectible passes with credit'
  }

  if (category.includes('nft') && name.includes('intergaze')) {
    return 'NFT minting and collectible trading with credit'
  }

  if (category.includes('gaming') || category.includes('game')) {
    return 'Game items, characters, and world access'
  }

  if (category.includes('defi')) {
    return 'Yield vault deposits and DeFi strategy access'
  }

  return 'Available in checkout request'
}

export const getCampaignIneligibleReason = (
  campaign: CampaignState,
  username?: string | null,
) => {
  if (campaign.requiresUsername && !username) {
    return 'Requires .init username to claim'
  }

  if (campaign.minimumPlatformActions > 0) {
    return `Requires ${campaign.minimumPlatformActions} platform actions to qualify`
  }

  return 'You do not meet the eligibility criteria yet'
}

export const getProtocolEventBadge = (event: string) => {
  const normalized = event.toLowerCase()

  if (normalized.includes('live')) {
    return { label: 'App live', tone: 'success' as const }
  }

  if (normalized.includes('campaign')) {
    return { label: 'Campaign', tone: 'warning' as const }
  }

  if (normalized.includes('proposal') || normalized.includes('governance')) {
    return { label: 'Governance', tone: 'info' as const }
  }

  if (normalized.includes('updated')) {
    return { label: 'Updated', tone: 'neutral' as const }
  }

  return { label: 'Protocol', tone: 'neutral' as const }
}

export const buildRpcTxUrl = (txHash?: string) =>
  txHash ? `${appEnv.chainRpcUrl.replace(/\/$/, '')}/tx?hash=0x${txHash}` : null

export const buildRestTxInfoUrl = (txHash?: string) =>
  txHash ? `${appEnv.chainRestUrl.replace(/\/$/, '')}/cosmos/tx/v1beta1/txs/${txHash.replace(/^0x/i, '')}` : null

export const formatNativeDisplay = (value?: string | null) => {
  if (!value) return '—'
  const normalized = value.replace(new RegExp(`\\b${appEnv.nativeDenom}\\b`, 'gi'), appEnv.nativeSymbol)
  return normalized
}

export const fetchTxData = async (txHash: string, rpcUrl: string): Promise<TxExplorerState> => {
  const normalizedHash = txHash.replace(/^0x/i, '')

  try {
    const rpcResponse = await fetch(`${rpcUrl.replace(/\/$/, '')}/tx?hash=0x${normalizedHash}&prove=false`)
    if (rpcResponse.ok) {
      const rpcRaw = (await rpcResponse.json()) as Record<string, unknown>
      const parsedFromRpc = parseRpcTx(rpcRaw)

      if (parsedFromRpc.txHash && (parsedFromRpc.gasUsed > 0 || parsedFromRpc.gasWanted > 0)) {
        return parsedFromRpc
      }
    }
  } catch {
    // REST fallback below handles nodes that omit tx_result details from comet RPC.
  }

  const restUrl = buildRestTxInfoUrl(normalizedHash)
  if (!restUrl) {
    throw new Error('Tx hash is missing.')
  }

  const restResponse = await fetch(restUrl)
  if (!restResponse.ok) {
    throw new Error(`Tx query failed with ${restResponse.status}`)
  }

  const restRaw = (await restResponse.json()) as Record<string, unknown>
  return parseRpcTx(restRaw)
}

export const dedupeApps = (apps: MerchantState[]) =>
  apps
    .filter((app, index, self) => index === self.findIndex((entry) => entry.id === app.id))
    .filter(
      (app, index, self) =>
        index ===
        self.findIndex((entry) => {
          const leftName = (entry.name ?? '').trim().toLowerCase()
          const rightName = (app.name ?? '').trim().toLowerCase()
          return leftName === rightName && entry.category.toLowerCase() === app.category.toLowerCase()
        }),
    )

export const APP_FAMILIES: AppFamily[] = ['NFT', 'Gaming', 'DeFi', 'Utilities']

export const appCategoryMeta = (value?: string): AppCategoryMeta => {
  const normalized = (value ?? '').toLowerCase()

  if (
    normalized.includes('nft') ||
    normalized.includes('drop') ||
    normalized.includes('mint') ||
    normalized.includes('collect') ||
    normalized.includes('partner_app') ||
    normalized.includes('marketplace')
  ) {
    return {
      family: 'NFT',
      headline: 'Drops, passes, and collectible access',
      description: 'Best for mints, ecosystem passes, collectible drops, and limited-access launches.',
      examples: ['Mint pass', 'Join drop', 'Claim collectible'],
    }
  }

  if (
    normalized.includes('gaming') ||
    normalized.includes('game') ||
    normalized.includes('world') ||
    normalized.includes('play') ||
    normalized.includes('guild')
  ) {
    return {
      family: 'Gaming',
      headline: 'Game items and world access',
      description: 'Best for in-game items, world entry, boosters, and time-sensitive game access.',
      examples: ['Unlock item', 'Enter world', 'Claim booster'],
    }
  }

  if (
    normalized.includes('defi') ||
    normalized.includes('dex') ||
    normalized.includes('lend') ||
    normalized.includes('perp') ||
    normalized.includes('vault') ||
    normalized.includes('swap')
  ) {
    return {
      family: 'DeFi',
      headline: 'Protocol actions and strategy access',
      description: 'Best for DeFi actions where users need short-term room before repaying on schedule.',
      examples: ['Access strategy', 'Open position', 'Activate vault'],
    }
  }

  return {
    family: 'Utilities',
    headline: 'Membership, tools, and app access',
    description: 'Best for memberships, premium tools, app unlocks, and other consumer utility flows.',
    examples: ['Unlock app', 'Join membership', 'Activate feature'],
  }
}

export const formatProfileLabel = (value?: string) => {
  switch (value) {
    case 'micro_loan':
      return 'Starter checkout'
    case 'standard_bnpl':
      return 'Standard pay later'
    case 'credit_line':
      return 'Loyalty credit line'
    case 'collateralized':
      return 'Secured advanced'
    default:
      return value ? value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : 'App credit'
  }
}

export const describeCampaign = (campaign: CampaignState) => {
  if (campaign.phase === 1) {
    return {
      title: 'Borrower welcome bonus',
      description: 'Built for first credit use and early borrower activation.',
    }
  }

  if (campaign.phase === 2) {
    return {
      title: 'On-time repayment bonus',
      description: 'Rewards borrowers who keep payments on schedule.',
    }
  }

  if (campaign.phase === 3) {
    return {
      title: 'Referral reward sprint',
      description: 'Extra rewards for bringing in healthy referrals.',
    }
  }

  return {
    title: `Reward campaign #${campaign.id}`,
    description: 'Live reward pool for borrower activity across LendPay.',
  }
}

export const describeProfileUse = (profile?: CreditProfileQuote | null) => {
  switch (profile?.label) {
    case 'micro_loan':
      return 'Best for smaller passes, drops, and in-app items with no collateral.'
    case 'standard_bnpl':
      return 'More room for repeat purchases across multiple Initia apps.'
    case 'credit_line':
      return 'Unlocked by stronger loyalty signals and repeat healthy repayments.'
    case 'collateralized':
      return 'Locks LEND to support a larger credit amount.'
    default:
      return 'Initia app credit.'
  }
}

export const describeProductCard = (value?: string) => {
  switch (value) {
    case 'micro_loan':
      return 'No-collateral credit for smaller drops, passes, and in-app items.'
    case 'standard_bnpl':
      return 'More room for larger purchases and repeat use across Initia apps.'
    case 'credit_line':
      return 'Unlocked by stronger loyalty and repeat healthy repayment.'
    case 'collateralized':
      return 'Locks LEND so you can use a larger credit amount.'
    default:
      return 'Initia app credit.'
  }
}

export const productTagMeta = (value?: string) => {
  switch (value) {
    case 'micro_loan':
      return { label: 'No collateral', tone: 'success' as const }
    case 'standard_bnpl':
      return { label: 'More room', tone: 'info' as const }
    case 'credit_line':
      return { label: 'Unlocked by loyalty', tone: 'warning' as const }
    case 'collateralized':
      return { label: 'Locks LEND', tone: 'neutral' as const }
    default:
      return { label: 'App credit', tone: 'neutral' as const }
  }
}

export const productRequirementCopy = (profile?: CreditProfileQuote | null) => {
  switch (profile?.label) {
    case 'standard_bnpl':
      return 'Requires stronger score'
    case 'credit_line':
      return 'Requires loyalty tier'
    case 'collateralized':
      return 'Requires loyalty tier'
    case 'micro_loan':
      return 'Requires profile refresh'
    default:
      return 'Not available yet'
  }
}

export const titleCase = (value?: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Not ready'

export const nextTierLabel = (tier?: RewardsState['tier'] | null) => {
  switch (tier) {
    case 'Bronze':
      return 'Silver'
    case 'Silver':
      return 'Gold'
    case 'Gold':
      return 'Diamond'
    case 'Diamond':
      return 'Diamond'
    default:
      return null
  }
}

export const tierHoldingsThreshold = {
  Bronze: 0,
  Silver: 100,
  Gold: 500,
  Diamond: 1000,
} satisfies Record<RewardsState['tier'], number>

export const nextTierBenefitCopy = {
  Bronze: {
    apr: '1% at Silver tier',
    limit: '5% at Silver tier',
    premium: '1 premium check at Silver tier',
  },
  Silver: {
    apr: '3% at Gold tier',
    limit: '10% at Gold tier',
    premium: '2 premium checks at Gold tier',
  },
  Gold: {
    apr: '5% at Diamond tier',
    limit: '15% at Diamond tier',
    premium: '3 premium checks at Diamond tier',
  },
  Diamond: {
    apr: 'Max tier unlocked',
    limit: 'Max tier unlocked',
    premium: 'Max tier unlocked',
  },
} satisfies Record<RewardsState['tier'], { apr: string; limit: string; premium: string }>

export const formatBpsPercent = (value: number) =>
  `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%`

export const scoreStatusLabel = (percent: number) => {
  if (percent >= 85) return 'Excellent'
  if (percent >= 70) return 'Strong'
  if (percent >= 45) return 'Building'
  return 'Weak'
}

export const consumerScoreLine = (score: CreditScoreState | null, rewards: RewardsState | null) => {
  const upcomingTier = nextTierLabel(rewards?.tier) ?? 'the next tier'

  if (!score) {
    return 'Connect your wallet and refresh your profile to see your starting limit.'
  }

  if (score.risk === 'Low') {
    return `Your profile looks strong. Keep paying on time to move toward ${upcomingTier}.`
  }

  if (score.risk === 'Medium') {
    return 'Your profile is in a healthy range. A few on-time payments can unlock more room.'
  }

  return 'Start with a smaller purchase and keep the first payment on time to build trust quickly.'
}

export const formatExplorerVerifiedAt = (timestamp?: string) =>
  timestamp ? formatDate(timestamp) : 'Not available'
