import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import {
  appCategoryMeta,
  buildRestTxInfoUrl,
  buildRpcTxUrl,
  describeDropItemDelivery,
  describeProductCard,
  formatAppLabel,
  formatProfileLabel,
  getDropItemArtwork,
  parseNumericId,
  productRequirementCopy,
  productTagMeta,
  titleCase,
  type AppCategoryMeta,
  type AppFamily,
  type RequestDraft,
} from '../../lib/appHelpers'
import { formatCurrency, formatDate, formatNumber, formatTxHash } from '../../lib/format'
import type {
  CreditProfileQuote,
  CreditScoreState,
  LoanRequestState,
  LoanState,
  MerchantState,
  RewardsState,
  ViralDropItemState,
} from '../../types/domain'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../shared/EmptyState'

type EligibilityRow = {
  label: string
  status: string
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info'
}

type GroupedApps = {
  family: AppFamily
  apps: MerchantState[]
}

type RequestPageProps = {
  activeLoan: LoanState | null
  activeMerchants: MerchantState[]
  canRunPendingDemoReview: boolean
  checkoutFormLocked: boolean
  checkoutMerchantReady: boolean
  checkoutSelectionMessage: string
  checkoutSliderMax: number
  checkoutSliderValue: number
  draft: RequestDraft
  eligibilityRows: EligibilityRow[]
  estimatedTotalRepayment: number | null
  handleCancelPendingRequest: (request: LoanRequestState) => void | Promise<void>
  handleDismissWalletRecovery: () => void | Promise<void>
  handleOpenWalletApproval: () => void | Promise<void>
  handleRequestLoan: () => void | Promise<void>
  handleReviewPendingRequest: (request: LoanRequestState) => void | Promise<void>
  handleRetryLoad: () => void | Promise<void>
  handleSelectProfile: (profileId: number) => void | Promise<void>
  isCancellingPendingRequest: boolean
  isReviewingPendingRequest: boolean
  isSubmittingRequest: boolean
  monthlyPaymentPreview: number | null
  orderedProfiles: CreditProfileQuote[]
  pendingRequest: LoanRequestState | null
  quickPickAmounts: number[]
  requestAmountHelper: string
  requestBlockingMessage: string | null
  requestQuickApps: MerchantState[]
  requests: LoanRequestState[]
  requiredCollateralAmount: number
  rewards: RewardsState | null
  score: CreditScoreState | null
  sectionErrors: Partial<Record<string, string>>
  selectedAppMeta: AppCategoryMeta
  selectedDropItem: ViralDropItemState | null
  selectedDropItemId: string
  selectedMerchant: MerchantState | null
  selectedMerchantDropItems: ViralDropItemState[]
  selectedMerchantTitle: string
  selectedProfile: CreditProfileQuote | null
  selectedRouteOutcomeCopy: string
  setDraft: Dispatch<SetStateAction<RequestDraft>>
  setSelectedDropItemId: Dispatch<SetStateAction<string>>
  showRequestWalletRecovery: boolean
  groupedActiveApps: GroupedApps[]
  updateDraftAmount: (value: string | number) => void
}

export function RequestPage({
  activeLoan,
  activeMerchants,
  canRunPendingDemoReview,
  checkoutFormLocked,
  checkoutMerchantReady,
  checkoutSelectionMessage,
  checkoutSliderMax,
  checkoutSliderValue,
  draft,
  eligibilityRows,
  estimatedTotalRepayment,
  handleCancelPendingRequest,
  handleDismissWalletRecovery,
  groupedActiveApps,
  handleOpenWalletApproval,
  handleRequestLoan,
  handleReviewPendingRequest,
  handleRetryLoad,
  handleSelectProfile,
  isCancellingPendingRequest,
  isReviewingPendingRequest,
  isSubmittingRequest,
  monthlyPaymentPreview,
  orderedProfiles,
  pendingRequest,
  quickPickAmounts,
  requestAmountHelper,
  requestBlockingMessage,
  requestQuickApps,
  requests,
  requiredCollateralAmount,
  rewards,
  score,
  sectionErrors,
  selectedAppMeta,
  selectedDropItem,
  selectedDropItemId,
  selectedMerchant,
  selectedMerchantDropItems,
  selectedMerchantTitle,
  selectedProfile,
  selectedRouteOutcomeCopy,
  setDraft,
  setSelectedDropItemId,
  showRequestWalletRecovery,
  updateDraftAmount,
}: RequestPageProps) {
  const requestBuilderRef = useRef<HTMLDivElement | null>(null)
  const amountInputRef = useRef<HTMLInputElement | null>(null)
  const lastSelectedMerchantIdRef = useRef<string | null>(null)

  const revealRequestBuilder = () => {
    if (typeof window === 'undefined') {
      return
    }

    window.requestAnimationFrame(() => {
      requestBuilderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.setTimeout(() => amountInputRef.current?.focus(), 220)
    })
  }

  const handleSelectMerchant = (merchantId: string) => {
    setDraft((current) =>
      current.merchantId === merchantId ? current : { ...current, merchantId },
    )

    if (selectedDropItemId) {
      setSelectedDropItemId('')
    }

    if (selectedMerchant?.id === merchantId) {
      revealRequestBuilder()
    }
  }

  useEffect(() => {
    const nextSelectedMerchantId = selectedMerchant?.id ?? null
    if (!nextSelectedMerchantId) {
      lastSelectedMerchantIdRef.current = null
      return
    }

    if (lastSelectedMerchantIdRef.current === nextSelectedMerchantId) {
      return
    }

    lastSelectedMerchantIdRef.current = nextSelectedMerchantId
    revealRequestBuilder()
  }, [selectedMerchant?.id])

  const getRejectedReason = (request: LoanRequestState) => {
    if (request.status !== 'rejected') return null
    if (!request.txHash) return 'Rejected — no onchain transaction found'
    if ((score?.score ?? 0) < 600) return 'Rejected — credit score too low'
    return 'Rejected — did not meet approval criteria'
  }

  const getRequestNote = (request: LoanRequestState) => {
    if (request.status === 'rejected') return getRejectedReason(request)
    if (request.status === 'cancelled') return 'Cancelled onchain by borrower'
    return null
  }

  const getRequestProofUrl = (txHash?: string) => buildRestTxInfoUrl(txHash) ?? buildRpcTxUrl(txHash)
  const getApprovalProofUrl = (request: LoanRequestState) =>
    activeLoan?.requestId === request.id
      ? buildRestTxInfoUrl(activeLoan.txHashApprove) ?? buildRpcTxUrl(activeLoan.txHashApprove)
      : null

  return (
    <div className={`checkout-layout ${checkoutMerchantReady ? '' : 'checkout-layout--single'}`}>
      <div className="checkout-layout__main">
        <div className="checkout-builder__header">
          <h2 className="checkout-builder__title">Choose one app and send your request</h2>
        </div>

        <Card className="checkout-card">
          <div className="checkout-section checkout-section--tight">
            <div className="checkout-section__label">Step 1 · Pick one app</div>
            <select
              className="checkout-select"
              value={draft.merchantId}
              onChange={(event) => handleSelectMerchant(event.target.value)}
              disabled={!activeMerchants.length}
            >
              <option value="">Pick one app</option>
              {groupedActiveApps.map((group) => (
                <optgroup key={group.family} label={group.family}>
                  {group.apps.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {formatAppLabel(merchant)} — {group.family}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="checkout-section__hint">
              {sectionErrors.merchants
                ? sectionErrors.merchants
                : selectedMerchant
                  ? `${selectedMerchantTitle} selected. The request builder is ready below.`
                : activeMerchants.length
                  ? 'Pick one app here. If you still want to compare options first, open Ecosystem.'
                  : 'Apps appear here as soon as a live route is registered onchain.'}
            </p>
            {requestQuickApps.length ? (
              <div className="request-app-grid">
                {requestQuickApps.map((merchant) => {
                  const family = appCategoryMeta(merchant.category).family
                  const selected = merchant.id === draft.merchantId

                  return (
                    <button
                      key={merchant.id}
                      type="button"
                      className={`request-app-card ${selected ? 'request-app-card--selected' : ''}`}
                      onClick={() => handleSelectMerchant(merchant.id)}
                      aria-pressed={selected}
                    >
                      <div className="request-app-card__top">
                        <strong>{formatAppLabel(merchant)}</strong>
                        <Badge
                          tone={
                            family === 'NFT'
                              ? 'info'
                              : family === 'Gaming'
                                ? 'success'
                                : family === 'DeFi'
                                  ? 'warning'
                                  : 'neutral'
                          }
                        >
                          {family}
                        </Badge>
                      </div>
                      <div className="request-app-card__body">
                        {merchant.description ?? appCategoryMeta(merchant.category).description}
                      </div>
                      <div className="request-app-card__foot">
                        {selected ? 'Selected' : 'Use this app'}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        </Card>

        {checkoutMerchantReady ? (
          <>
            <Card className="checkout-card">
              <div className="app-purpose-card">
                <div className="app-purpose-card__head">
                  <div>
                    <div className="checkout-section__label">Selected app</div>
                    <div className="app-purpose-card__title">{selectedMerchantTitle}</div>
                  </div>
                  <Badge tone="info">{selectedAppMeta.family}</Badge>
                </div>
                <p className="checkout-section__hint">
                  {selectedMerchantDropItems.length
                    ? 'This app already has live items onchain. Pick one below so the request amount matches a real item price.'
                    : selectedAppMeta.description}
                </p>
                <div className="app-purpose-card__examples-label">Example actions in this app</div>
                <div className="app-purpose-card__chips">
                  {selectedAppMeta.examples.map((example) => (
                    <span className="app-purpose-chip app-purpose-chip--static" key={example}>
                      {example}
                    </span>
                  ))}
                </div>
                <p className="app-purpose-card__examples-note">
                  {selectedMerchantDropItems.length
                    ? 'These tags are examples only. Use the live item cards below to actually continue with a mint, drop, or collectible route.'
                    : 'These tags are examples only. Continue below to set the amount and send the credit request.'}
                </p>
                <div className="app-purpose-card__next">
                  <span>What happens next</span>
                  <strong>{selectedRouteOutcomeCopy}</strong>
                </div>
              </div>
            </Card>

            {sectionErrors.viralDrop ? (
              <Card className="checkout-card">
                <EmptyState
                  title="Live items unavailable"
                  subtitle={sectionErrors.viralDrop}
                  actionLabel="Retry load"
                  onAction={handleRetryLoad}
                />
              </Card>
            ) : selectedMerchantDropItems.length ? (
              <Card className="checkout-card">
                <div className="checkout-section checkout-section--tight">
                  <div className="checkout-section__label">Optional item match</div>
                  <div className="drop-item-grid">
                    {selectedMerchantDropItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`drop-item-card ${selectedDropItemId === item.id ? 'drop-item-card--selected' : ''}`}
                        onClick={() => {
                          setSelectedDropItemId(item.id)
                          updateDraftAmount(item.price)
                        }}
                      >
                        {getDropItemArtwork(item) ? (
                          <div className="drop-item-card__art">
                            <img src={getDropItemArtwork(item)!} alt={item.name} className="drop-item-card__image" />
                          </div>
                        ) : null}
                        <div className="drop-item-card__head">
                          <div>
                            <div className="drop-item-card__title">{item.name}</div>
                            <div className="drop-item-card__copy">{describeDropItemDelivery(item)}</div>
                          </div>
                          <Badge tone="success">Live</Badge>
                        </div>
                        <div className="summary drop-item-card__summary">
                          <div className="summary-row">
                            <span>Price</span>
                            <strong>{formatCurrency(item.price)}</strong>
                          </div>
                          <div className="summary-row">
                            <span>Status</span>
                            <strong>{selectedDropItemId === item.id ? 'Amount matched' : 'Match amount'}</strong>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            ) : null}
          </>
        ) : null}

        {sectionErrors.merchants ? (
          <Card className="checkout-card">
            <EmptyState
              title="Apps unavailable"
              subtitle={sectionErrors.merchants}
              actionLabel="Retry load"
              onAction={handleRetryLoad}
            />
          </Card>
        ) : null}

        {!checkoutMerchantReady ? (
          <div className="checkout-gate-message">{checkoutSelectionMessage}</div>
        ) : null}

        {requestBlockingMessage ? (
          <div className="checkout-gate-message checkout-gate-message--warning">
            <div>{requestBlockingMessage}</div>
            {pendingRequest ? (
              <div className="card-action-row">
                <Button
                  variant="secondary"
                  onClick={() => handleCancelPendingRequest(pendingRequest)}
                  disabled={isCancellingPendingRequest}
                >
                  {isCancellingPendingRequest ? 'Clearing pending request...' : 'Clear pending request'}
                </Button>
                {canRunPendingDemoReview ? (
                  <Button
                    onClick={() => handleReviewPendingRequest(pendingRequest)}
                    disabled={isReviewingPendingRequest || isCancellingPendingRequest}
                  >
                    {isReviewingPendingRequest ? 'Running review...' : 'Run review now'}
                  </Button>
                ) : null}
                {getRequestProofUrl(pendingRequest.txHash) ? (
                  <a
                    className="checkout-proof-link"
                    href={getRequestProofUrl(pendingRequest.txHash) ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Request tx {formatTxHash(pendingRequest.txHash!)}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {showRequestWalletRecovery ? (
          <div className="wallet-recovery wallet-recovery--request">
            <p>Wallet is still loading. Reconnect the Interwoven wallet, then try the pending transaction again.</p>
            <div className="wallet-recovery__actions">
              <Button onClick={handleOpenWalletApproval}>Reconnect wallet</Button>
              <Button variant="secondary" onClick={handleDismissWalletRecovery}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}

        {checkoutMerchantReady ? (
          <div
            ref={requestBuilderRef}
            className={`checkout-form-stack ${checkoutFormLocked ? 'checkout-form-stack--disabled' : ''}`}
          >
            <Card className="checkout-card">
              <div className="checkout-section checkout-section--tight">
                <div className="checkout-section__label">Step 2 · Set the request amount</div>
                <div className="checkout-amount-card">
                  <span className="checkout-amount-card__currency">$</span>
                  <input
                    ref={amountInputRef}
                    className="checkout-amount-card__input"
                    value={draft.amount}
                    onChange={(event) => updateDraftAmount(event.target.value)}
                    placeholder={checkoutSliderMax >= 1000 ? '1000' : '500'}
                    type="number"
                    min="0"
                    max={checkoutSliderMax}
                    disabled={!score || checkoutFormLocked}
                  />
                </div>
                <input
                  className="checkout-slider"
                  type="range"
                  min="0"
                  max={checkoutSliderMax}
                  step="10"
                  value={checkoutSliderValue}
                  onChange={(event) => updateDraftAmount(event.target.value)}
                  disabled={!score || checkoutFormLocked}
                />
                <div className="checkout-quick-picks">
                  {quickPickAmounts.map((amount) => (
                    <button
                      key={amount}
                      className={`checkout-chip ${Number(draft.amount || 0) === amount ? 'checkout-chip--active' : ''}`}
                      type="button"
                      onClick={() => updateDraftAmount(amount)}
                      disabled={amount > checkoutSliderMax || !score || checkoutFormLocked}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                <p className="muted-copy">{requestAmountHelper}</p>
              </div>
            </Card>

            <Card className="checkout-card">
              <div className="checkout-section checkout-section--tight">
                <div className="checkout-section__label">Step 3 · Choose credit product</div>
                {sectionErrors.profiles ? (
                  <EmptyState
                    title="Credit products unavailable"
                    subtitle={sectionErrors.profiles}
                    actionLabel="Retry load"
                    onAction={handleRetryLoad}
                  />
                ) : orderedProfiles.length ? (
                  <div className="checkout-product-grid">
                    {orderedProfiles.map((profile) => {
                      const tag = productTagMeta(profile.label)
                      const isQualified = profile.qualified
                      const isSelected = isQualified && draft.profileId === profile.profileId
                      return (
                        <button
                          key={profile.profileId}
                          className={`checkout-product-card ${isSelected ? 'checkout-product-card--selected' : ''} ${isQualified ? '' : 'checkout-product-card--locked'}`}
                          onClick={() => {
                            void handleSelectProfile(profile.profileId)
                          }}
                          type="button"
                          disabled={!isQualified || checkoutFormLocked}
                        >
                          <div className="checkout-product-card__head">
                            <div className="checkout-product-card__title">{formatProfileLabel(profile.label)}</div>
                            <Badge tone={tag.tone}>{tag.label}</Badge>
                          </div>
                          <div className="checkout-product-card__copy">
                            {describeProductCard(profile.label)}
                          </div>
                          <div className="checkout-product-card__limit">
                            {formatCurrency(profile.maxPrincipal)}
                          </div>
                          {isQualified ? (
                            <div className="checkout-product-card__access checkout-product-card__access--ready">
                              Ready to use
                            </div>
                          ) : (
                            <div className="checkout-product-card__access checkout-product-card__access--locked">
                              <span className="checkout-product-card__lock-icon" aria-hidden="true">
                                <svg viewBox="0 0 16 16" fill="none" role="presentation">
                                  <path
                                    d="M5.5 7V5.75a2.5 2.5 0 1 1 5 0V7"
                                    stroke="currentColor"
                                    strokeWidth="1.4"
                                    strokeLinecap="round"
                                  />
                                  <rect x="3.5" y="7" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                                </svg>
                              </span>
                              {productRequirementCopy(profile)}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="muted-copy">Credit products will appear after your profile is refreshed.</p>
                )}
              </div>
            </Card>

            <Card className="checkout-card">
              <div className="checkout-section checkout-section--tight">
                <div className="checkout-section__label">Step 4 · Pick repayment period</div>
                <div className="checkout-tenor-group">
                  {[1, 3, 6].map((tenor) => (
                    <button
                      key={tenor}
                      className={`checkout-tenor ${draft.tenorMonths === tenor ? 'checkout-tenor--active' : ''}`}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          tenorMonths: tenor as RequestDraft['tenorMonths'],
                        }))
                      }
                      type="button"
                      disabled={checkoutFormLocked || (selectedProfile ? tenor > selectedProfile.maxTenorMonths : false)}
                    >
                      {tenor} month{tenor > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {selectedProfile?.requiresCollateral ? (
              <Card className="checkout-card">
                <div className="checkout-section checkout-section--tight">
                  <div className="checkout-section__label">Step 5 · Lock LEND collateral</div>
                  <div className="checkout-collateral-grid">
                    <input
                      className="checkout-inline-input"
                      value={draft.collateralAmount}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          collateralAmount: event.target.value,
                        }))
                      }
                      placeholder={String(requiredCollateralAmount || 0)}
                      type="number"
                      min={requiredCollateralAmount || 0}
                      step="1"
                      disabled={checkoutFormLocked}
                    />
                    <div className="checkout-inline-note">
                      Minimum {formatNumber(requiredCollateralAmount)} LEND · Liquid {formatNumber(rewards?.liquidLend ?? 0)} LEND
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}

            <Card title="Can you send this request right now?" className="checkout-eligibility-card">
              <div className="checkout-eligibility">
                {eligibilityRows.map((row) => (
                  <div className="checkout-eligibility__row" key={row.label}>
                    <span>{row.label}</span>
                    <Badge tone={row.tone}>{row.status}</Badge>
                  </div>
                ))}
              </div>
            </Card>

            {!checkoutFormLocked ? (
              <div className="checkout-submit">
                <Button
                  onClick={handleRequestLoan}
                  disabled={
                    Boolean(requestBlockingMessage) ||
                    isSubmittingRequest ||
                    !score ||
                    (activeMerchants.length > 0 && !selectedMerchant)
                  }
                  wide
                >
                  {isSubmittingRequest ? 'Sending request...' : 'Send credit request'}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {checkoutMerchantReady ? (
        <div className="checkout-layout__side">
          <Card title="If approved, this is your repayment plan" className="checkout-summary-card">
            <div className="checkout-summary-card__total">
              <span>Estimated repayment</span>
              <strong>
                {estimatedTotalRepayment === null ? '—' : formatCurrency(estimatedTotalRepayment)}
              </strong>
            </div>

            <div className="checkout-summary-card__rows">
              <div className="checkout-summary-card__row">
                <span>Monthly payment</span>
                <strong>
                  {monthlyPaymentPreview === null ? 'Analyze first' : formatCurrency(monthlyPaymentPreview)}
                </strong>
              </div>
              <div className="checkout-summary-card__row">
                <span>APR</span>
                <strong>{score ? `${score.apr}%` : 'Analyze first'}</strong>
              </div>
              <div className="checkout-summary-card__row">
                <span>Tenor</span>
                <strong>{draft.tenorMonths} months</strong>
              </div>
            </div>
          </Card>

          <Card title="Recent request decisions" className="checkout-history-card section-stack">
            {requests.length === 0 ? (
              <p className="muted-copy">No requests yet. Your latest app credit request will appear here after you send it.</p>
            ) : (
              <div className="checkout-history">
                {requests.slice(0, 3).map((request) => (
                  <div className="checkout-history__row" key={request.id}>
                    <div className="checkout-history__copy">
                      <div className="checkout-history__title">
                        #{parseNumericId(request.id) || request.id}
                      </div>
                      <div className="checkout-history__meta">
                        {formatCurrency(request.amount)} · {request.tenorMonths} month{request.tenorMonths > 1 ? 's' : ''} · {formatDate(request.submittedAt)} · {request.collateralAmount > 0 ? 'LEND locked' : 'No collateral'}
                      </div>
                      {getRequestNote(request) ? (
                        <div className="checkout-history__reason">{getRequestNote(request)}</div>
                      ) : null}
                      {request.txHash ? (
                        <div className="checkout-history__proofs">
                          <a
                            className="checkout-proof-link"
                            href={getRequestProofUrl(request.txHash) ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Request tx {formatTxHash(request.txHash)}
                          </a>
                        </div>
                      ) : null}
                      {getApprovalProofUrl(request) ? (
                        <div className="checkout-history__proofs">
                          <a
                            className="checkout-proof-link"
                            href={getApprovalProofUrl(request) ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Approval tx {formatTxHash(activeLoan?.txHashApprove ?? '')}
                          </a>
                        </div>
                      ) : null}
                      {request.status === 'rejected' ? (
                        <div className="card-action-row">
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                amount: String(request.amount),
                              }))
                            }
                          >
                            Retry this amount
                          </Button>
                        </div>
                      ) : null}
                      {request.status === 'pending' ? (
                        <div className="card-action-row">
                          <Button
                            variant="secondary"
                            onClick={() => handleCancelPendingRequest(request)}
                            disabled={isCancellingPendingRequest}
                          >
                            {isCancellingPendingRequest ? 'Clearing...' : 'Clear pending request'}
                          </Button>
                          {canRunPendingDemoReview ? (
                            <Button
                              onClick={() => handleReviewPendingRequest(request)}
                              disabled={isReviewingPendingRequest || isCancellingPendingRequest}
                            >
                              {isReviewingPendingRequest ? 'Running review...' : 'Run review now'}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <Badge
                      tone={
                        request.status === 'approved'
                          ? 'success'
                          : request.status === 'rejected'
                            ? 'danger'
                            : request.status === 'cancelled'
                              ? 'neutral'
                            : 'warning'
                      }
                    >
                      {titleCase(request.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  )
}
