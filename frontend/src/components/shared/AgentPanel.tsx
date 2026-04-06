import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

interface AgentPanelProps {
  actionLabel?: string
  body: string
  confidence?: number | null
  onAction?: () => void
  recommendation: string
  title: string
}

export function AgentPanel({
  actionLabel,
  body,
  confidence,
  onAction,
  recommendation,
  title,
}: AgentPanelProps) {
  const normalizedConfidence =
    typeof confidence === 'number'
      ? Math.max(0, Math.min(99, Math.round(confidence)))
      : null

  return (
    <Card eyebrow="LendPay Agent" title={title} className="agent-panel">
      <div className="agent-panel__header">
        <div className="agent-panel__signal">
          <span className="agent-panel__signal-dot" aria-hidden="true" />
          <span>Watching now</span>
        </div>
        {normalizedConfidence !== null ? (
          <Badge tone="info">Confidence {normalizedConfidence}%</Badge>
        ) : null}
      </div>

      <div className="agent-panel__body">{body}</div>

      <div className="agent-panel__footer">
        <div className="agent-panel__recommendation">
          <span>Next best step</span>
          <strong>{recommendation}</strong>
        </div>

        {actionLabel && onAction ? (
          <Button onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
