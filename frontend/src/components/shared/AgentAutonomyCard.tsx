import { formatCurrency, formatDate } from '../../lib/format'
import { Badge } from '../ui/Badge'
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
  nextDueAmount,
  nextDueAt,
}: AgentAutonomyCardProps) {
  const nextInstallmentLabel =
    nextDueAmount !== null && nextDueAt
      ? `${formatCurrency(nextDueAmount)} by ${formatDate(nextDueAt)}`
      : 'No due installment right now'

  return (
    <Card eyebrow="Agent autonomy" title="Coming soon" className="agent-autonomy-card section-stack">
      <div className="agent-autonomy-card__intro">
        We are still polishing autonomous repayment. For now, repayments stay on manual wallet
        approval so the rest of the app, including Bridge, remains predictable.
      </div>

      <div className="agent-autonomy-card__grid">
        <div className="agent-autonomy-card__item">
          <span>Status</span>
          <strong>Coming soon</strong>
          <small>Auto-sign and session auto-repay are temporarily hidden while we finish the flow.</small>
        </div>
        <div className="agent-autonomy-card__item">
          <span>Current mode</span>
          <strong>Manual approvals only</strong>
          <small>Each repayment still goes through the normal wallet confirmation flow.</small>
        </div>
        <div className="agent-autonomy-card__item">
          <span>Next installment</span>
          <strong>{nextInstallmentLabel}</strong>
          <small>Bridge and the rest of the payment flow stay available as usual.</small>
        </div>
      </div>

      <div className="agent-autonomy-card__badges">
        <Badge tone="info">Coming soon</Badge>
        <Badge tone="warning">Manual repay mode</Badge>
      </div>

      <div className="agent-autonomy-card__footnote">
        Manual repayment stays active, and we will bring Agent Autonomy back once the InterwovenKit
        flow is stable enough to ship.
      </div>
    </Card>
  )
}
