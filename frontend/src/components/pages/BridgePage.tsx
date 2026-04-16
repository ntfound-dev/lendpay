import { formatCurrency, formatDate, formatNumber } from '../../lib/format'
import type { LendLiquidityRouteState, RewardsState } from '../../types/domain'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

type BridgePageProps = {
  bridgeAmount: string
  bridgeRecipient: string
  handleClaimAvailableRewards: () => void | Promise<void>
  handleOpenLendBridge: () => void | Promise<void>
  handleStake: () => void | Promise<void>
  handleUnstake: () => void | Promise<void>
  isProtocolActionPending: (key: string) => boolean
  lendLiquidityRoute: LendLiquidityRouteState | null
  rewards: RewardsState | null
  setBridgeAmount: (value: string) => void
  setBridgeRecipient: (value: string) => void
  setStakeAmount: (value: string) => void
  setUnstakeAmount: (value: string) => void
  stakeAmount: string
  technicalModeEnabled: boolean
  unstakeAmount: string
}

export function BridgePage({
  bridgeAmount,
  bridgeRecipient,
  handleClaimAvailableRewards,
  handleOpenLendBridge,
  handleStake,
  handleUnstake,
  isProtocolActionPending,
  lendLiquidityRoute,
  rewards,
  setBridgeAmount,
  setBridgeRecipient,
  setStakeAmount,
  setUnstakeAmount,
  stakeAmount,
  technicalModeEnabled,
  unstakeAmount,
}: BridgePageProps) {
  const bridgeReferencePrice = lendLiquidityRoute?.oracleQuote.price ?? 0.08
  const destinationSymbol = lendLiquidityRoute?.destinationDenom ?? 'INIT'
  const bridgeUpdatedAt = lendLiquidityRoute?.oracleQuote.fetchedAt
    ? formatDate(lendLiquidityRoute.oracleQuote.fetchedAt)
    : formatDate(new Date().toISOString())
  const claimableRewards = (rewards?.claimableLend ?? 0) + (rewards?.claimableStakingRewards ?? 0)

  return (
    <div className="bridge-page">
      <div className="bridge-page__grid">
        <Card eyebrow="Bridge" title="Bridge LEND to Initia MiniEVM" className="bridge-card">
          <div className="bridge-card__header">
            <div className="bridge-card__headline">
              <div className="bridge-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M8 7h8M8 17h8M15 4l3 3-3 3M9 14l-3 3 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="bridge-card__kicker">Preview</div>
                <div className="bridge-card__title">LendPay Move Rollup → Initia MiniEVM via Interwoven Bridge</div>
              </div>
            </div>
            <div className={`bridge-card__status ${lendLiquidityRoute?.routeMode === 'live' ? 'bridge-card__status--active' : 'bridge-card__status--pending'}`}>
              <span className="bridge-card__status-dot" />
              {lendLiquidityRoute?.routeMode === 'live' ? 'Live route' : 'Preview route'}
            </div>
          </div>

          <div className="bridge-card__divider" />

          <div className="bridge-card__fields">
            <label className="bridge-card__field">
              <span className="bridge-card__label">Amount (LEND)</span>
              <div className="bridge-card__input-shell">
                <input
                  className="bridge-card__input bridge-card__input--mono"
                  type="number"
                  min="1"
                  step="1"
                  value={bridgeAmount}
                  onChange={(event) => setBridgeAmount(event.target.value)}
                />
              </div>
            </label>
            <label className="bridge-card__field">
              <span className="bridge-card__label">Recipient address</span>
              <div className="bridge-card__input-shell">
                <input
                  className="bridge-card__input bridge-card__input--mono bridge-card__input--copyable"
                  type="text"
                  value={bridgeRecipient}
                  onChange={(event) => setBridgeRecipient(event.target.value)}
                />
              </div>
            </label>
          </div>

          <div className="bridge-card__output">
            <span className="bridge-card__output-label">You receive:</span>
            <div className="bridge-card__output-value">
              <strong>0 {destinationSymbol}</strong>
              <span>≈ $0.00</span>
            </div>
          </div>

          <div className="bridge-card__actions">
            <Button wide onClick={handleOpenLendBridge}>
              Bridge Now
            </Button>
          </div>

          <div className="bridge-card__footer">
            <span>Reference price {formatCurrency(bridgeReferencePrice)}</span>
            <span>·</span>
            <span>Last updated {bridgeUpdatedAt}</span>
          </div>
        </Card>
      </div>

      <div className="bridge-page__grid section-stack">
        <Card eyebrow="Staking" title="Stake LEND for protocol rewards" className="bridge-card">
          <div className="bridge-page__stats">
            <div className="bridge-page__stat">
              <span>Your LEND</span>
              <strong>{formatNumber(rewards?.liquidLend ?? 0)} liquid</strong>
            </div>
            <div className="bridge-page__stat">
              <span>Staked</span>
              <strong>{formatNumber(rewards?.stakedLend ?? 0)} LEND</strong>
            </div>
            <div className="bridge-page__stat">
              <span>Claimable rewards</span>
              <strong>{formatNumber(rewards?.claimableStakingRewards ?? 0)} LEND</strong>
            </div>
          </div>

          <div className="bridge-card__fields">
            <label className="bridge-card__field">
              <span className="bridge-card__label">Stake amount</span>
              <input
                className="bridge-card__input bridge-card__input--mono"
                type="number"
                min="1"
                value={stakeAmount}
                onChange={(event) => setStakeAmount(event.target.value)}
              />
            </label>
            <label className="bridge-card__field">
              <span className="bridge-card__label">Unstake amount</span>
              <input
                className="bridge-card__input bridge-card__input--mono"
                type="number"
                min="1"
                value={unstakeAmount}
                onChange={(event) => setUnstakeAmount(event.target.value)}
              />
            </label>
          </div>

          <div className="bridge-page__simple-actions">
            <Button onClick={handleStake} disabled={isProtocolActionPending('stake') || !technicalModeEnabled || !(rewards?.liquidLend ?? 0)}>
              {isProtocolActionPending('stake') ? 'Staking...' : 'Stake'}
            </Button>
            <Button variant="secondary" onClick={handleUnstake} disabled={isProtocolActionPending('unstake') || !technicalModeEnabled || !(rewards?.stakedLend ?? 0)}>
              {isProtocolActionPending('unstake') ? 'Unstaking...' : 'Unstake'}
            </Button>
            <Button variant="secondary" onClick={handleClaimAvailableRewards} disabled={isProtocolActionPending('claim-all') || !claimableRewards}>
              Claim {formatNumber(claimableRewards)} LEND
            </Button>
          </div>

          <div className="bridge-card__footer">
            <span>Bridge keeps liquid LEND mobile.</span>
            <span>·</span>
            <span>Staking keeps idle LEND productive.</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
