import type { Dispatch, SetStateAction } from 'react'
import { formatCurrency, formatNumber, shortenAddress } from '../../lib/format'
import type {
  FaucetState,
  LoanFeeState,
  LoanState,
  ViralDropItemState,
  ViralDropPurchaseState,
} from '../../types/domain'
import type { AppCategoryMeta, PurchaseDeliverySummary } from '../../lib/appHelpers'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { LoanSchedule } from '../loans/LoanSchedule'
import { AgentAutonomyCard } from '../shared/AgentAutonomyCard'
import { EmptyState } from '../shared/EmptyState'

type UnlockRow = {
  step: string
  title: string
  detail: string
}

type RepayPageProps = {
  activeLoan: LoanState | null
  activeLoanDropItems: ViralDropItemState[]
  autoRepayEnabled: boolean
  autoSignPreferenceEnabled: boolean
  autoSignSessionExpiresAt: Date | null
  buyingDropItemId: string | null
  checkoutAppMeta: AppCategoryMeta
  checkoutDueLabel: string
  checkoutMerchantTitle: string
  claimableDropPurchase: ViralDropPurchaseState | null
  faucet: FaucetState | null
  faucetAvailabilityLabel: string
  faucetClaimAmountLabel: string
  faucetTxUrl: string | null
  handleBuyViralDrop: (item: ViralDropItemState) => void | Promise<void>
  handleClaimFaucet: () => void | Promise<void>
  handleClaimCollectible: (purchase: ViralDropPurchaseState) => void | Promise<void>
  handleDisableAutoRepay: () => void
  handleDisableAutoSignPreference: () => void
  handleDismissWalletRecovery: () => void | Promise<void>
  handleEnableAutoRepay: () => void | Promise<void>
  handleEnableAutoSign: () => void | Promise<void>
  handleOpenWalletApproval: () => void | Promise<void>
  handlePayFeesInLend: () => void | Promise<void>
  handleRepay: () => void | Promise<void>
  handleRetryLoad: () => void | Promise<void>
  hasActiveAutoSignPermission: boolean
  isClaimingFaucet: boolean
  isClaimingDropCollectible: boolean
  isProtocolActionPending: (key: string) => boolean
  isRepayGuideOpen: boolean
  isRepaying: boolean
  latestDropDelivery: PurchaseDeliverySummary | null
  latestDropPurchase: ViralDropPurchaseState | null
  latestDropUnlockRows: UnlockRow[]
  loanFees: LoanFeeState | null
  nextDueItem: LoanState['schedule'][number] | null
  nextDueLabel: string
  outstandingAmount: number
  paidAmount: number
  repayCardEyebrow: string
  sectionErrors: Partial<Record<string, string>>
  showWalletRecovery: boolean
  setIsRepayGuideOpen: Dispatch<SetStateAction<boolean>>
  totalFeesDue: number
  walletNativeBalanceLabel: string
}

export function RepayPage({
  activeLoan,
  activeLoanDropItems,
  autoRepayEnabled,
  autoSignPreferenceEnabled,
  autoSignSessionExpiresAt,
  buyingDropItemId,
  checkoutAppMeta,
  checkoutDueLabel,
  checkoutMerchantTitle,
  claimableDropPurchase,
  faucet,
  faucetAvailabilityLabel,
  faucetClaimAmountLabel,
  faucetTxUrl,
  handleBuyViralDrop,
  handleClaimFaucet,
  handleClaimCollectible,
  handleDisableAutoRepay,
  handleDisableAutoSignPreference,
  handleDismissWalletRecovery,
  handleEnableAutoRepay,
  handleEnableAutoSign,
  handleOpenWalletApproval,
  handlePayFeesInLend,
  handleRepay,
  handleRetryLoad,
  hasActiveAutoSignPermission,
  isClaimingFaucet,
  isClaimingDropCollectible,
  isProtocolActionPending,
  isRepayGuideOpen,
  isRepaying,
  latestDropDelivery,
  latestDropPurchase,
  latestDropUnlockRows,
  loanFees,
  nextDueItem,
  nextDueLabel,
  outstandingAmount,
  paidAmount,
  repayCardEyebrow,
  sectionErrors,
  showWalletRecovery,
  setIsRepayGuideOpen,
  totalFeesDue,
  walletNativeBalanceLabel,
}: RepayPageProps) {
  return (
    <>
      <div className="page__heading">
        <div>
          <h2 className="page__title">Repay</h2>
          <p className="page__subtitle">
            See what you already received, what is still owed, and when the full collectible unlocks.
          </p>
        </div>
        <Button
          onClick={
            claimableDropPurchase
              ? () => void handleClaimCollectible(claimableDropPurchase)
              : handleRepay
          }
          disabled={claimableDropPurchase ? isClaimingDropCollectible : !activeLoan || isRepaying}
        >
          {claimableDropPurchase
            ? isClaimingDropCollectible
              ? 'Claiming...'
              : 'Claim collectible'
            : isRepaying
              ? 'Repaying...'
              : 'Repay now'}
        </Button>
      </div>

      <Card
        eyebrow={repayCardEyebrow}
        title={latestDropPurchase ? 'Repayment and unlock status' : 'Active loan'}
        className="repayment-card card--primary"
      >
        {activeLoan ? (
          <>
            <div className="repayment-card__spotlight">
              <span>Pay this now</span>
              <strong>{nextDueItem ? formatCurrency(nextDueItem.amount) : 'Complete'}</strong>
              <small className="repayment-card__due">{nextDueLabel}</small>
            </div>
            <div className="summary">
              <div className="summary-row">
                <span>Financed total</span>
                <strong>{formatCurrency(activeLoan.principal)}</strong>
              </div>
              <div className="summary-row">
                <span>APR</span>
                <strong>{activeLoan.apr}%</strong>
              </div>
              <div className="summary-row">
                <span>Status</span>
                <strong>{activeLoan.status}</strong>
              </div>
              <div className="summary-row">
                <span>Already paid</span>
                <strong>{formatCurrency(paidAmount)}</strong>
              </div>
              <div className="summary-row">
                <span>Remaining</span>
                <strong>{formatCurrency(outstandingAmount)}</strong>
              </div>
              <div className="summary-row">
                <span>Checkout type</span>
                <strong>
                  {activeLoan.collateralAmount > 0
                    ? `${formatNumber(activeLoan.collateralAmount)} LEND locked · ${activeLoan.collateralStatus}`
                    : 'No collateral'}
                </strong>
              </div>
            </div>

            <div className="repayment-card__receipt">
              <div className="repayment-card__receipt-title">
                {latestDropPurchase ? 'What you already have' : `Purchase summary · ${checkoutAppMeta.family}`}
              </div>
              {latestDropPurchase ? (
                <div className="summary">
                  <div className="summary-row">
                    <span>App purchase</span>
                    <strong>{`${latestDropPurchase.itemName} · ${latestDropPurchase.appLabel}`}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Receipt in wallet</span>
                    <strong>{shortenAddress(latestDropPurchase.receiptAddress)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Final collectible</span>
                    <strong>
                      {latestDropPurchase.collectibleClaimed
                        ? latestDropPurchase.collectibleAddress
                          ? shortenAddress(latestDropPurchase.collectibleAddress)
                          : 'Delivered'
                        : latestDropPurchase.collectibleClaimable
                          ? 'Ready to claim'
                          : 'Locked until full repayment'}
                    </strong>
                  </div>
                  <div className="summary-row">
                    <span>Next repayment due</span>
                    <strong>{checkoutDueLabel}</strong>
                  </div>
                </div>
              ) : (
                <div className="summary">
                  <div className="summary-row">
                    <span>Where funds went</span>
                    <strong>{checkoutMerchantTitle}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Wallet balance now</span>
                    <strong>{walletNativeBalanceLabel}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Next repayment due</span>
                    <strong>{checkoutDueLabel}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Delivery</span>
                    <strong>{latestDropDelivery?.headline ?? 'Pending'}</strong>
                  </div>
                </div>
              )}
              {latestDropPurchase && latestDropDelivery ? (
                <div className="repayment-card__receipt-note">{latestDropDelivery.detail}</div>
              ) : null}
            </div>
            {showWalletRecovery ? (
              <div className="wallet-recovery wallet-recovery--request">
                <p>Wallet is still loading. Reconnect the Interwoven wallet, then try the repayment again.</p>
                <div className="wallet-recovery__actions">
                  <Button onClick={handleOpenWalletApproval}>Reconnect wallet</Button>
                  <Button variant="secondary" onClick={handleDismissWalletRecovery}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="muted-copy">
            No approved purchase yet. Once you use credit, this page will show what is due and where the credit was used.
          </p>
        )}
      </Card>

      {activeLoan || hasActiveAutoSignPermission || autoRepayEnabled ? (
        <AgentAutonomyCard
          autoRepayEnabled={autoRepayEnabled}
          autoSignPreferenceEnabled={autoSignPreferenceEnabled}
          autoSignSessionExpiresAt={autoSignSessionExpiresAt}
          hasActiveAutoSignPermission={hasActiveAutoSignPermission}
          isBusy={isRepaying}
          nextDueAmount={nextDueItem?.amount ?? null}
          nextDueAt={nextDueItem?.dueAt ?? null}
          onDisableAutoRepay={handleDisableAutoRepay}
          onDisableAutoSignPreference={handleDisableAutoSignPreference}
          onEnableAutoRepay={handleEnableAutoRepay}
          onEnableAutoSign={handleEnableAutoSign}
        />
      ) : null}

      {faucet?.enabled ? (
        <Card
          eyebrow="Testnet faucet"
          title="Need more LEND for testnet actions?"
          className="faucet-card section-stack"
        >
          <div className="faucet-card__main">
            <div>
              <div className="faucet-card__amount">{faucetClaimAmountLabel}</div>
              <p className="faucet-card__body">
                This is a testnet flow. Claim faucet funds before repay, reward claims, or other onchain actions if your wallet needs more {faucet.nativeSymbol}.
              </p>
              <div className="faucet-card__meta">
                One claim every {faucet.cooldownHours} hours · {faucetAvailabilityLabel}
              </div>
              {faucet.txHash ? (
                <a
                  className="faucet-card__link"
                  href={faucetTxUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  Latest faucet tx {shortenAddress(faucet.txHash)}
                </a>
              ) : null}
            </div>
            <Button onClick={handleClaimFaucet} disabled={isClaimingFaucet || !faucet.canClaim}>
              {isClaimingFaucet ? 'Sending...' : faucet.canClaim ? 'Claim testnet LEND' : 'Claim available later'}
            </Button>
          </div>
        </Card>
      ) : null}

      {latestDropPurchase ? (
        <Card eyebrow="Unlock progress" title="Receipt now, full collectible later" className="story-card section-stack">
          <div className="unlock-progress">
            {latestDropUnlockRows.map((item) => (
              <div className="unlock-progress__row" key={item.step}>
                <div className="unlock-progress__eyebrow">{item.step}</div>
                <div className="unlock-progress__title">{item.title}</div>
                <div className="unlock-progress__detail">{item.detail}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {!activeLoan && claimableDropPurchase ? (
        <Card eyebrow="Step 3" title="Claim the final collectible" className="story-card section-stack">
          <p className="muted-copy">
            {claimableDropPurchase.itemName} is fully unlocked. Your receipt is already onchain, and now you can mint the final collectible into your wallet.
          </p>
          <div className="summary">
            <div className="summary-row">
              <span>Receipt</span>
              <strong>{shortenAddress(claimableDropPurchase.receiptAddress)}</strong>
            </div>
            <div className="summary-row">
              <span>Purchase</span>
              <strong>{claimableDropPurchase.itemName}</strong>
            </div>
            <div className="summary-row">
              <span>Route</span>
              <strong>{claimableDropPurchase.appLabel}</strong>
            </div>
          </div>
          <div className="card-action-row">
            <Button
              onClick={() => void handleClaimCollectible(claimableDropPurchase)}
              wide
              disabled={isClaimingDropCollectible}
            >
              {isClaimingDropCollectible ? 'Claiming collectible...' : 'Claim collectible'}
            </Button>
          </div>
        </Card>
      ) : null}

      {activeLoan && !latestDropPurchase && sectionErrors.viralDrop ? (
        <Card eyebrow="Step 2" title="Live items unavailable" className="story-card section-stack">
          <EmptyState
            title="Live items unavailable"
            subtitle={sectionErrors.viralDrop}
            actionLabel="Retry load"
            onAction={handleRetryLoad}
          />
        </Card>
      ) : null}

      {activeLoan && !latestDropPurchase && !sectionErrors.viralDrop && activeLoanDropItems.length ? (
        <Card eyebrow="Step 2" title="Use the approved balance inside this app" className="story-card section-stack">
          <p className="muted-copy">
            The loan is approved, but the app purchase is not finished yet. Pick one live item below and complete the onchain action before the next repayment date.
          </p>
          <div className="drop-item-grid">
            {activeLoanDropItems.map((item) => (
              <div className="drop-item-card drop-item-card--actionable" key={item.id}>
                <div className="drop-item-card__head">
                  <div>
                    <div className="drop-item-card__title">{item.name}</div>
                    <div className="drop-item-card__copy">{item.appLabel}</div>
                  </div>
                  <Badge tone="success">Live</Badge>
                </div>
                <div className="summary drop-item-card__summary">
                  <div className="summary-row">
                    <span>Price</span>
                    <strong>{formatCurrency(item.price)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Action</span>
                    <strong>Complete purchase in app</strong>
                  </div>
                  <div className="summary-row">
                    <span>Delivery</span>
                    <strong>{item.instantCollateralRequired > 0 ? 'Receipt now · collectible later' : 'Receipt now'}</strong>
                  </div>
                </div>
                <Button
                  onClick={() => handleBuyViralDrop(item)}
                  disabled={buyingDropItemId === item.id}
                  wide
                >
                  {buyingDropItemId === item.id ? 'Completing...' : 'Use credit in app'}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card eyebrow="Fees" title="Extra fees" className="story-card section-stack">
        {activeLoan ? (
          <>
            {sectionErrors.loanFees ? (
              <EmptyState
                title="Fee details unavailable"
                subtitle={sectionErrors.loanFees}
                actionLabel="Retry load"
                onAction={handleRetryLoad}
              />
            ) : loanFees ? (
              <div className="summary">
                <div className="summary-row">
                  <span>Origination fee due</span>
                  <strong>{formatNumber(loanFees.originationFeeDue)}</strong>
                </div>
                <div className="summary-row">
                  <span>Late fee due</span>
                  <strong>{formatNumber(loanFees.lateFeeDue)}</strong>
                </div>
                <div className="summary-row">
                  <span>Total fees paid</span>
                  <strong>{formatNumber(loanFees.totalFeesPaid)}</strong>
                </div>
                <div className="summary-row">
                  <span>Paid in LEND</span>
                  <strong>{formatNumber(loanFees.totalFeesPaidInLend)}</strong>
                </div>
              </div>
            ) : (
              <div className="skeleton-stack" aria-hidden="true">
                <div className="skeleton-bar" />
                <div className="skeleton-bar" />
                <div className="skeleton-bar" />
              </div>
            )}
            <div className="card-action-row">
              <Button
                onClick={handlePayFeesInLend}
                variant="secondary"
                wide
                disabled={isProtocolActionPending('pay-fees') || totalFeesDue <= 0}
              >
                {isProtocolActionPending('pay-fees') ? 'Paying fees...' : 'Pay fees in LEND'}
              </Button>
            </div>
          </>
        ) : (
          <p className="muted-copy">
            Fees only appear after a purchase is active and extra charges apply.
          </p>
        )}
      </Card>

      <Card eyebrow="Schedule" title="Payment timeline" className="grid section-stack">
        {activeLoan ? (
          <LoanSchedule schedule={activeLoan.schedule} />
        ) : (
          <p className="muted-copy">Your installment schedule will appear after the first app credit request is approved.</p>
        )}
      </Card>

      <Card eyebrow="How it works" title="How receipt and collectible delivery work" className="section-stack">
        <button
          className="accordion-toggle"
          type="button"
          onClick={() => setIsRepayGuideOpen((current) => !current)}
          aria-expanded={isRepayGuideOpen}
        >
          <span>{isRepayGuideOpen ? 'Hide details' : 'Show details'}</span>
          <span className={`accordion-toggle__chevron ${isRepayGuideOpen ? 'accordion-toggle__chevron--open' : ''}`}>
            ▾
          </span>
        </button>
        {isRepayGuideOpen ? (
          <div className="summary accordion-panel">
            <div className="summary-row">
              <span>Approval</span>
              <strong>LendPay approves one app credit amount for this wallet</strong>
            </div>
            <div className="summary-row">
              <span>Purchase</span>
              <strong>You use the approved funds in the selected app route</strong>
            </div>
            <div className="summary-row">
              <span>Receipt</span>
              <strong>The receipt NFT mints first as proof that the app purchase happened onchain</strong>
            </div>
            <div className="summary-row">
              <span>Final collectible</span>
              <strong>The final collectible unlocks after full repayment, unless enough LEND was locked for instant delivery</strong>
            </div>
            <div className="summary-row">
              <span>Repayment</span>
              <strong>Repay on schedule to keep your limit healthy and unlock the remaining item rights</strong>
            </div>
          </div>
        ) : null}
      </Card>
    </>
  )
}
