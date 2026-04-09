import { useState, type Dispatch, type SetStateAction } from 'react'
import { appEnv, isChainWriteReady } from '../../config/env'
import {
  appCategoryMeta,
  describeCampaign,
  formatAppLabel,
  getCampaignIneligibleReason,
} from '../../lib/appHelpers'
import { formatCurrency, formatDate, formatNumber, shortenAddress } from '../../lib/format'
import type {
  CampaignState,
  GovernanceProposalState,
  LendLiquidityRouteState,
  MerchantState,
} from '../../types/domain'
import { EmptyState } from '../shared/EmptyState'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

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
  bridgeAmount: string
  bridgeRecipient: string
  campaignDraft: CampaignDraft
  campaigns: CampaignState[]
  ecosystemFamilyStats: EcosystemFamilyStat[]
  governance: GovernanceProposalState[]
  governanceDraft: GovernanceDraft
  handleAllocateCampaign: () => void | Promise<void>
  handleClaimCampaign: (campaignId: string) => void | Promise<void>
  handleCreateCampaign: () => void | Promise<void>
  handleDismissWalletRecovery: () => void | Promise<void>
  handleOpenLendBridge: () => void | Promise<void>
  handleFinalizeProposal: (proposalId: string) => void | Promise<void>
  handleOpenWalletApproval: () => void | Promise<void>
  handleProposeGovernance: () => void | Promise<void>
  handleRegisterMerchant: () => void | Promise<void>
  handleRetryLoad: () => void | Promise<void>
  handleSetMerchantActive: (merchantId: string, active: boolean) => void | Promise<void>
  handleVoteGovernance: (proposalId: string, support: boolean) => void | Promise<void>
  isProtocolActionPending: (key: string) => boolean
  lendLiquidityRoute: LendLiquidityRouteState | null
  merchantDraft: MerchantDraft
  openCampaignCount: number
  operatorModeEnabled: boolean
  protocolUpdates: ProtocolUpdateItem[]
  sectionErrors: Partial<Record<string, string>>
  setAllocationDraft: Dispatch<SetStateAction<AllocationDraft>>
  setBridgeAmount: Dispatch<SetStateAction<string>>
  setBridgeRecipient: Dispatch<SetStateAction<string>>
  setCampaignDraft: Dispatch<SetStateAction<CampaignDraft>>
  setGovernanceDraft: Dispatch<SetStateAction<GovernanceDraft>>
  setMerchantDraft: Dispatch<SetStateAction<MerchantDraft>>
  setSelectedAppProofId: Dispatch<SetStateAction<string | null>>
  showWalletRecovery: boolean
  technicalModeEnabled: boolean
  uniqueApps: MerchantState[]
  username?: string
}

export function EcosystemPage({
  allocationDraft,
  bridgeAmount,
  bridgeRecipient,
  campaignDraft,
  campaigns,
  ecosystemFamilyStats,
  governance,
  governanceDraft,
  handleAllocateCampaign,
  handleClaimCampaign,
  handleCreateCampaign,
  handleDismissWalletRecovery,
  handleOpenLendBridge,
  handleFinalizeProposal,
  handleOpenWalletApproval,
  handleProposeGovernance,
  handleRegisterMerchant,
  handleRetryLoad,
  handleSetMerchantActive,
  handleVoteGovernance,
  isProtocolActionPending,
  lendLiquidityRoute,
  merchantDraft,
  openCampaignCount,
  operatorModeEnabled,
  protocolUpdates,
  sectionErrors,
  setAllocationDraft,
  setBridgeAmount,
  setBridgeRecipient,
  setCampaignDraft,
  setGovernanceDraft,
  setMerchantDraft,
  setSelectedAppProofId,
  showWalletRecovery,
  technicalModeEnabled,
  uniqueApps,
  username,
}: EcosystemPageProps) {
  const [copiedRecipient, setCopiedRecipient] = useState(false)
  const bridgeAmountValue = Number(bridgeAmount)
  const normalizedBridgeAmount =
    Number.isFinite(bridgeAmountValue) && bridgeAmountValue > 0 ? bridgeAmountValue : 0
  const estimatedReceiveAmount = normalizedBridgeAmount
  const estimatedUsdValue = estimatedReceiveAmount * (lendLiquidityRoute?.oracleQuote.price ?? 0)
  const bridgeLastUpdated = lendLiquidityRoute
    ? formatDate(lendLiquidityRoute.oracleQuote.blockTimestamp ?? lendLiquidityRoute.oracleQuote.fetchedAt)
    : ''
  const bridgeRouteLine = lendLiquidityRoute
    ? `${lendLiquidityRoute.sourceChainName} → ${lendLiquidityRoute.destinationChainName} via InterwovenKit`
    : ''
  const isBridgeActive = lendLiquidityRoute?.routeMode === 'live'

  const handleCopyRecipient = async () => {
    const recipient = bridgeRecipient.trim()
    if (!recipient || typeof navigator === 'undefined' || !navigator.clipboard) {
      return
    }

    try {
      await navigator.clipboard.writeText(recipient)
      setCopiedRecipient(true)
      window.setTimeout(() => setCopiedRecipient(false), 1200)
    } catch {
      setCopiedRecipient(false)
    }
  }

  return (
    <>
      <Card eyebrow="Ecosystem status" title="What is live right now" className="admin-card">
        <div className="protocol-status-grid">
          <div className="protocol-status-item">
            <span>Apps live</span>
            <strong>{sectionErrors.merchants ? '—' : uniqueApps.length}</strong>
            <small>
              {sectionErrors.merchants
                ? 'Apps unavailable'
                : uniqueApps.length
                  ? 'Apps available'
                  : 'No apps yet'}
            </small>
          </div>
          <div className="protocol-status-item">
            <span>Active campaigns</span>
            <strong>{sectionErrors.campaigns ? '—' : openCampaignCount}</strong>
            <small>
              {sectionErrors.campaigns
                ? 'Reward campaigns unavailable'
                : openCampaignCount
                  ? 'Borrower rewards are live'
                  : 'No live campaign yet'}
            </small>
          </div>
          <div className="protocol-status-item">
            <span>Governance proposals</span>
            <strong>{sectionErrors.governance ? '—' : governance.length}</strong>
            <small>
              {sectionErrors.governance
                ? 'Governance activity unavailable'
                : governance.length
                  ? 'Proposal history visible'
                  : 'No proposal yet'}
            </small>
          </div>
          <div className="protocol-status-item">
            <span>Credit mode</span>
            <strong>{isChainWriteReady ? 'Live' : 'Preview'}</strong>
            <small>{isChainWriteReady ? 'Borrower flow ready' : 'Chain target not configured'}</small>
          </div>
        </div>
      </Card>

      <Card className="bridge-card section-stack">
        {lendLiquidityRoute ? (
          <>
            <div className="bridge-card__header">
              <div className="bridge-card__headline">
                <div className="bridge-card__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M7 8h10" strokeLinecap="round" />
                    <path d="m13.5 4.5 3.5 3.5-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M17 16H7" strokeLinecap="round" />
                    <path d="m10.5 12.5-3.5 3.5 3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="bridge-card__kicker">Bridge</div>
                  <h3 className="bridge-card__title">Bridge LEND → Initia MiniEVM</h3>
                </div>
              </div>
              <div
                className={[
                  'bridge-card__status',
                  isBridgeActive ? 'bridge-card__status--active' : 'bridge-card__status--pending',
                ].join(' ')}
              >
                <span className="bridge-card__status-dot" aria-hidden="true" />
                {isBridgeActive ? 'Active' : 'Preview'}
              </div>
            </div>

            <p className="bridge-card__route">{bridgeRouteLine}</p>
            <div className="bridge-card__divider" />

            <div className="bridge-card__fields">
              <div className="bridge-card__field">
                <label className="bridge-card__label" htmlFor="bridgeAmount">
                  Amount (LEND)
                </label>
                <input
                  className="bridge-card__input bridge-card__input--mono"
                  id="bridgeAmount"
                  type="number"
                  min="1"
                  step="1"
                  value={bridgeAmount}
                  onChange={(event) => setBridgeAmount(event.target.value)}
                  placeholder="250"
                />
              </div>
              <div className="bridge-card__field">
                <label className="bridge-card__label" htmlFor="bridgeRecipient">
                  Recipient address
                </label>
                <div className="bridge-card__input-shell">
                  <input
                    className="bridge-card__input bridge-card__input--mono bridge-card__input--copyable"
                    id="bridgeRecipient"
                    value={bridgeRecipient}
                    onChange={(event) => setBridgeRecipient(event.target.value)}
                    placeholder="Defaults to the connected wallet"
                  />
                  <button
                    type="button"
                    className={[
                      'bridge-card__copy',
                      copiedRecipient ? 'bridge-card__copy--copied' : '',
                    ].join(' ')}
                    onClick={() => void handleCopyRecipient()}
                    aria-label="Copy recipient address"
                    title={copiedRecipient ? 'Copied' : 'Copy recipient address'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="9" y="9" width="10" height="10" rx="2" />
                      <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="bridge-card__output">
              <span className="bridge-card__output-label">You receive:</span>
              <strong className="bridge-card__output-value">
                {formatNumber(estimatedReceiveAmount)} INIT
                <span>≈ {formatCurrency(estimatedUsdValue)}</span>
              </strong>
            </div>

            <div className="bridge-card__actions">
              <Button
                className="bridge-card__cta"
                onClick={handleOpenLendBridge}
                wide
                disabled={
                  lendLiquidityRoute.routeMode !== 'live' ||
                  isProtocolActionPending('bridge-intent')
                }
              >
                {isProtocolActionPending('bridge-intent') ? 'Bridging...' : 'Bridge Now'}
              </Button>
            </div>

            <div className="bridge-card__footer">
              <span>
                Reference price <strong className="bridge-card__mono">{formatCurrency(lendLiquidityRoute.oracleQuote.price)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Last updated <strong className="bridge-card__mono">{bridgeLastUpdated}</strong>
              </span>
            </div>
          </>
        ) : (
          <EmptyState
            title="Bridge status unavailable"
            subtitle={
              sectionErrors.liquidity ??
              'Refresh your account to load the current LEND bridge route and official price reference.'
            }
            actionLabel="Retry load"
            onAction={handleRetryLoad}
          />
        )}
      </Card>

      {technicalModeEnabled ? (
        <Card eyebrow="Technical details" title="Local protocol target" className="admin-card section-stack">
          <div className="summary">
            <div className="summary-row">
              <span>Rollup chain</span>
              <strong>{appEnv.appchainId}</strong>
            </div>
            <div className="summary-row">
              <span>Package address</span>
              <strong>{appEnv.packageAddress || 'Not set'}</strong>
            </div>
            <div className="summary-row">
              <span>Smart contract module</span>
              <strong>{appEnv.loanModuleName}</strong>
            </div>
            <div className="summary-row">
              <span>Write mode</span>
              <strong>{isChainWriteReady ? 'Live transaction' : 'Chain target not configured'}</strong>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid--2 section-stack">
        <Card eyebrow="Apps demo" title="Apps available with credit" className="story-card">
          {sectionErrors.merchants ? (
            <EmptyState
              title="Apps unavailable"
              subtitle={sectionErrors.merchants}
              actionLabel="Retry load"
              onAction={handleRetryLoad}
            />
          ) : uniqueApps.length ? (
            <>
              <div className="app-family-grid">
                {ecosystemFamilyStats.map((item) => (
                  <div className="app-family-card" key={item.family}>
                    <span>{item.family}</span>
                    <strong>{item.count}</strong>
                    <small>
                      {item.liveCount} live · {item.headline}
                    </small>
                  </div>
                ))}
                <div className="ecosystem-next-card">
                  <span className="ecosystem-next-card__label">Next integration</span>
                  <strong>Inertia Protocol</strong>
                  <p>
                    Undercollateralized lending meets AI credit scoring. LendPay users will access
                    Inertia liquidity pools without collateral requirements.
                  </p>
                  <span className="ecosystem-next-badge">In discussion</span>
                </div>
              </div>
              <div className="merchant-partner-grid">
                {uniqueApps.map((merchant) => (
                  <div className="merchant-partner-card" key={merchant.id}>
                    <div className="merchant-partner-card__head">
                      <div>
                        <span className="merchant-partner-card__eyebrow">Live app</span>
                        <div className="request-row__title">{formatAppLabel(merchant)}</div>
                      </div>
                      <div className="merchant-partner-card__badges">
                        <Badge tone="info">{appCategoryMeta(merchant.category).family}</Badge>
                        <Badge tone={merchant.active ? 'success' : 'warning'}>
                          {merchant.active ? 'active' : 'inactive'}
                        </Badge>
                      </div>
                    </div>
                    <p className="merchant-partner-card__description">
                      {merchant.description ?? appCategoryMeta(merchant.category).description}
                    </p>
                    <div className="merchant-partner-card__use-cases">
                      {(merchant.actions?.length
                        ? merchant.actions
                        : appCategoryMeta(merchant.category).examples
                      ).map((example) => (
                        <span className="merchant-partner-card__use-chip" key={`${merchant.id}-${example}`}>
                          {example}
                        </span>
                      ))}
                    </div>
                    <div className="summary merchant-partner-card__summary">
                      <div className="summary-row">
                        <span>{merchant.source === 'mock' ? 'Contract route' : 'Destination wallet'}</span>
                        <strong>
                          {merchant.source === 'mock'
                            ? merchant.contract ?? merchant.merchantAddress
                            : shortenAddress(merchant.merchantAddress)}
                        </strong>
                      </div>
                      <div className="summary-row">
                        <span>Use with LendPay</span>
                        <strong>Available in checkout request</strong>
                      </div>
                      <div className="summary-row">
                        <span>Extra fee</span>
                        <strong>
                          {merchant.partnerFeeBps > 0
                            ? `${merchant.partnerFeeBps / 100}%`
                            : 'No extra fee'}
                        </strong>
                      </div>
                    </div>
                    {merchant.proof ? (
                      <div className="merchant-partner-card__foot merchant-partner-card__foot--public">
                        <Button variant="secondary" onClick={() => setSelectedAppProofId(merchant.id)}>
                          View testnet proof
                        </Button>
                        <span className="merchant-partner-card__proof-note">
                          Route #{merchant.proof.merchantId} is live on {merchant.proof.chainId}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="No Initia apps yet"
              subtitle="Apps will appear here once a live route is registered onchain."
            />
          )}
        </Card>

        <Card eyebrow="Live rewards" title="Borrower bonuses and promos" className="story-card">
          {sectionErrors.campaigns ? (
            <EmptyState
              title="Live rewards unavailable"
              subtitle={sectionErrors.campaigns}
              actionLabel="Retry load"
              onAction={handleRetryLoad}
            />
          ) : campaigns.length ? (
            <div className="campaign-list">
              {campaigns.map((campaign) => {
                const campaignCopy = describeCampaign(campaign)
                const ineligibleReason = campaign.canClaim
                  ? null
                  : getCampaignIneligibleReason(campaign, username)
                const showClaimButton = campaign.claimableAmount > 0
                const canShowEnabledClaim = showClaimButton && campaign.canClaim

                return (
                  <div className="campaign-row" key={campaign.id}>
                    <div className="campaign-row__header">
                      <div>
                        <div className="request-row__title">{campaignCopy.title}</div>
                        <div className="muted-copy">{campaignCopy.description}</div>
                      </div>
                      <Badge tone={campaign.status === 'open' ? 'success' : 'warning'}>
                        {campaign.status}
                      </Badge>
                    </div>
                    <div className="campaign-row__meta">
                      Phase {campaign.phase} · Allocation {formatNumber(campaign.totalAllocation)} ·
                      Claimed {formatNumber(campaign.totalClaimed)}
                    </div>
                    <div className="campaign-row__footer">
                      <div className="campaign-row__claimable">
                        <span>Claimable now</span>
                        <strong>{formatNumber(campaign.claimableAmount)}</strong>
                      </div>
                      <div className="campaign-row__actions">
                        <Badge tone={campaign.status === 'open' ? 'success' : 'warning'}>
                          {campaign.canClaim ? 'Eligible' : 'Not eligible'}
                        </Badge>
                        {showClaimButton ? (
                          <Button
                            variant="secondary"
                            title={!canShowEnabledClaim ? ineligibleReason ?? undefined : undefined}
                            onClick={() => handleClaimCampaign(campaign.id)}
                            disabled={
                              !canShowEnabledClaim ||
                              isProtocolActionPending(`campaign-${campaign.id}`)
                            }
                          >
                            {isProtocolActionPending(`campaign-${campaign.id}`)
                              ? 'Claiming...'
                              : `Claim ${formatNumber(campaign.claimableAmount)} LEND`}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {!campaign.canClaim ? (
                      <div className="campaign-row__reason">{ineligibleReason}</div>
                    ) : null}
                  </div>
                )
              })}
              {showWalletRecovery ? (
                <div className="wallet-recovery">
                  <p>Wallet is still loading. Reconnect the Interwoven wallet, then try the campaign claim again.</p>
                  <div className="wallet-recovery__actions">
                    <Button onClick={handleOpenWalletApproval}>Reconnect wallet</Button>
                    <Button variant="secondary" onClick={handleDismissWalletRecovery}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="No live rewards right now"
              subtitle="New borrower bonuses, repayment rewards, and seasonal promos will appear here."
            />
          )}
        </Card>
      </div>

      {operatorModeEnabled ? (
        <>
          <div className="page__heading section-stack">
            <div>
              <h3 className="page__title">Local operator actions</h3>
              <p className="page__subtitle">
                These controls exist for local operator work so the protocol owner can seed apps,
                launch campaigns, and submit governance actions from the same app.
              </p>
            </div>
          </div>

          <div className="grid--2">
            <Card eyebrow="Governance" title="Propose a protocol change" className="story-card">
              <p className="muted-copy">
                This is the operator action for creating a governance proposal from the same app.
              </p>
              <div className="field">
                <label htmlFor="proposalType">Proposal type</label>
                <input
                  id="proposalType"
                  type="number"
                  min="1"
                  value={governanceDraft.proposalType}
                  onChange={(event) =>
                    setGovernanceDraft((current) => ({ ...current, proposalType: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="proposalTitle">Title</label>
                <input
                  id="proposalTitle"
                  value={governanceDraft.title}
                  onChange={(event) =>
                    setGovernanceDraft((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="proposalBody">Body</label>
                <input
                  id="proposalBody"
                  value={governanceDraft.body}
                  onChange={(event) =>
                    setGovernanceDraft((current) => ({ ...current, body: event.target.value }))
                  }
                />
              </div>
              <div className="card-action-row">
                <Button
                  onClick={handleProposeGovernance}
                  disabled={isProtocolActionPending('governance-propose')}
                >
                  {isProtocolActionPending('governance-propose') ? 'Submitting...' : 'Submit proposal'}
                </Button>
              </div>
            </Card>

            <Card eyebrow="Reward campaigns" title="Live borrower incentive programs" className="story-card">
              <p className="muted-copy">
                Campaigns are public reward pools for borrowers. This card also lets the operator
                create and fund them.
              </p>
              <div className="field">
                <label htmlFor="campaignPhase">Phase</label>
                <input
                  id="campaignPhase"
                  type="number"
                  min="1"
                  value={campaignDraft.phase}
                  onChange={(event) =>
                    setCampaignDraft((current) => ({ ...current, phase: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="campaignAllocation">Total allocation</label>
                <input
                  id="campaignAllocation"
                  type="number"
                  min="1"
                  value={campaignDraft.totalAllocation}
                  onChange={(event) =>
                    setCampaignDraft((current) => ({ ...current, totalAllocation: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="campaignMinimumActions">Minimum platform actions</label>
                <input
                  id="campaignMinimumActions"
                  type="number"
                  min="0"
                  value={campaignDraft.minimumPlatformActions}
                  onChange={(event) =>
                    setCampaignDraft((current) => ({
                      ...current,
                      minimumPlatformActions: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="card-action-row">
                <Button
                  onClick={handleCreateCampaign}
                  disabled={isProtocolActionPending('campaign-create')}
                >
                  {isProtocolActionPending('campaign-create') ? 'Creating...' : 'Create campaign'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setCampaignDraft((current) => ({
                      ...current,
                      requiresUsername: !current.requiresUsername,
                    }))
                  }
                >
                  {campaignDraft.requiresUsername ? 'Require .init username' : 'Username optional'}
                </Button>
              </div>
              <div className="field">
                <label htmlFor="allocationCampaignId">Campaign id</label>
                <input
                  id="allocationCampaignId"
                  type="number"
                  min="1"
                  value={allocationDraft.campaignId}
                  onChange={(event) =>
                    setAllocationDraft((current) => ({ ...current, campaignId: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="allocationUserAddress">Recipient address</label>
                <input
                  id="allocationUserAddress"
                  value={allocationDraft.userAddress}
                  onChange={(event) =>
                    setAllocationDraft((current) => ({ ...current, userAddress: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="allocationAmount">Allocation amount</label>
                <input
                  id="allocationAmount"
                  type="number"
                  min="1"
                  value={allocationDraft.amount}
                  onChange={(event) =>
                    setAllocationDraft((current) => ({ ...current, amount: event.target.value }))
                  }
                />
              </div>
              <div className="card-action-row">
                <Button
                  onClick={handleAllocateCampaign}
                  disabled={isProtocolActionPending('campaign-allocate')}
                >
                  {isProtocolActionPending('campaign-allocate') ? 'Allocating...' : 'Allocate claim'}
                </Button>
              </div>
            </Card>
          </div>

          <div className="grid--2">
            <Card eyebrow="App network" title="Live Initia apps" className="story-card">
              <p className="muted-copy">
                Initia apps are the real routes for borrower credit. Borrowers see these apps in the
                request flow, and the same card lets the operator add more of them.
              </p>
              <div className="field">
                <label htmlFor="merchantAddress">Payout address</label>
                <input
                  id="merchantAddress"
                  value={merchantDraft.merchantAddress}
                  onChange={(event) =>
                    setMerchantDraft((current) => ({ ...current, merchantAddress: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="merchantCategory">Category</label>
                <input
                  id="merchantCategory"
                  value={merchantDraft.category}
                  onChange={(event) =>
                    setMerchantDraft((current) => ({ ...current, category: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="merchantListingFee">Listing fee bps</label>
                <input
                  id="merchantListingFee"
                  type="number"
                  min="0"
                  value={merchantDraft.listingFeeBps}
                  onChange={(event) =>
                    setMerchantDraft((current) => ({ ...current, listingFeeBps: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="merchantPartnerFee">Partner fee bps</label>
                <input
                  id="merchantPartnerFee"
                  type="number"
                  min="0"
                  value={merchantDraft.partnerFeeBps}
                  onChange={(event) =>
                    setMerchantDraft((current) => ({ ...current, partnerFeeBps: event.target.value }))
                  }
                />
              </div>
              <div className="card-action-row">
                <Button
                  onClick={handleRegisterMerchant}
                  disabled={isProtocolActionPending('merchant-create')}
                >
                  {isProtocolActionPending('merchant-create') ? 'Registering...' : 'Register app'}
                </Button>
              </div>
              {uniqueApps.length ? (
                <div className="merchant-partner-grid">
                  {uniqueApps.map((merchant) => (
                    <div className="merchant-partner-card" key={merchant.id}>
                      <div className="merchant-partner-card__head">
                        <div>
                          <span className="merchant-partner-card__eyebrow">App #{merchant.id}</span>
                          <div className="request-row__title">{formatAppLabel(merchant)}</div>
                        </div>
                        <div className="merchant-partner-card__badges">
                          <Badge tone="info">{appCategoryMeta(merchant.category).family}</Badge>
                          <Badge tone={merchant.active ? 'success' : 'warning'}>
                            {merchant.active ? 'active' : 'inactive'}
                          </Badge>
                        </div>
                      </div>
                      <p className="merchant-partner-card__description">
                        {merchant.description ?? appCategoryMeta(merchant.category).description}
                      </p>
                      <div className="merchant-partner-card__use-cases">
                        {(merchant.actions?.length
                          ? merchant.actions
                          : appCategoryMeta(merchant.category).examples
                        ).map((example) => (
                          <span className="merchant-partner-card__use-chip" key={`${merchant.id}-${example}`}>
                            {example}
                          </span>
                        ))}
                      </div>
                      <div className="summary merchant-partner-card__summary">
                        <div className="summary-row">
                          <span>{merchant.source === 'mock' ? 'Contract' : 'Wallet'}</span>
                          <strong>
                            {merchant.source === 'mock'
                              ? merchant.contract ?? merchant.merchantAddress
                              : shortenAddress(merchant.merchantAddress)}
                          </strong>
                        </div>
                        <div className="summary-row">
                          <span>Partner fee</span>
                          <strong>{merchant.partnerFeeBps / 100}%</strong>
                        </div>
                        <div className="summary-row">
                          <span>Live quote</span>
                          <strong>{formatNumber(merchant.partnerFeeQuote)}</strong>
                        </div>
                        <div className="summary-row">
                          <span>Route</span>
                          <strong>
                            {merchant.source === 'mock' ? 'Preview app catalog' : 'Live borrower destination'}
                          </strong>
                        </div>
                      </div>
                      <div className="merchant-partner-card__foot">
                        {merchant.source === 'onchain' ? (
                          <Button
                            variant="secondary"
                            onClick={() => handleSetMerchantActive(merchant.id, !merchant.active)}
                            disabled={isProtocolActionPending(
                              `merchant-active-${merchant.id}-${merchant.active ? 'off' : 'on'}`,
                            )}
                          >
                            {isProtocolActionPending(
                              `merchant-active-${merchant.id}-${merchant.active ? 'off' : 'on'}`,
                            )
                              ? 'Updating...'
                              : merchant.active
                                ? 'Deactivate'
                                : 'Activate'}
                          </Button>
                        ) : (
                          <Badge tone="info">Seeded mock app</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-copy">No Initia apps are registered onchain yet.</p>
              )}
            </Card>
          </div>
        </>
      ) : null}

      <Card eyebrow="Protocol updates" title="Recent protocol decisions" className="grid section-stack">
        {sectionErrors.governance ? (
          <EmptyState
            title="Protocol updates unavailable"
            subtitle={sectionErrors.governance}
            actionLabel="Retry load"
            onAction={handleRetryLoad}
          />
        ) : protocolUpdates.length ? (
          <div className="request-list">
            {protocolUpdates.map((update) => (
              <div className="request-row" key={update.id}>
                <div>
                  <div className="request-row__title">{update.title}</div>
                  <div className="muted-copy">{update.meta}</div>
                  <div className="muted-copy">{update.subtitle}</div>
                </div>
                <div className="schedule__right">
                  <Badge tone={update.badgeTone}>{update.badgeLabel}</Badge>
                  {update.kind === 'governance' && update.proposal ? (
                    (() => {
                      const proposal = update.proposal

                      return (
                        <div className="card-action-row">
                          <Button
                            variant="secondary"
                            onClick={() => handleVoteGovernance(proposal.id, true)}
                            disabled={
                              proposal.status !== 'open' ||
                              proposal.hasVoted ||
                              isProtocolActionPending(`vote-${proposal.id}-yes`)
                            }
                          >
                            {isProtocolActionPending(`vote-${proposal.id}-yes`) ? 'Voting...' : 'Vote yes'}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleVoteGovernance(proposal.id, false)}
                            disabled={
                              proposal.status !== 'open' ||
                              proposal.hasVoted ||
                              isProtocolActionPending(`vote-${proposal.id}-no`)
                            }
                          >
                            {isProtocolActionPending(`vote-${proposal.id}-no`) ? 'Voting...' : 'Vote no'}
                          </Button>
                          <Button
                            onClick={() => handleFinalizeProposal(proposal.id)}
                            disabled={
                              proposal.status !== 'open' ||
                              isProtocolActionPending(`finalize-${proposal.id}`)
                            }
                          >
                            {isProtocolActionPending(`finalize-${proposal.id}`)
                              ? 'Finalizing...'
                              : 'Finalize'}
                          </Button>
                        </div>
                      )
                    })()
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No protocol updates right now"
            subtitle="Important policy changes and app listings will appear here."
          />
        )}
      </Card>
    </>
  )
}
