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
  unstakeAmount,
}: BridgePageProps) {
  const bridgeReferencePrice = lendLiquidityRoute?.oracleQuote.price ?? 0.08
  const destinationSymbol = lendLiquidityRoute?.destinationDenom ?? 'INIT'
  const bridgeUpdatedAt = lendLiquidityRoute?.oracleQuote.fetchedAt
    ? formatDate(lendLiquidityRoute.oracleQuote.fetchedAt)
    : formatDate(new Date().toISOString())
  const claimableRewards = (rewards?.claimableLend ?? 0) + (rewards?.claimableStakingRewards ?? 0)
  const bridgeAmountNumber = Math.max(0, Number(bridgeAmount || 0))
  const bridgePreviewUsd = formatCurrency(bridgeAmountNumber * bridgeReferencePrice)
  const routeModeLabel = 'Live route'
  const bridgeRouteLive = true
  const bridgePending = isProtocolActionPending('bridge-intent')
  const bridgeButtonLabel = bridgePending ? 'Opening bridge...' : 'Bridge Now'

  return (
    <div className="bridge-page">
      <Card eyebrow="Bridge route" title="Move LEND into Initia MiniEVM" className="bridge-card bridge-card--hero">
        <div className="bridge-hero">
          <div className="bridge-hero__story">
            <div className="bridge-hero__copy-block">
              <span
                className="bridge-card__status bridge-card__status--active"
              >
                <span className="bridge-card__status-dot" />
                {routeModeLabel}
              </span>
              <p className="bridge-hero__lede">
                Send liquid LEND out of the rollup when you need MiniEVM-side access. Keep the
                recipient ready, then open Interwoven Bridge to confirm the final route and wallet
                approval details.
              </p>
            </div>

            <div className="bridge-route">
              <div className="bridge-route__node">
                <span className="bridge-route__node-label">Source</span>
                <strong>LendPay Move Rollup</strong>
                <small>LEND leaves your rollup balance from here.</small>
              </div>

              <div className="bridge-route__connector" aria-hidden="true">
                <span className="bridge-route__connector-line" />
                <span className="bridge-route__connector-pill">Interwoven Bridge</span>
                <span className="bridge-route__connector-arrow">→</span>
              </div>

              <div className="bridge-route__node bridge-route__node--destination">
                <span className="bridge-route__node-label">Destination</span>
                <strong>Initia MiniEVM</strong>
                <small>{destinationSymbol} settlement is confirmed in the bridge flow.</small>
              </div>
            </div>

            <div className="bridge-hero__facts">
              <div className="bridge-hero__fact">
                <span>Route</span>
                <strong>{routeModeLabel}</strong>
              </div>
              <div className="bridge-hero__fact">
                <span>Reference price</span>
                <strong>{formatCurrency(bridgeReferencePrice)}</strong>
              </div>
              <div className="bridge-hero__fact">
                <span>Last updated</span>
                <strong>{bridgeUpdatedAt}</strong>
              </div>
            </div>
          </div>

          <div className="bridge-builder">
            <div className="bridge-builder__surface">
              <div className="bridge-builder__header">
                <div>
                  <span className="bridge-builder__eyebrow">Bridge composer</span>
                  <h3>Set the amount and recipient</h3>
                </div>
              </div>

              <div className="bridge-builder__fields">
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

              <div className="bridge-builder__preview">
                <div>
                  <span className="bridge-builder__preview-label">Destination preview</span>
                  <strong>{destinationSymbol} quote opens in bridge</strong>
                  <small>
                    Final destination amount is confirmed by Interwoven after you open the route.
                  </small>
                </div>
                <span className="bridge-builder__preview-value">
                  {bridgeAmountNumber > 0 ? bridgePreviewUsd : '≈ $0.00'}
                </span>
              </div>

              <div className="bridge-builder__actions">
                <Button wide onClick={handleOpenLendBridge} disabled={bridgePending}>
                  {bridgeButtonLabel}
                </Button>
                <p className="bridge-builder__hint">
                  Recipient stays editable here so you can bridge straight into the MiniEVM address you want to use next.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card eyebrow="Staking" title="Put idle LEND to work while the rest stays liquid" className="bridge-card bridge-card--staking">
        <div className="bridge-staking">
          <div className="bridge-staking__intro">
            <p className="bridge-staking__copy">
              Keep part of your balance ready for bridge flows and park the rest in staking when
              you want protocol rewards instead of idle inventory.
            </p>

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
          </div>

          <div className="bridge-staking__controls">
            <div className="bridge-staking__fields">
              <label className="bridge-card__field">
                <span className="bridge-card__label">Stake amount</span>
                <div className="bridge-card__input-shell">
                  <input
                    className="bridge-card__input bridge-card__input--mono"
                    type="number"
                    min="1"
                    value={stakeAmount}
                    onChange={(event) => setStakeAmount(event.target.value)}
                  />
                </div>
              </label>
              <label className="bridge-card__field">
                <span className="bridge-card__label">Unstake amount</span>
                <div className="bridge-card__input-shell">
                  <input
                    className="bridge-card__input bridge-card__input--mono"
                    type="number"
                    min="1"
                    value={unstakeAmount}
                    onChange={(event) => setUnstakeAmount(event.target.value)}
                  />
                </div>
              </label>
            </div>

            <div className="bridge-staking__actions">
              <Button
                onClick={handleStake}
                disabled={isProtocolActionPending('stake') || !(rewards?.liquidLend ?? 0)}
              >
                {isProtocolActionPending('stake') ? 'Staking...' : 'Stake'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleUnstake}
                disabled={isProtocolActionPending('unstake') || !(rewards?.stakedLend ?? 0)}
              >
                {isProtocolActionPending('unstake') ? 'Unstaking...' : 'Unstake'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleClaimAvailableRewards}
                disabled={isProtocolActionPending('claim-all') || !claimableRewards}
              >
                Claim {formatNumber(claimableRewards)} LEND
              </Button>
            </div>

            <div className="bridge-staking__footnote">
              <span>Bridge keeps liquid LEND mobile.</span>
              <span>·</span>
              <span>Staking keeps idle LEND productive.</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
