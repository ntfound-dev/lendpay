import type { MerchantState, ViralDropItemState } from '../../types/domain.js'

type KnownAppRouteInput = {
  viralDropAddress?: string
  mockCabalAddress?: string
  mockYominetAddress?: string
  mockIntergazeAddress?: string
}

const normalizeAddress = (value?: string) => (value ?? '').trim().toLowerCase()
const isDefined = <T>(value: T | null | undefined): value is T => value != null

export const buildKnownAppRoutes = (input: KnownAppRouteInput): MerchantState[] => {
  const routes: Array<MerchantState | null> = [
    input.viralDropAddress
      ? {
          id: `route-${normalizeAddress(input.viralDropAddress)}`,
          name: 'Viral Drops',
          category: 'nft',
          description: 'Unlock ecosystem drops and collectible passes with approved credit.',
          contract: 'lendpay::viral_drop',
          actions: ['Mint pass', 'Join drop', 'Claim collectible'],
          merchantAddress: input.viralDropAddress,
          listingFeeBps: 0,
          partnerFeeBps: 0,
          active: true,
          partnerFeeQuote: 0,
          source: 'onchain',
        }
      : null,
    input.mockCabalAddress
      ? {
          id: `route-${normalizeAddress(input.mockCabalAddress)}`,
          name: 'Cabal Vault (Mock)',
          category: 'defi',
          description: 'Earn yield by depositing loan funds',
          contract: 'lendpay::mock_cabal',
          actions: ['Deposit', 'Earn yield', 'Withdraw'],
          merchantAddress: input.mockCabalAddress,
          listingFeeBps: 0,
          partnerFeeBps: 0,
          active: true,
          partnerFeeQuote: 0,
          source: 'onchain',
        }
      : null,
    input.mockYominetAddress
      ? {
          id: `route-${normalizeAddress(input.mockYominetAddress)}`,
          name: 'Yominet Store (Mock)',
          category: 'gaming',
          description: 'Buy Kamigotchi and game items',
          contract: 'lendpay::mock_yominet',
          actions: ['Buy item', 'Own character', 'Play'],
          merchantAddress: input.mockYominetAddress,
          listingFeeBps: 0,
          partnerFeeBps: 0,
          active: true,
          partnerFeeQuote: 0,
          source: 'onchain',
        }
      : null,
    input.mockIntergazeAddress
      ? {
          id: `route-${normalizeAddress(input.mockIntergazeAddress)}`,
          name: 'Intergaze NFT (Mock)',
          category: 'nft',
          description: 'Mint NFTs with credit',
          contract: 'lendpay::mock_intergaze',
          actions: ['Mint pass', 'Collect NFT', 'Trade'],
          merchantAddress: input.mockIntergazeAddress,
          listingFeeBps: 0,
          partnerFeeBps: 0,
          active: true,
          partnerFeeQuote: 0,
          source: 'onchain',
        }
      : null,
  ]

  return routes.filter(isDefined)
}

export const formatAppName = (merchant: MerchantState) => {
  const category = (merchant.category ?? '').toLowerCase()

  if (
    category.includes('viral') ||
    category.includes('drop') ||
    category.includes('partner_app') ||
    category.includes('marketplace')
  ) {
    return 'Viral Drops'
  }

  if (category.includes('defi') || category.includes('vault')) {
    return 'DeFi App'
  }

  if (category.includes('gaming') || category.includes('game')) {
    return 'Gaming App'
  }

  if (category.includes('nft')) {
    return 'NFT App'
  }

  return merchant.name ?? 'Initia App'
}

export const enrichOnchainMerchant = (
  merchant: MerchantState,
  knownRoute?: MerchantState | null,
): MerchantState => ({
  ...merchant,
  name: knownRoute?.name ?? merchant.name ?? formatAppName(merchant),
  category: knownRoute?.category ?? merchant.category,
  description:
    knownRoute?.description ??
    merchant.description ??
    ((merchant.category ?? '').toLowerCase().includes('viral') ||
    (merchant.category ?? '').toLowerCase().includes('drop')
      ? 'Mint ecosystem drops and collectible passes with approved credit.'
      : 'Use approved credit in a live Initia app route.'),
  contract: knownRoute?.contract ?? merchant.contract ?? merchant.merchantAddress,
  actions:
    knownRoute?.actions ??
    merchant.actions ??
    ((merchant.category ?? '').toLowerCase().includes('viral') ||
    (merchant.category ?? '').toLowerCase().includes('drop')
      ? ['Mint pass', 'Join drop', 'Claim collectible']
      : ['Use app', 'Unlock access', 'Repay later']),
  source: 'onchain',
})

export const dedupeApps = (apps: MerchantState[]) => {
  const uniqueById = apps.filter(
    (app, index, self) => index === self.findIndex((entry) => entry.id === app.id),
  )

  return uniqueById.filter(
    (app, index, self) =>
      index ===
      self.findIndex((entry) => {
        const sameAddress =
          normalizeAddress(entry.merchantAddress) !== '' &&
          normalizeAddress(entry.merchantAddress) === normalizeAddress(app.merchantAddress)
        const sameNameAndCategory =
          (entry.name ?? '').trim().toLowerCase() === (app.name ?? '').trim().toLowerCase() &&
          (entry.category ?? '').trim().toLowerCase() === (app.category ?? '').trim().toLowerCase()

        return sameAddress || sameNameAndCategory
      }),
  )
}

export const createViralDropApps = (items: ViralDropItemState[]): MerchantState[] => {
  const grouped = new Map<string, ViralDropItemState[]>()

  for (const item of items) {
    const merchantId = item.merchantId?.trim()
    if (!merchantId) continue

    const current = grouped.get(merchantId) ?? []
    current.push(item)
    grouped.set(merchantId, current)
  }

  return Array.from(grouped.entries()).map(([merchantId, merchantItems]) => ({
    id: merchantId,
    name: merchantItems[0]?.appLabel || 'Viral Drops',
    category: 'nft',
    description: 'Mint live ecosystem drops and collectible passes with approved credit.',
    contract: merchantItems[0]?.merchantAddress,
    actions: ['Mint pass', 'Join drop', 'Claim collectible'],
    merchantAddress: merchantItems[0]?.merchantAddress ?? '',
    listingFeeBps: 0,
    partnerFeeBps: 0,
    active: true,
    partnerFeeQuote: 0,
    source: 'onchain',
  }))
}
