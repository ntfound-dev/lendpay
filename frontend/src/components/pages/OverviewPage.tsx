import { formatCurrency } from '../../lib/format'
import type {
  ActivityItem,
  LoanState,
  RewardsState,
} from '../../types/domain'
import { ActivityFeed } from '../shared/ActivityFeed'
import { AgentAutonomyCard } from '../shared/AgentAutonomyCard'
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
  creditLimitLabel: string
  creditLimitTagLabel: string
  creditLimitTagTone: 'success' | 'warning'
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
  heroAprStatLabel: string
  heroDueAmount: number | null
  heroDueDate: string
  heroSafeSpendPrefix: string
  heroSafeSpendLabel: string
  installmentsLabel: string
  isAutoSignPending: boolean
  isClaimingRewards: boolean
  isRepaying: boolean
  outstandingValue: number | null
  outstandingLabel: string
  overviewIdentityStrip: string
  progressPercent: number
  rewards: RewardsState | null
  rewardsStatusLabel: string
  sectionErrors: Partial<Record<string, string>>
  walletBalanceValue: number | null
  walletNativeBalanceLabel: string
  walletTagLabel: string
}

export function OverviewPage({
  activeLoan,
  autoRepayEnabled,
  autoSignPreferenceEnabled,
  autoSignSessionExpiresAt,
  canClaimAvailableRewards,
  claimableRewardsLabel,
  combinedActivities,
  creditLimitLabel,
  creditLimitTagLabel,
  creditLimitTagTone,
  creditLimitValue,
  handleDisableAutoRepay,
  handleDisableAutoSignPreference,
  handleClaimAvailableRewards,
  handleEnableAutoRepay,
  handleEnableAutoSign,
  handleRepay,
  handleRetryLoad,
  hasActiveAutoSignPermission,
  heroAprLabel,
  heroAprStatLabel,
  heroDueAmount,
  heroDueDate,
  heroSafeSpendPrefix,
  heroSafeSpendLabel,
  installmentsLabel,
  isAutoSignPending,
  isClaimingRewards,
  isRepaying,
  outstandingLabel,
  overviewIdentityStrip,
  progressPercent,
  rewards,
  rewardsStatusLabel,
  sectionErrors,
  walletNativeBalanceLabel,
  walletTagLabel,
}: OverviewPageProps) {
  return (
    <>
      <Card className="overview-hero-card">
        <div className="overview-hero-card__main">
          <div>
            <div className="overview-hero-card__label">{creditLimitLabel}</div>
            <div className="overview-hero-card__amount">
              {creditLimitValue !== null ? formatCurrency(creditLimitValue) : '—'}
            </div>
            <div className="overview-hero-card__safe-spend">
              {heroSafeSpendPrefix}: <strong>{heroSafeSpendLabel}</strong>
            </div>
            <div className="overview-hero-card__identity-strip">{overviewIdentityStrip}</div>
          </div>

          <div className="overview-hero-card__stats">
            <div className="overview-hero-card__stat">
              <span>{heroAprStatLabel}</span>
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
          <div className="metric-card__label">{creditLimitLabel}</div>
          <div className="metric-card__value">
            {creditLimitValue !== null ? formatCurrency(creditLimitValue) : '—'}
          </div>
          <span className={`metric-card__tag metric-card__tag--${creditLimitTagTone}`}>
            {creditLimitTagLabel}
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

      {activeLoan || hasActiveAutoSignPermission || autoRepayEnabled ? (
        <AgentAutonomyCard
          autoRepayEnabled={autoRepayEnabled}
          autoSignPreferenceEnabled={autoSignPreferenceEnabled}
          autoSignSessionExpiresAt={autoSignSessionExpiresAt}
          hasActiveAutoSignPermission={hasActiveAutoSignPermission}
          isBusy={isRepaying || isAutoSignPending}
          nextDueAmount={heroDueAmount}
          nextDueAt={activeLoan?.schedule.find((item) => item.status === 'due')?.dueAt ?? null}
          onDisableAutoRepay={handleDisableAutoRepay}
          onDisableAutoSignPreference={handleDisableAutoSignPreference}
          onEnableAutoRepay={handleEnableAutoRepay}
          onEnableAutoSign={handleEnableAutoSign}
        />
      ) : null}

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
