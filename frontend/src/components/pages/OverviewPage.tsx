import { formatCurrency } from '../../lib/format'
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
  canClaimAvailableRewards: boolean
  claimableRewardsLabel: string
  combinedActivities: ActivityItem[]
  handleClaimAvailableRewards: () => void | Promise<void>
  handleRepay: () => void | Promise<void>
  handleRetryLoad: () => void | Promise<void>
  heroAprLabel: string
  heroDueAmount: number | null
  heroDueDate: string
  heroSafeSpendLabel: string
  installmentsLabel: string
  isClaimingRewards: boolean
  isRepaying: boolean
  outstandingLabel: string
  overviewIdentityStrip: string
  progressPercent: number
  rewards: RewardsState | null
  rewardsStatusLabel: string
  score: CreditScoreState | null
  sectionErrors: Partial<Record<string, string>>
  walletNativeBalanceLabel: string
  walletTagLabel: string
}

export function OverviewPage({
  activeLoan,
  canClaimAvailableRewards,
  claimableRewardsLabel,
  combinedActivities,
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
  outstandingLabel,
  overviewIdentityStrip,
  progressPercent,
  rewards,
  rewardsStatusLabel,
  score,
  sectionErrors,
  walletNativeBalanceLabel,
  walletTagLabel,
}: OverviewPageProps) {
  return (
    <>
      <Card className="overview-hero-card">
        <div className="overview-hero-card__main">
          <div>
            <div className="overview-hero-card__label">Total credit limit</div>
            <div className="overview-hero-card__amount">
              {score ? formatCurrency(score.limitUsd) : '—'}
            </div>
            <div className="overview-hero-card__safe-spend">
              Safe to spend today: <strong>{heroSafeSpendLabel}</strong>
            </div>
            <div className="overview-hero-card__identity-strip">{overviewIdentityStrip}</div>
          </div>

          <div className="overview-hero-card__stats">
            <div className="overview-hero-card__stat">
              <span>APR</span>
              <strong>{heroAprLabel}</strong>
            </div>
            <div className="overview-hero-card__stat">
              <span>Next payment</span>
              <strong>{heroDueDate}</strong>
              <small>{activeLoan ? 'Keep it on time to protect your limit' : 'Nothing due right now'}</small>
            </div>
          </div>
        </div>
      </Card>

      <div className="overview-stats-row section-stack">
        <Card className="metric-card">
          <div className="metric-card__label">Credit limit</div>
          <div className="metric-card__value">{score ? formatCurrency(score.limitUsd) : '—'}</div>
          <span className="metric-card__tag metric-card__tag--success">
            {score ? 'Full limit active' : 'Not available'}
          </span>
        </Card>

        <Card className="metric-card">
          <div className="metric-card__label">Outstanding</div>
          <div className="metric-card__value">{outstandingLabel}</div>
          <span className="metric-card__tag metric-card__tag--danger">{installmentsLabel}</span>
        </Card>

        <Card className="metric-card">
          <div className="metric-card__label">Wallet balance</div>
          <div className="metric-card__value">{walletNativeBalanceLabel}</div>
          <span className="metric-card__tag metric-card__tag--warning">{walletTagLabel}</span>
        </Card>

        <Card className="metric-card">
          <div className="metric-card__label">Claimable rewards</div>
          <div className="metric-card__value">{rewards ? claimableRewardsLabel : '—'}</div>
          {canClaimAvailableRewards ? (
            <div className="metric-card__action">
              <Button
                variant="secondary"
                onClick={handleClaimAvailableRewards}
                disabled={isClaimingRewards}
              >
                {isClaimingRewards ? 'Claiming...' : 'Claim rewards'}
              </Button>
            </div>
          ) : (
            <span className="metric-card__tag metric-card__tag--success">{rewardsStatusLabel}</span>
          )}
        </Card>
      </div>

      <Card className="repay-cta-card section-stack">
        <div className="repay-cta-card__left">
          <div className="repay-cta-card__title">Next installment due — {heroDueDate}</div>
          <div className="repay-cta-card__subtitle">
            Keep this payment on schedule to protect your limit and tier.
          </div>
          <div className="repay-cta-card__progress">
            <div className="repay-cta-card__progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <div className="repay-cta-card__right">
          <div className="repay-cta-card__amount">
            {heroDueAmount !== null ? formatCurrency(heroDueAmount) : '—'}
          </div>
          <Button onClick={handleRepay} disabled={isRepaying || !activeLoan}>
            {isRepaying ? 'Repaying...' : 'Repay installment'}
          </Button>
        </div>
      </Card>

      <Card eyebrow="Recent activity" title="Account activity" className="history-card section-stack">
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
    </>
  )
}
