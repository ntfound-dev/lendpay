import { useEffect, useRef, useState } from 'react'
import { formatCurrency, formatNumber } from '../../lib/format'
import type {
  ActivityItem,
  CreditScoreState,
  LoanState,
  RewardsState,
} from '../../types/domain'
import { ActivityFeed } from '../shared/ActivityFeed'
import { EmptyState } from '../shared/EmptyState'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

type OverviewPageProps = {
  activeLoan: LoanState | null
  autoRepayEnabled: boolean
  autoSignPreferenceEnabled: boolean
  autoSignSessionExpiresAt: Date | null
  canClaimAvailableRewards: boolean
  claimableRewardsLabel: string
  claimableRewardsValue: number | null
  combinedActivities: ActivityItem[]
  creditLimitValue: number | null
  handleDisableAutoRepay: () => void
  handleDisableAutoSignPreference: () => void
  handleClaimAvailableRewards: () => void | Promise<void>
  handleEnableAutoRepay: () => void | Promise<void>
  handleEnableAutoSign: () => void | Promise<void>
  handleRepay: () => void | Promise<void>
  handleRetryLoad: () => void | Promise<void>
  hasActiveAutoSignPermission: boolean
  heroAprLabel: string
  heroDueAmount: number | null
  heroDueDate: string
  heroSafeSpendLabel: string
  installmentsLabel: string
  isClaimingRewards: boolean
  isRepaying: boolean
  outstandingValue: number | null
  outstandingLabel: string
  overviewIdentityStrip: string
  progressPercent: number
  rewards: RewardsState | null
  rewardsStatusLabel: string
  score: CreditScoreState | null
  sectionErrors: Partial<Record<string, string>>
  walletBalanceValue: number | null
  walletNativeBalanceLabel: string
  walletTagLabel: string
}

type AnimatedValueProps = {
  className?: string
  format: (value: number) => string
  value: number | null
}

type ChecklistItemProps = {
  done: boolean
  pending?: boolean
  label: string
}

function AnimatedValue({ className, format, value }: AnimatedValueProps) {
  const [displayValue, setDisplayValue] = useState(value ?? 0)
  const previousValueRef = useRef(0)

  useEffect(() => {
    if (value === null) {
      previousValueRef.current = 0
      setDisplayValue(0)
      return
    }

    let frame = 0
    const startValue = previousValueRef.current
    const startTime = performance.now()
    const duration = 950

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const nextValue = startValue + (value - startValue) * eased
      setDisplayValue(nextValue)

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick)
      } else {
        previousValueRef.current = value
      }
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [value])

  if (value === null) {
    return <span className={className}>—</span>
  }

  return <span className={className}>{format(displayValue)}</span>
}

function ChecklistItem({ done, label, pending = false }: ChecklistItemProps) {
  const dotClassName = pending
    ? 'overview-status-dot overview-status-dot--pending'
    : done
      ? 'overview-status-dot overview-status-dot--active'
      : 'overview-status-dot'

  return (
    <div className="flex items-center gap-3">
      <span className={dotClassName} aria-hidden="true" />
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
  )
}

export function OverviewPage({
  activeLoan,
  canClaimAvailableRewards,
  claimableRewardsLabel,
  claimableRewardsValue,
  combinedActivities,
  creditLimitValue,
  handleClaimAvailableRewards,
  handleRepay,
  handleRetryLoad,
  heroAprLabel,
  heroDueAmount,
  heroDueDate,
  heroSafeSpendLabel,
  installmentsLabel,
  isClaimingRewards,
  isRepaying,
  outstandingValue,
  outstandingLabel,
  overviewIdentityStrip,
  progressPercent,
  rewards,
  rewardsStatusLabel,
  score,
  sectionErrors,
  walletBalanceValue,
  walletNativeBalanceLabel,
  walletTagLabel,
}: OverviewPageProps) {
  const dueDateLabel = heroDueDate.replace(/, \d{4}$/, '')
  const activeLineAmount = activeLoan?.principal ?? creditLimitValue ?? 220
  const repaymentWatchPending = Boolean(activeLoan && heroDueAmount !== null)
  const walletBadgeTone =
    walletBalanceValue !== null && walletBalanceValue > 1 ? 'overview-metric-badge--success' : 'overview-metric-badge--danger'
  const rewardsBadgeTone =
    canClaimAvailableRewards && claimableRewardsValue && claimableRewardsValue > 0
      ? 'overview-metric-badge--info'
      : 'overview-metric-badge--neutral'

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <section className="overview-agent-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="overview-card-kicker">LENDPAY AGENT</div>
              <div>
                <h2 className="overview-agent-card__title">
                  Repay {heroDueAmount !== null ? formatCurrency(heroDueAmount) : '$75.00'} by {dueDateLabel}
                </h2>
                <p className="overview-agent-card__body">
                  Your active {formatCurrency(activeLineAmount)} credit line is open. The safest move is to clear the next installment on time so pricing and checkout access stay healthy across Initia apps.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span className="overview-chip">agent-planner-v1</span>
              <span className="overview-chip overview-chip--confidence">
                <span className="overview-chip__dot" aria-hidden="true" />
                Confidence 95%
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ChecklistItem done label="Wallet linked" />
            <ChecklistItem done={Boolean(score)} label="Profile scored" />
            <ChecklistItem done={Boolean(score)} label="Credit unlocked" />
            <ChecklistItem done={!repaymentWatchPending} pending={repaymentWatchPending} label="Repayment current" />
          </div>

          <div className="overview-next-step mt-6">
            <div className="space-y-1">
              <div className="overview-card-kicker overview-card-kicker--dark">NEXT BEST STEP</div>
              <div className="overview-next-step__title">Repay the next installment now</div>
              <p className="overview-next-step__body">
                Move early on the next payment to protect limit growth, keep the agent in repayment-watch mode, and avoid avoidable late-fee pressure.
              </p>
            </div>
            <Button
              className="dashboard-shimmer-button"
              onClick={handleRepay}
              disabled={isRepaying || !activeLoan}
            >
              {isRepaying ? 'Repaying...' : 'Repay now'}
            </Button>
          </div>
        </section>

        <section className="overview-stats-card">
          <div className="space-y-3">
            <div className="overview-card-kicker">TOTAL CREDIT LIMIT</div>
            <AnimatedValue
              className="overview-stats-card__amount"
              format={(value) => formatCurrency(Math.round(value))}
              value={creditLimitValue}
            />
            <div className="overview-stats-card__safe-spend">
              Safe to spend today: <strong>{heroSafeSpendLabel}</strong>
            </div>
          </div>

          <div className="overview-stats-card__meta">
            <span>{rewards?.tier ?? 'Tier pending'} tier</span>
            <span>·</span>
            <span>{score ? `Score ${formatNumber(score.score)}` : 'Score pending'}</span>
          </div>

          <div className="overview-stats-card__summary">
            <div className="overview-stats-card__box">
              <span>APR</span>
              <strong>{heroAprLabel}</strong>
              <small>Risk-adjusted pricing</small>
            </div>
            <div className="overview-stats-card__box">
              <span>Next payment</span>
              <strong>{heroDueDate}</strong>
              <small>{activeLoan ? 'Keep it clean to preserve your limit' : 'No installment due right now'}</small>
            </div>
          </div>

          <div className="overview-stats-card__footer">
            <div className="overview-stats-card__footer-label">{overviewIdentityStrip}</div>
            <div className="overview-stats-card__progress">
              <div className="overview-stats-card__progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className="overview-metric-card">
          <div className="overview-metric-card__label">Credit limit</div>
          <AnimatedValue
            className="overview-metric-card__value"
            format={(value) => formatCurrency(Math.round(value))}
            value={creditLimitValue}
          />
          <span className="overview-metric-badge overview-metric-badge--success">Full limit active</span>
        </section>

        <section className="overview-metric-card">
          <div className="overview-metric-card__label">Outstanding</div>
          <AnimatedValue
            className="overview-metric-card__value"
            format={(value) => formatCurrency(value)}
            value={outstandingValue}
          />
          <span className="overview-metric-badge overview-metric-badge--warning">{installmentsLabel}</span>
        </section>

        <section className="overview-metric-card">
          <div className="overview-metric-card__label">Wallet balance</div>
          <div className="overview-metric-card__value">{walletNativeBalanceLabel}</div>
          <span className={['overview-metric-badge', walletBadgeTone].join(' ')}>{walletTagLabel}</span>
        </section>

        <section className="overview-metric-card">
          <div className="overview-metric-card__label">Claimable rewards</div>
          {claimableRewardsValue !== null ? (
            <AnimatedValue
              className="overview-metric-card__value"
              format={(value) => `${formatNumber(Math.round(value))} LEND`}
              value={claimableRewardsValue}
            />
          ) : (
            <div className="overview-metric-card__value">{claimableRewardsLabel}</div>
          )}
          {canClaimAvailableRewards ? (
            <Button variant="secondary" onClick={handleClaimAvailableRewards} disabled={isClaimingRewards}>
              {isClaimingRewards ? 'Claiming...' : 'Claim rewards'}
            </Button>
          ) : (
            <span className={['overview-metric-badge', rewardsBadgeTone].join(' ')}>{rewardsStatusLabel}</span>
          )}
        </section>
      </div>

      <Card eyebrow="Recent activity" title="Account activity" className="history-card overview-activity-card">
        {sectionErrors.activity ? (
          <EmptyState
            title="Recent activity unavailable"
            subtitle={sectionErrors.activity}
            actionLabel="Retry load"
            onAction={handleRetryLoad}
          />
        ) : (
          <ActivityFeed items={combinedActivities} />
        )}
      </Card>

      {outstandingLabel === '—' && !activeLoan ? null : (
        <div className="overview-footnote">
          Outstanding balance {outstandingLabel} is currently tied to your live repayment schedule.
        </div>
      )}
    </div>
  )
}
