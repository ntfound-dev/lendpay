import { formatCurrency, formatDate } from '../../lib/format'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

type AgentAutonomyCardProps = {
  autoRepayEnabled: boolean
  autoSignPreferenceEnabled: boolean
  autoSignSessionExpiresAt: Date | null
  hasActiveAutoSignPermission: boolean
  isBusy?: boolean
  nextDueAmount: number | null
  nextDueAt: string | null
  onDisableAutoRepay: () => void
  onDisableAutoSignPreference: () => void
  onEnableAutoRepay: () => void
  onEnableAutoSign: () => void | Promise<void>
}

export function AgentAutonomyCard({
  autoRepayEnabled,
  autoSignPreferenceEnabled,
  autoSignSessionExpiresAt,
  hasActiveAutoSignPermission,
  isBusy = false,
  nextDueAmount,
  nextDueAt,
  onDisableAutoRepay,
  onDisableAutoSignPreference,
  onEnableAutoRepay,
  onEnableAutoSign,
}: AgentAutonomyCardProps) {
  const autoSignStatus = hasActiveAutoSignPermission
    ? autoSignPreferenceEnabled
      ? 'Repayment session active'
      : 'Session available, manual approvals selected'
    : 'Session not armed yet'

  const nextInstallmentLabel =
    nextDueAmount !== null && nextDueAt
      ? `${formatCurrency(nextDueAmount)} by ${formatDate(nextDueAt)}`
      : 'No due installment right now'

  const sessionLabel = hasActiveAutoSignPermission
    ? autoSignSessionExpiresAt
      ? `Temporary wallet session until ${formatDate(autoSignSessionExpiresAt.toISOString())}`
      : 'Temporary wallet-managed session is active'
    : 'Wallet will ask again after this short session expires, so later repayments need a re-arm.'

  const autoRepayStatus = autoRepayEnabled
    ? 'Armed for this session'
    : hasActiveAutoSignPermission
      ? 'Ready to arm'
      : 'Paused'

  const autoRepayLabel = autoRepayEnabled
    ? 'The agent can repay the next due installment while this wallet session stays active.'
    : hasActiveAutoSignPermission
      ? 'The session is ready, but LendPay will keep manual approvals until you arm session auto-repay.'
      : 'Manual repay remains available at any time. Re-arm before a later due date.'

  return (
    <Card eyebrow="Session automation" title="Session auto-repay" className="agent-autonomy-card section-stack">
      <div className="agent-autonomy-card__intro">
        Let LendPay Agent repay the next due installment only while this browser session stays
        active after you grant InterwovenKit auto-sign for repayment calls.
      </div>

      <div className="agent-autonomy-card__grid">
        <div className="agent-autonomy-card__item">
          <span>InterwovenKit</span>
          <strong>{autoSignStatus}</strong>
          <small>{sessionLabel}</small>
        </div>
        <div className="agent-autonomy-card__item">
          <span>Session auto-repay</span>
          <strong>{autoRepayStatus}</strong>
          <small>{autoRepayLabel}</small>
        </div>
        <div className="agent-autonomy-card__item">
          <span>Next installment</span>
          <strong>{nextInstallmentLabel}</strong>
          <small>Only supported LendPay repayment calls are eligible for this mode.</small>
        </div>
      </div>

      <div className="agent-autonomy-card__badges">
        <Badge tone={hasActiveAutoSignPermission ? 'success' : 'warning'}>
          {hasActiveAutoSignPermission ? 'Session ready' : 'Re-arm required'}
        </Badge>
        <Badge tone={autoRepayEnabled ? 'success' : 'info'}>
          {autoRepayEnabled ? 'Session auto-repay armed' : 'Manual repay mode'}
        </Badge>
      </div>

      <div className="agent-autonomy-card__actions">
        {hasActiveAutoSignPermission && autoSignPreferenceEnabled ? (
          <Button variant="ghost" onClick={onDisableAutoSignPreference}>
            Use manual approvals
          </Button>
        ) : (
          <Button variant="secondary" onClick={onEnableAutoSign} disabled={isBusy}>
            {isBusy ? 'Opening wallet...' : 'Enable InterwovenKit auto-sign'}
          </Button>
        )}

        {autoRepayEnabled ? (
          <Button variant="secondary" onClick={onDisableAutoRepay}>
            Pause auto-repay
          </Button>
        ) : (
          <Button onClick={onEnableAutoRepay} disabled={isBusy}>
            Arm session auto-repay
          </Button>
        )}
      </div>

      <div className="agent-autonomy-card__footnote">
        This is a browser-session convenience, not a standing monthly approval. Turning off
        InterwovenKit here switches the app back to manual wallet approvals, and later due dates
        need a fresh re-arm.
      </div>
    </Card>
  )
}
