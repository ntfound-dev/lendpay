import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { isChainWriteReady } from '../../config/env'
import { formatCurrency, formatDate, formatNumber } from '../../lib/format'
import type {
  CampaignState,
  GovernanceProposalState,
  InstallmentState,
  MerchantState,
  ViralDropItemState,
} from '../../types/domain'
import { Button } from '../ui/Button'

type EcosystemFamilyStat = {
  family: string
  count: number
  liveCount: number
  headline: string
}

type GovernanceDraft = {
  proposalType: string
  title: string
  body: string
}

type CampaignDraft = {
  phase: string
  totalAllocation: string
  requiresUsername: boolean
  minimumPlatformActions: string
}

type AllocationDraft = {
  campaignId: string
  userAddress: string
  amount: string
}

type MerchantDraft = {
  merchantAddress: string
  category: string
  listingFeeBps: string
  partnerFeeBps: string
}

type FeaturedApp = {
  id: string
  name: string
  description: string
  partnerFeeBps: number
  emoji: string
  bannerClass: string
  partnerKey: string
}

type StaticDrop = {
  id: string
  artClass: string
  emoji: string
  name: string
  partner: string
  partnerLabel: string
  price: number
}

type DisplayDrop = {
  id: string
  artClass: string
  emoji: string
  name: string
  partnerLabel: string
  price: number
  viralItem: ViralDropItemState | null
}

export type ProtocolUpdateItem = {
  id: string
  kind: 'governance' | 'campaign' | 'app'
  title: string
  meta: string
  subtitle: string
  badgeTone: 'success' | 'info' | 'warning' | 'neutral' | 'danger'
  badgeLabel: string
  proposal?: GovernanceProposalState
}

type EcosystemPageProps = {
  allocationDraft: AllocationDraft
  buyingDropItemId: string | null
  campaignDraft: CampaignDraft
  campaigns: CampaignState[]
  creditLimitUsd: number | null
  ecosystemFamilyStats: EcosystemFamilyStat[]
  governance: GovernanceProposalState[]
  governanceDraft: GovernanceDraft
  handleAllocateCampaign: () => void | Promise<void>
  handleBuyViralDrop: (item: ViralDropItemState) => void | Promise<void>
  handleClaimCampaign: (campaignId: string) => void | Promise<void>
  handleCreateCampaign: () => void | Promise<void>
  handleDismissWalletRecovery: () => void | Promise<void>
  handleFinalizeProposal: (proposalId: string) => void | Promise<void>
  handleOpenWalletApproval: () => void | Promise<void>
  handleProposeGovernance: () => void | Promise<void>
  handleRegisterMerchant: () => void | Promise<void>
  handleRetryLoad: () => void | Promise<void>
  handleSetMerchantActive: (merchantId: string, active: boolean) => void | Promise<void>
  handleVoteGovernance: (proposalId: string, support: boolean) => void | Promise<void>
  isProtocolActionPending: (key: string) => boolean
  merchantDraft: MerchantDraft
  nextDueItem: InstallmentState | null
  openCampaignCount: number
  operatorModeEnabled: boolean
  protocolUpdates: ProtocolUpdateItem[]
  sectionErrors: Partial<Record<string, string>>
  setAllocationDraft: Dispatch<SetStateAction<AllocationDraft>>
  setCampaignDraft: Dispatch<SetStateAction<CampaignDraft>>
  setGovernanceDraft: Dispatch<SetStateAction<GovernanceDraft>>
  setMerchantDraft: Dispatch<SetStateAction<MerchantDraft>>
  setSelectedAppProofId: Dispatch<SetStateAction<string | null>>
  showWalletRecovery: boolean
  technicalModeEnabled: boolean
  uniqueApps: MerchantState[]
  username?: string
  viralDropItems: ViralDropItemState[]
}

const staticDrops: StaticDrop[] = [
  {
    id: 'initia-genesis-01',
    artClass: 'ecosystem-drop-card__art--purple',
    emoji: '🎨',
    name: 'Initia Genesis #01',
    partner: 'Initia Labs',
    partnerLabel: 'by Initia Labs',
    price: 0.8,
  },
  {
    id: 'atelier-drop-12',
    artClass: 'ecosystem-drop-card__art--pink',
    emoji: '🌸',
    name: 'Atelier Drop #12',
    partner: 'Initia Atelier',
    partnerLabel: 'by Initia Atelier',
    price: 1.2,
  },
  {
    id: 'arcade-pass-7',
    artClass: 'ecosystem-drop-card__art--amber',
    emoji: '⚡',
    name: 'Arcade Pass #7',
    partner: 'Arcade Mile',
    partnerLabel: 'by Arcade Mile',
    price: 0.5,
  },
]

const dropArtClasses = [
  'ecosystem-drop-card__art--purple',
  'ecosystem-drop-card__art--pink',
  'ecosystem-drop-card__art--amber',
  'ecosystem-drop-card__art--teal',
  'ecosystem-drop-card__art--blue',
]

const dropEmojis = ['🎨', '🌸', '⚡', '🎮', '🔮']

const usdPerLend = 100
const maxQuantity = 5

const formatLendAmount = (value: number) =>
  `${value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })} LEND`

const formatPartnerFee = (bps: number) =>
  `${(bps / 100).toLocaleString('en-US', {
    minimumFractionDigits: bps % 100 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`

export function EcosystemPage({
  buyingDropItemId,
  campaigns,
  creditLimitUsd,
  governance,
  handleBuyViralDrop,
  handleRetryLoad,
  isProtocolActionPending,
  nextDueItem,
  openCampaignCount,
  sectionErrors,
  uniqueApps,
  viralDropItems,
}: EcosystemPageProps) {
  const [selectedDrop, setSelectedDrop] = useState<DisplayDrop | null>(null)
  const [selectedApp, setSelectedApp] = useState<FeaturedApp | null>(null)
  const [quantity, setQuantity] = useState(1)

  const isModalOpen = selectedDrop != null || selectedApp != null

  useEffect(() => {
    if (!isModalOpen) {
      document.body.style.overflow = ''
      return
    }

    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedDrop(null)
        setSelectedApp(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isModalOpen])

  const featuredApps = useMemo((): FeaturedApp[] => {
    const curatedApps = [
      {
        key: 'initia atelier',
        fallbackName: 'Initia Atelier',
        fallbackDescription:
          'Curated collectible partner with exclusive atelier drop access through LendPay credit.',
        fallbackFeeBps: 250,
        emoji: '🎨',
        bannerClass: 'ecosystem-app-banner--atelier',
      },
      {
        key: 'arcade mile',
        fallbackName: 'Arcade Mile',
        fallbackDescription:
          'Arcade-native passes and partner exclusives that can be checked out directly with LendPay.',
        fallbackFeeBps: 200,
        emoji: '🎮',
        bannerClass: 'ecosystem-app-banner--arcade',
      },
    ]

    return curatedApps.map((app) => {
      const match =
        uniqueApps.find((item) => item.name?.toLowerCase().includes(app.key)) ??
        uniqueApps.find((item) => `${item.id} ${item.description ?? ''}`.toLowerCase().includes(app.key))

      return {
        id: match?.id ?? app.key,
        name: match?.name ?? app.fallbackName,
        description: match?.description ?? app.fallbackDescription,
        partnerFeeBps: match?.partnerFeeBps ?? app.fallbackFeeBps,
        emoji: app.emoji,
        bannerClass: app.bannerClass,
        partnerKey: app.key,
      }
    })
  }, [uniqueApps])

  const displayDrops = useMemo((): DisplayDrop[] => {
    const activeItems = viralDropItems.filter((item) => item.active)
    if (activeItems.length > 0) {
      return activeItems.map((item, i) => ({
        id: item.id,
        artClass: dropArtClasses[i % dropArtClasses.length],
        emoji: dropEmojis[i % dropEmojis.length],
        name: item.name,
        partnerLabel: `by ${item.appLabel}`,
        price: item.price,
        viralItem: item,
      }))
    }

    return staticDrops.map((drop) => ({ ...drop, viralItem: null }))
  }, [viralDropItems])

  const appsLive = sectionErrors.merchants ? null : uniqueApps.filter((app) => app.active).length || featuredApps.length
  const activeCampaigns = sectionErrors.campaigns ? null : openCampaignCount
  const proposalCount = sectionErrors.governance ? null : governance.length

  // Credit limit in LEND equivalent (for modal display)
  const availableCreditLend = creditLimitUsd !== null ? creditLimitUsd / usdPerLend : null

  const totalLend = selectedDrop ? selectedDrop.price * quantity : 0
  const totalUsd = totalLend * usdPerLend
  const estimatedMonthlyInstallment = totalUsd / 3

  const isRealDrop = selectedDrop?.viralItem != null
  const isBuying = selectedDrop != null && buyingDropItemId === selectedDrop.id

  const handleQuantityChange = (nextValue: string) => {
    const numericValue = Number(nextValue)
    if (!Number.isFinite(numericValue)) {
      setQuantity(1)
      return
    }
    setQuantity(Math.max(1, Math.min(maxQuantity, Math.floor(numericValue))))
  }

  const handleConfirmPurchase = () => {
    if (!selectedDrop) return

    if (selectedDrop.viralItem) {
      handleBuyViralDrop(selectedDrop.viralItem)
      setSelectedDrop(null)
      setQuantity(1)
      return
    }

    // Static fallback — mock checkout (no real transaction)
    setSelectedDrop(null)
    setQuantity(1)
  }

  return (
    <>
      <div className="ecosystem-redesign">
        {nextDueItem ? (
          <div className="ecosystem-alert-bar">
            <span className="ecosystem-alert-bar__dot" aria-hidden="true" />
            <span>
              Payment due — {formatCurrency(nextDueItem.amount)} due by {formatDate(nextDueItem.dueAt)}
            </span>
          </div>
        ) : null}

        <section className="ecosystem-panel">
          <div className="ecosystem-panel__header">
            <div>
              <span className="ecosystem-panel__eyebrow">Ecosystem status</span>
              <h2 className="ecosystem-panel__section-title">What is live right now</h2>
            </div>
          </div>

          <div className="ecosystem-status-grid">
            <div className="ecosystem-status-card">
              <span>Apps live</span>
              <strong className="mono">{appsLive ?? '—'}</strong>
            </div>
            <div className="ecosystem-status-card">
              <span>Active campaigns</span>
              <strong className="mono">{activeCampaigns ?? '—'}</strong>
            </div>
            <div className="ecosystem-status-card">
              <span>Governance proposals</span>
              <strong className="mono">{proposalCount ?? '—'}</strong>
            </div>
            <div className="ecosystem-status-card">
              <span>Credit mode</span>
              <strong className="ecosystem-status-card__value--blue">
                {isChainWriteReady ? 'Live' : 'Preview'}
              </strong>
            </div>
          </div>
        </section>

        <section className="ecosystem-panel ecosystem-panel--feature">
          <div className="ecosystem-panel__header ecosystem-panel__header--feature">
            <div>
              <span className="ecosystem-panel__eyebrow">Partners</span>
              <h2 className="ecosystem-panel__title">Live Apps</h2>
              <p className="ecosystem-panel__subtitle">
                Active partner apps and curated NFT drops that can be checked out with LendPay credit.
              </p>
            </div>
            <div className="ecosystem-panel__footer-left">
              <span className="ecosystem-pill ecosystem-pill--partner">Partner</span>
              <span className="ecosystem-pill ecosystem-pill--success">Checkout ready</span>
            </div>
          </div>

          {sectionErrors.merchants ? (
            <div className="ecosystem-fallback">
              <div>
                <strong>Live partner apps are unavailable right now.</strong>
                <p>{sectionErrors.merchants}</p>
              </div>
              <Button variant="secondary" onClick={handleRetryLoad}>
                Retry load
              </Button>
            </div>
          ) : (
            <>
              <div className="ecosystem-live-apps">
                {featuredApps.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    className="ecosystem-live-app-card"
                    onClick={() => setSelectedApp(app)}
                  >
                    <div className={['ecosystem-app-banner', app.bannerClass].join(' ')}>
                      <span className="ecosystem-app-banner__emoji">{app.emoji}</span>
                    </div>
                    <div className="ecosystem-live-app-card__body">
                      <h3>{app.name}</h3>
                      <p>{app.description}</p>
                      <div className="ecosystem-live-app-card__fee">
                        Partner fee: {formatPartnerFee(app.partnerFeeBps)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="ecosystem-live-apps__drops">
                <div className="ecosystem-live-apps__drops-header">
                  <div>
                    <span className="ecosystem-pill ecosystem-pill--slate">
                      {viralDropItems.length > 0 ? 'NFT Drop · Live' : 'NFT Drop · Partner Exclusive'}
                    </span>
                    <h3 className="ecosystem-live-apps__drops-title">Viral NFT Collections</h3>
                    <p className="ecosystem-panel__subtitle">
                      {viralDropItems.length > 0
                        ? 'Live drops from the protocol. Buy with LendPay credit directly.'
                        : 'Curated drops from external partners. Buy with LendPay credit directly.'}
                    </p>
                  </div>
                </div>

                <div className="ecosystem-drop-grid">
                  {displayDrops.map((drop) => (
                    <button
                      key={drop.id}
                      type="button"
                      className="ecosystem-drop-card"
                      disabled={buyingDropItemId === drop.id}
                      onClick={() => {
                        setQuantity(1)
                        setSelectedDrop(drop)
                      }}
                    >
                      <div className={['ecosystem-drop-card__art', drop.artClass].join(' ')}>
                        <span>{drop.emoji}</span>
                      </div>
                      <div className="ecosystem-drop-card__body">
                        <h3 className="ecosystem-drop-card__name">{drop.name}</h3>
                        <div className="ecosystem-drop-card__price mono">{formatLendAmount(drop.price)}</div>
                        <div className="ecosystem-drop-card__partner">{drop.partnerLabel}</div>
                        {buyingDropItemId === drop.id ? (
                          <div className="ecosystem-drop-card__buying">Purchasing…</div>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="ecosystem-panel__footer">
                  <div className="ecosystem-panel__footer-left">
                    <span className="ecosystem-pill ecosystem-pill--partner">NFT</span>
                    <span className="ecosystem-pill ecosystem-pill--success">Checkout ready</span>
                  </div>
                  <div className="ecosystem-panel__footer-copy">Use LendPay credit to buy</div>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="ecosystem-panel">
          <div className="ecosystem-panel__header">
            <div>
              <span className="ecosystem-panel__eyebrow">Live rewards</span>
              <h2 className="ecosystem-panel__section-title">Rewards</h2>
            </div>
          </div>

          {sectionErrors.campaigns ? (
            <div className="ecosystem-fallback">
              <div>
                <strong>Rewards are unavailable right now.</strong>
                <p>{sectionErrors.campaigns}</p>
              </div>
              <Button variant="secondary" onClick={handleRetryLoad}>
                Retry load
              </Button>
            </div>
          ) : activeCampaigns && activeCampaigns > 0 ? (
            <div className="ecosystem-live-rewards">
              <div className="ecosystem-live-rewards__headline">
                <span className="ecosystem-pill ecosystem-pill--success">Active</span>
                <strong>
                  {formatNumber(campaigns.length)} reward campaign{campaigns.length === 1 ? '' : 's'} live
                </strong>
              </div>
              <p>
                Campaigns are active on the protocol, while the live apps section above stays focused on partner NFT checkout.
              </p>
            </div>
          ) : (
            <div className="ecosystem-empty">
              <div className="ecosystem-empty__icon" aria-hidden="true">
                🎁
              </div>
              <strong>No live rewards right now</strong>
              <p>Partner campaigns and checkout incentives will appear here when new drops go live.</p>
            </div>
          )}
        </section>
      </div>

      {selectedApp ? (
        <div
          className="ecosystem-modal-backdrop"
          onClick={() => setSelectedApp(null)}
          role="presentation"
        >
          <div
            className="ecosystem-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ecosystemAppTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={['ecosystem-app-modal-banner', selectedApp.bannerClass].join(' ')}>
              <span className="ecosystem-app-modal-banner__emoji">{selectedApp.emoji}</span>
              <button
                type="button"
                className="ecosystem-modal__close ecosystem-modal__close--banner"
                onClick={() => setSelectedApp(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="ecosystem-modal__header">
              <div>
                <h3 className="ecosystem-modal__title" id="ecosystemAppTitle">
                  {selectedApp.name}
                </h3>
                <p className="ecosystem-modal__partner">{selectedApp.description}</p>
              </div>
            </div>

            <div className="ecosystem-modal__info-grid">
              <div className="ecosystem-modal__info-card">
                <span>Partner fee</span>
                <strong>{formatPartnerFee(selectedApp.partnerFeeBps)}</strong>
              </div>
              <div className="ecosystem-modal__info-card">
                <span>Status</span>
                <strong className="ecosystem-status-card__value--blue">Live</strong>
              </div>
            </div>

            {(() => {
              const appDrops = displayDrops.filter((drop) =>
                drop.partnerLabel.toLowerCase().includes(selectedApp.partnerKey.split(' ')[0]) ||
                drop.partnerLabel.toLowerCase().includes(selectedApp.name.toLowerCase().split(' ')[0])
              )
              if (appDrops.length === 0) return null
              return (
                <div className="ecosystem-app-modal-drops">
                  <div className="ecosystem-app-modal-drops__label">Available drops</div>
                  <div className="ecosystem-app-modal-drops__grid">
                    {appDrops.map((drop) => (
                      <button
                        key={drop.id}
                        type="button"
                        className="ecosystem-app-modal-drop"
                        onClick={() => {
                          setSelectedApp(null)
                          setQuantity(1)
                          setSelectedDrop(drop)
                        }}
                      >
                        <div className={['ecosystem-app-modal-drop__art', drop.artClass].join(' ')}>
                          <span>{drop.emoji}</span>
                        </div>
                        <div className="ecosystem-app-modal-drop__info">
                          <strong>{drop.name}</strong>
                          <span>{formatLendAmount(drop.price)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}

            <p className="ecosystem-modal__note">
              Tap a drop to check out with your LendPay credit.
            </p>
          </div>
        </div>
      ) : null}

      {selectedDrop ? (
        <div
          className="ecosystem-modal-backdrop"
          onClick={() => setSelectedDrop(null)}
          role="presentation"
        >
          <div
            className="ecosystem-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ecosystemPurchaseTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ecosystem-modal__header">
              <div>
                <h3 className="ecosystem-modal__title" id="ecosystemPurchaseTitle">
                  {selectedDrop.name}
                </h3>
                <p className="ecosystem-modal__partner">{selectedDrop.partnerLabel}</p>
              </div>
              <button
                type="button"
                className="ecosystem-modal__close"
                onClick={() => setSelectedDrop(null)}
                aria-label="Close purchase modal"
              >
                ×
              </button>
            </div>

            <div className="ecosystem-modal__info-grid">
              <div className="ecosystem-modal__info-card">
                <span>Price in LEND</span>
                <strong className="mono">{formatLendAmount(selectedDrop.price)}</strong>
              </div>
              <div className="ecosystem-modal__info-card">
                <span>Credit limit</span>
                <strong className="mono">
                  {availableCreditLend !== null ? formatLendAmount(availableCreditLend) : '—'}
                </strong>
              </div>
            </div>

            {!isRealDrop ? (
              <label className="ecosystem-modal__field">
                <span>Quantity</span>
                <input
                  type="number"
                  min="1"
                  max={maxQuantity}
                  step="1"
                  value={quantity}
                  onChange={(event) => handleQuantityChange(event.target.value)}
                  className="ecosystem-modal__input mono"
                />
              </label>
            ) : null}

            <div className="ecosystem-modal__total">
              <div>
                <span>Total</span>
                <strong className="mono">{formatLendAmount(isRealDrop ? selectedDrop.price : totalLend)}</strong>
              </div>
              <div>
                <span>Est. monthly installment</span>
                <strong className="mono">
                  {formatCurrency(isRealDrop ? (selectedDrop.price * usdPerLend) / 3 : estimatedMonthlyInstallment)}/month
                </strong>
              </div>
            </div>

            <p className="ecosystem-modal__note">
              {isRealDrop
                ? 'This will submit a live transaction to the LendPay rollup. A wallet approval prompt will follow.'
                : 'This purchase will be added to your LendPay installment plan.'}
            </p>

            <div className="ecosystem-modal__actions">
              <button
                type="button"
                className="ecosystem-button ecosystem-button--ghost"
                onClick={() => setSelectedDrop(null)}
                disabled={isBuying}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ecosystem-button ecosystem-button--primary"
                onClick={handleConfirmPurchase}
                disabled={isBuying}
              >
                {isBuying ? 'Submitting…' : 'Buy with Credit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
