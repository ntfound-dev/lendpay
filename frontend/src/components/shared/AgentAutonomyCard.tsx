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
      ? 'InterwovenKit auto-sign active'
      : 'InterwovenKit session available, but LendPay is using manual approvals'
    : 'InterwovenKit auto-sign not armed yet'

  const nextInstallmentLabel =
    nextDueAmount !== null && nextDueAt
      ? `${formatCurrency(nextDueAmount)} by ${formatDate(nextDueAt)}`
      : 'No due installment right now'

  const sessionLabel = hasActiveAutoSignPermission
    ? autoSignSessionExpiresAt
      ? `Temporary wallet session until ${formatDate(autoSignSessionExpiresAt.toISOString())}`
      : 'Temporary wallet-managed session is active'
    : 'Wallet will keep asking before each repayment until auto-sign is set up'

  return (
    <Card eyebrow="Agent autonomy" title="Borrower-approved auto-repay" className="agent-autonomy-card section-stack">
      <div className="agent-autonomy-card__intro">
        Let LendPay Agent repay the next due installment during this active browser session after
        you grant InterwovenKit auto-sign for supported Move calls.
      </div>

      <div className="agent-autonomy-card__grid">
        <div className="agent-autonomy-card__item">
          <span>InterwovenKit</span>
          <strong>{autoSignStatus}</strong>
          <small>{sessionLabel}</small>
        </div>
        <div className="agent-autonomy-card__item">
          <span>Auto-repay</span>
          <strong>{autoRepayEnabled ? 'Armed' : 'Paused'}</strong>
          <small>{autoRepayEnabled ? 'The agent can repay due installments for you.' : 'Manual repay remains available at any time.'}</small>
        </div>
        <div className="agent-autonomy-card__item">
          <span>Next installment</span>
          <strong>{nextInstallmentLabel}</strong>
          <small>Only supported LendPay repayment calls are eligible for this mode.</small>
        </div>
      </div>

      <div className="agent-autonomy-card__badges">
        <Badge tone={hasActiveAutoSignPermission ? 'success' : 'warning'}>
          {hasActiveAutoSignPermission ? 'InterwovenKit ready' : 'InterwovenKit needed'}
        </Badge>
        <Badge tone={autoRepayEnabled ? 'success' : 'info'}>
          {autoRepayEnabled ? 'Agent auto-repay armed' : 'Agent auto-repay paused'}
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
            Arm auto-repay
          </Button>
        )}
      </div>

      <div className="agent-autonomy-card__footnote">
        You can pause LendPay autonomy anytime. Turning off InterwovenKit here switches the app back
        to manual wallet approvals; the wallet-managed helper session itself expires on its own.
      </div>
    </Card>
  )
}
