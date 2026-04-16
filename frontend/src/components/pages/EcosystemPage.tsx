import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { isChainWriteReady } from '../../config/env'
import { formatCurrency, formatNumber } from '../../lib/format'
import type {
  CampaignState,
  GovernanceProposalState,
  MerchantState,
} from '../../types/domain'
import { EmptyState } from '../shared/EmptyState'
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

type PartnerDrop = {
  id: string
  artClass: string
  emoji: string
  name: string
  partner: string
  partnerLabel: string
  price: number
}

type PurchaseToast = {
  id: number
  message: string
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
  campaignDraft: CampaignDraft
  campaigns: CampaignState[]
  ecosystemFamilyStats: EcosystemFamilyStat[]
  governance: GovernanceProposalState[]
  governanceDraft: GovernanceDraft
  handleAllocateCampaign: () => void | Promise<void>
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
}

const partnerDrops: PartnerDrop[] = [
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
  campaigns,
  governance,
  handleRetryLoad,
  isProtocolActionPending,
  openCampaignCount,
  sectionErrors,
  uniqueApps,
}: EcosystemPageProps) {
  const [selectedDrop, setSelectedDrop] = useState<PartnerDrop | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [availableCredit, setAvailableCredit] = useState(3250)
  const [toasts, setToasts] = useState<PurchaseToast[]>([])

  useEffect(() => {
    if (!selectedDrop) {
      document.body.style.overflow = ''
      return
    }

    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedDrop(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedDrop])

  const featuredApps = useMemo(() => {
    const curatedApps = [
      {
        key: 'initia atelier',
        fallbackName: 'Initia Atelier',
        fallbackDescription:
          'Curated collectible partner with exclusive atelier drop access through LendPay credit.',
        fallbackFeeBps: 250,
      },
      {
        key: 'arcade mile',
        fallbackName: 'Arcade Mile',
        fallbackDescription:
          'Arcade-native passes and partner exclusives that can be checked out directly with LendPay.',
        fallbackFeeBps: 200,
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
      }
    })
  }, [uniqueApps])

  const appsLive = sectionErrors.merchants ? null : uniqueApps.filter((app) => app.active).length || featuredApps.length
  const activeCampaigns = sectionErrors.campaigns ? null : openCampaignCount
  const proposalCount = sectionErrors.governance ? null : governance.length

  const totalLend = selectedDrop ? selectedDrop.price * quantity : 0
  const estimatedMonthlyInstallment = (totalLend * usdPerLend) / 3
  const pushToast = (message: string) => {
    const toastId = Date.now()
    setToasts((current) => [...current, { id: toastId, message }])

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== toastId))
    }, 3000)
  }

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

    const monthlyInstallment = (selectedDrop.price * quantity * usdPerLend) / 3
    setAvailableCredit((current) => Math.max(0, current - selectedDrop.price * quantity))
    pushToast(
      `✅ Purchase confirmed! ${selectedDrop.name} added to your wallet. Installment of ${formatCurrency(monthlyInstallment)}/month added to your repayment schedule.`,
    )
    setSelectedDrop(null)
    setQuantity(1)
  }

  return (
    <>
      <div className="ecosystem-redesign">
        <div className="ecosystem-alert-bar">
          <span className="ecosystem-alert-bar__dot" aria-hidden="true" />
          <span>Repayment watch — Next installment $75 is due by Jul 12.</span>
        </div>

        <section className="ecosystem-panel ecosystem-panel--feature">
          <div className="ecosystem-panel__header ecosystem-panel__header--feature">
            <div>
              <span className="ecosystem-pill ecosystem-pill--slate">NFT Drop · Partner Exclusive</span>
              <h2 className="ecosystem-panel__title">Viral NFT Collections</h2>
              <p className="ecosystem-panel__subtitle">
                Curated drops from external partners. Buy with LendPay credit directly.
              </p>
            </div>
            <span className="ecosystem-pill ecosystem-pill--partner">Partner</span>
          </div>

          <div className="ecosystem-drop-grid">
            {partnerDrops.map((drop) => (
              <button
                key={drop.id}
                type="button"
                className="ecosystem-drop-card"
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
        </section>

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

        <section className="ecosystem-panel">
          <div className="ecosystem-panel__header">
            <div>
              <span className="ecosystem-panel__eyebrow">Partners</span>
              <h2 className="ecosystem-panel__section-title">Live Apps</h2>
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
            <div className="ecosystem-live-apps">
              {featuredApps.map((app) => (
                <div key={app.id} className="ecosystem-live-app-card">
                  <h3>{app.name}</h3>
                  <p>{app.description}</p>
                  <div className="ecosystem-live-app-card__fee">
                    Partner fee: {formatPartnerFee(app.partnerFeeBps)}
                  </div>
                </div>
              ))}
            </div>
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
                Campaigns are active on the protocol, while the top of this page stays focused on partner NFT checkout.
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
                <span>Available credit</span>
                <strong className="mono">{formatLendAmount(availableCredit)}</strong>
              </div>
            </div>

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

            <div className="ecosystem-modal__total">
              <div>
                <span>Live total</span>
                <strong className="mono">{formatLendAmount(totalLend)}</strong>
              </div>
              <div>
                <span>Estimated installment</span>
                <strong className="mono">{formatCurrency(estimatedMonthlyInstallment)}/month</strong>
              </div>
            </div>

            <p className="ecosystem-modal__note">
              This purchase will be added to your LendPay installment plan.
            </p>

            <div className="ecosystem-modal__actions">
              <button
                type="button"
                className="ecosystem-button ecosystem-button--ghost"
                onClick={() => setSelectedDrop(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ecosystem-button ecosystem-button--primary"
                onClick={handleConfirmPurchase}
              >
                Buy with Credit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="ecosystem-toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="ecosystem-toast">
            {toast.message}
          </div>
        ))}
      </div>
    </>
  )
}
