import { formatDate } from '../../lib/format'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

type AutoSignSessionCardProps = {
  autoSignPreferenceEnabled: boolean
  autoSignSessionExpiresAt: Date | null
  hasActiveAutoSignPermission: boolean
  isBusy?: boolean
  onDisableAutoSignPreference: () => void | Promise<void>
  onEnableAutoSign: () => void | Promise<void>
}

export function AutoSignSessionCard({
  autoSignPreferenceEnabled,
  autoSignSessionExpiresAt,
  hasActiveAutoSignPermission,
  isBusy = false,
  onDisableAutoSignPreference,
  onEnableAutoSign,
}: AutoSignSessionCardProps) {
  const sessionStatus = hasActiveAutoSignPermission
    ? autoSignPreferenceEnabled
      ? 'Active'
      : 'Available but paused in LendPay'
    : 'Not enabled yet'

  const sessionDetail = hasActiveAutoSignPermission
    ? autoSignSessionExpiresAt
      ? `Temporary wallet session until ${formatDate(autoSignSessionExpiresAt.toISOString())}`
      : 'Temporary wallet-managed session is active'
    : 'Enable it once, then supported Move actions can reuse wallet approval during this short session.'

  return (
    <Card
      eyebrow="InterwovenKit"
      title="Auto-sign"
      className="agent-autonomy-card section-stack"
    >
      <div className="agent-autonomy-card__intro">
        Turn on a short InterwovenKit wallet session for supported Move actions. This is separate
        from Agent Autonomy.
      </div>

      <div className="agent-autonomy-card__grid">
        <div className="agent-autonomy-card__item">
          <span>Status</span>
          <strong>{sessionStatus}</strong>
          <small>{sessionDetail}</small>
        </div>
        <div className="agent-autonomy-card__item">
          <span>Provider</span>
          <strong>InterwovenKit</strong>
          <small>The wallet session is created through InterwovenKit, then reused while it stays active.</small>
        </div>
        <div className="agent-autonomy-card__item">
          <span>Scope</span>
          <strong>Supported Move actions</strong>
          <small>LendPay can reuse wallet approval during the active session instead of prompting every time.</small>
        </div>
      </div>

      <div className="agent-autonomy-card__badges">
        <Badge tone={hasActiveAutoSignPermission ? 'success' : 'warning'}>
          {hasActiveAutoSignPermission ? 'InterwovenKit session active' : 'Enable available'}
        </Badge>
        <Badge tone={autoSignPreferenceEnabled ? 'info' : 'warning'}>
          {autoSignPreferenceEnabled ? 'LendPay can use it' : 'Manual approvals selected'}
        </Badge>
      </div>

      <div className="agent-autonomy-card__actions">
        {hasActiveAutoSignPermission && autoSignPreferenceEnabled ? (
          <Button variant="ghost" onClick={onDisableAutoSignPreference}>
            Use manual approvals
          </Button>
        ) : (
          <Button variant="secondary" onClick={onEnableAutoSign} disabled={isBusy}>
            {isBusy ? 'Opening InterwovenKit...' : 'Enable auto-sign'}
          </Button>
        )}
      </div>

      <div className="agent-autonomy-card__footnote">
        This is a convenience wallet session. Agent Autonomy stays separate and is still marked
        coming soon.
      </div>
    </Card>
  )
}
