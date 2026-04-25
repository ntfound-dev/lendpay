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

export type MerchantShowcaseItem = {
  id: string
  name: string
  artwork: string
  price: number
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
export const WALLET_SIGN_IN_CANCELLED_MESSAGE =
  'Wallet sign-in was canceled. Continue when you are ready.'

export const parseNumericId = (value?: string | null) => {
  const digits = value?.replace(/\D/g, '') ?? ''
  if (!digits) {
    return null
  }

  try {
    return BigInt(digits)
  } catch {
    return null
  }
}

export const sanitizeErrorMessage = (message: string) =>
  message
    .replace(/\s*Details:\s*/gi, ' ')
    .replace(/\s*Version:\s*viem@[^\s]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

export const getErrorMessage = (error: unknown, fallback: string) =>
  sanitizeErrorMessage(error instanceof Error ? error.message : fallback)

export const isWalletSignInCancelledMessage = (message?: string | null) =>
  (message ?? '').toLowerCase().includes('wallet sign-in was canceled')

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

  if (message.includes('does not expose a repay event for this loan')) {
    return 'The repayment transaction landed, but it was not recognized as a payment for this loan. Refresh your account and try the repayment again.'
  }

  if (message.includes('belongs to a different loan')) {
    return 'The repayment transaction was confirmed for a different loan id than the one shown in the app. Refresh your account and try again.'
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

export const humanizeRequestError = (message: string) => {
  const moveAbort = parseMoveAbort(message)
  if (!moveAbort) return message

  if (moveAbort.moduleName === 'profiles' && moveAbort.code === 8) {
    return 'The repayment period you picked is not allowed for this onchain credit product. Choose a shorter tenor for this profile, or switch to a product with a longer term.'
  }

  if (moveAbort.moduleName === 'profiles' && moveAbort.code === 39) {
    return 'This wallet does not meet the onchain requirements for that credit product yet. Refresh your account and choose a profile that is marked ready.'
  }

  if (moveAbort.moduleName === 'profiles' && moveAbort.code === 40) {
    return 'That onchain credit product requires collateral. Pick the secured profile and lock the required LEND first.'
  }

  if (moveAbort.moduleName === 'profiles' && moveAbort.code === 43) {
    return 'The collateral amount is still below the onchain minimum for this request.'
  }

  if (moveAbort.moduleName === 'loan_book' && moveAbort.code === 59) {
    return 'LendPay already sees a pending request or active credit for this wallet onchain. Your previous submit may have landed even if the app has not refreshed yet. Refresh your account, or finish the current credit on the Repay page before sending another request.'
  }

  return message
}

export const describeDropItemDelivery = (item: ViralDropItemState) => {
  if (item.instantCollateralRequired > 0) {
    return `Receipt mints now. Full collectible unlocks after full repayment, or instantly with ${formatNumber(item.instantCollateralRequired)} LEND locked.`
  }

  return 'Receipt mints now. Full collectible unlocks after full repayment.'
}

const normalizeDropSlug = (item: ViralDropItemState) => {
  const uriSlug = item.uri.split('/').filter(Boolean).pop()?.trim().toLowerCase()
  if (uriSlug) return uriSlug

  return item.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const getDropItemArtwork = (item: ViralDropItemState) => {
  const slug = normalizeDropSlug(item)

  switch (slug) {
    case 'initia-og-pass':
      return '/drops/initia-og-pass.svg'
    case 'meme-capsule':
      return '/drops/meme-capsule.svg'
    case 'alpha-circle-badge':
      return '/drops/alpha-circle-badge.svg'
    default:
      return null
  }
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

export type MerchantBanner = {
  emoji: string
  gradientFrom: string
  gradientTo: string
}

export const getMerchantBanner = (merchant?: MerchantState | null): MerchantBanner => {
  const name = merchant?.name?.trim().toLowerCase() ?? ''
  const category = merchant?.category?.trim().toLowerCase() ?? ''

  if (name.includes('atelier') || category.includes('apparel') || category.includes('fashion')) {
    return { emoji: '🎨', gradientFrom: '#ede9fe', gradientTo: '#fce7f3' }
  }
  if (name.includes('arcade') || category.includes('arcade')) {
    return { emoji: '🎮', gradientFrom: '#fef3c7', gradientTo: '#dbeafe' }
  }
  if (name.includes('intergaze')) {
    return { emoji: '🔮', gradientFrom: '#ede9fe', gradientTo: '#dbeafe' }
  }
  if (name.includes('yominet') || category.includes('gaming') || category.includes('game')) {
    return { emoji: '⚔️', gradientFrom: '#fef9c3', gradientTo: '#d1fae5' }
  }
  if (name.includes('cabal') || category.includes('defi')) {
    return { emoji: '📈', gradientFrom: '#dbeafe', gradientTo: '#d1fae5' }
  }
  return { emoji: '🛍️', gradientFrom: '#f1f5f9', gradientTo: '#e2e8f0' }
}

export const getMerchantShowcaseItems = (merchant?: MerchantState | null): MerchantShowcaseItem[] => {
  const name = merchant?.name?.trim().toLowerCase() ?? ''
  const category = merchant?.category?.trim().toLowerCase() ?? ''

  if (name.includes('atelier') || category.includes('apparel') || category.includes('fashion')) {
    return [
      {
        id: 'atelier-og-pass',
        name: 'Initia OG Pass',
        artwork: '/drops/initia-og-pass.svg',
        price: 80,
        detail: 'Early-access pass for Atelier drops, limited editions, and creator collabs.',
      },
      {
        id: 'atelier-alpha-badge',
        name: 'Alpha Circle Badge',
        artwork: '/drops/alpha-circle-badge.svg',
        price: 160,
        detail: 'Collector badge granting priority access to new Atelier season releases.',
      },
      {
        id: 'atelier-meme-capsule',
        name: 'Meme Capsule',
        artwork: '/drops/meme-capsule.svg',
        price: 240,
        detail: 'Limited capsule drop blending creator culture with collectible apparel.',
      },
    ]
  }

  if (name.includes('arcade') || category.includes('arcade')) {
    return [
      {
        id: 'arcade-kamigotchi',
        name: 'Kamigotchi Egg',
        artwork: '/yominet/kamigotchi-egg.svg',
        price: 50,
        detail: 'Starter creature for Arcade Mile mini-games with hatch-ready cosmetics.',
      },
      {
        id: 'arcade-starter-pack',
        name: 'Arena Starter Pack',
        artwork: '/yominet/arena-starter-pack.svg',
        price: 120,
        detail: 'Battle-ready loadout with consumables and ranked queue access.',
      },
      {
        id: 'arcade-pass',
        name: 'Guild Access Pass',
        artwork: '/yominet/guild-access-pass.svg',
        price: 200,
        detail: 'Full arcade pass unlocking premium game modes and exclusive events.',
      },
    ]
  }

  if (name.includes('intergaze')) {
    return [
      {
        id: 'intergaze-genesis-pass',
        name: 'Genesis Mint Pass',
        artwork: '/intergaze/genesis-mint-pass.svg',
        price: 180,
        detail: 'Launch pass that opens the first mint window, gated rooms, and collector perks.',
      },
      {
        id: 'intergaze-orbit-capsule',
        name: 'Orbit Capsule',
        artwork: '/intergaze/orbit-capsule.svg',
        price: 320,
        detail: 'Mid-tier collectible capsule with reveal traits, bonus metadata, and claim boosts.',
      },
      {
        id: 'intergaze-founder-totem',
        name: 'Founder Totem',
        artwork: '/intergaze/founder-totem.svg',
        price: 470,
        detail: 'Premium collector mint with rare trait odds and access to founder-only drops.',
      },
    ]
  }

  if (name.includes('yominet') || category.includes('gaming') || category.includes('game')) {
    return [
      {
        id: 'kamigotchi-egg',
        name: 'Kamigotchi Egg',
        artwork: '/yominet/kamigotchi-egg.svg',
        price: 220,
        detail: 'Starter creature capsule with hatch-ready cosmetics and first-run perks.',
      },
      {
        id: 'arena-starter-pack',
        name: 'Arena Starter Pack',
        artwork: '/yominet/arena-starter-pack.svg',
        price: 340,
        detail: 'Battle-ready loadout with consumables, skin shards, and ranked queue entry.',
      },
      {
        id: 'guild-access-pass',
        name: 'Guild Access Pass',
        artwork: '/yominet/guild-access-pass.svg',
        price: 480,
        detail: 'World access pass that unlocks guild halls, raids, and social events.',
      },
    ]
  }

  if (name.includes('cabal') || category.includes('defi')) {
    return [
      {
        id: 'cabal-stable-vault',
        name: 'Stable Yield Vault',
        artwork: '/cabal/stable-yield-vault.svg',
        price: 260,
        detail: 'Lower-volatility vault route for idle balances that need short-term yield.',
      },
      {
        id: 'cabal-basis-tranche',
        name: 'Basis Trade Tranche',
        artwork: '/cabal/basis-trade-tranche.svg',
        price: 420,
        detail: 'Higher-conviction strategy sleeve for short bursts of carry and basis capture.',
      },
      {
        id: 'cabal-liquidity-ladder',
        name: 'Liquidity Ladder',
        artwork: '/cabal/liquidity-ladder.svg',
        price: 500,
        detail: 'Balanced vault mix for rotating liquidity across yield lanes while you repay on schedule.',
      },
    ]
  }

  return []
}

export const stripMockSuffix = (value?: string | null) =>
  (value ?? '').replace(/\s*\(mock\)\s*$/i, '').trim()

export const getMerchantShowcaseHint = (merchant?: MerchantState | null, family?: AppFamily) => {
  const name = stripMockSuffix(merchant?.name) || 'this app'

  if (family === 'Gaming') {
    return `Pick one of these ${name} items to match the request amount to a real in-game purchase.`
  }

  if (family === 'DeFi') {
    return `Pick one of these ${name} vault routes to match the request amount to a realistic deposit size.`
  }

  return `Pick one of these ${name} drops to match the request amount to a realistic mint or collectible purchase.`
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
  stripMockSuffix(merchant?.name) || formatMerchantCategory(merchant?.category)

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

const SCAN_EXPLORER_FALLBACK_URL = 'https://lendpay.vercel.app/scan.html'

const resolveScanExplorerBaseUrl = () => {
  if (typeof window === 'undefined') {
    return SCAN_EXPLORER_FALLBACK_URL
  }

  return new URL('/scan.html', window.location.origin).toString()
}

export const buildExplorerTxUrl = (txHash?: string) => {
  const normalizedHash = txHash?.trim().replace(/^0x/i, '')
  if (!normalizedHash) return null

  const explorerUrl = new URL(resolveScanExplorerBaseUrl())
  explorerUrl.searchParams.set('tx', normalizedHash)
  return explorerUrl.toString()
}

export const formatNativeDisplay = (value?: string | null) => {
  if (!value) return '—'
  const normalized = value.replace(new RegExp(`\\b${appEnv.nativeDenom}\\b`, 'gi'), appEnv.nativeSymbol)
  return normalized
}

export const fetchTxData = async (txHash: string, rpcUrl: string): Promise<TxExplorerState> => {
  const normalizedHash = txHash.replace(/^0x/i, '')
  const fetchWithTimeout = async (url: string, timeoutMs = 5_000) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      return await fetch(url, { signal: controller.signal })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Transaction lookup timed out.')
      }

      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  try {
    const rpcResponse = await fetchWithTimeout(
      `${rpcUrl.replace(/\/$/, '')}/tx?hash=0x${normalizedHash}&prove=false`,
    )
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

  const restResponse = await fetchWithTimeout(restUrl)
  if (!restResponse.ok) {
    throw new Error(`Tx query failed with ${restResponse.status}`)
  }

  const restRaw = (await restResponse.json()) as Record<string, unknown>
  return parseRpcTx(restRaw)
}

export const dedupeApps = (apps: MerchantState[]) => {
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const uniqueApps: MerchantState[] = []

  for (const app of apps) {
    if (seenIds.has(app.id)) {
      continue
    }
    seenIds.add(app.id)

    const normalizedName = (app.name ?? '').trim().toLowerCase()
    const normalizedCategory = app.category.trim().toLowerCase()
    const nameKey = `${normalizedName}::${normalizedCategory}`

    if (seenNames.has(nameKey)) {
      continue
    }

    seenNames.add(nameKey)
    uniqueApps.push(app)
  }

  return uniqueApps
}

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
  if (!profile) {
    return 'Not available yet'
  }

  if (profile.requiresCollateral) {
    return 'Requires LEND collateral'
  }

  if (profile.minLendHoldings > 0) {
    return `Requires ${formatNumber(profile.minLendHoldings)} LEND held`
  }

  return 'Requires profile refresh'
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
