import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

interface AgentPanelProps {
  actionLabel?: string
  body: string
  checklist?: Array<{ done: boolean; label: string }>
  confidence?: number | null
  engineLabel?: string
  onAction?: () => void
  recommendation: string
  title: string
}

export function AgentPanel({
  actionLabel,
  body,
  checklist,
  confidence,
  engineLabel,
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
          <span>{engineLabel ?? 'Watching now'}</span>
        </div>
        {normalizedConfidence !== null ? (
          <Badge tone="info">Confidence {normalizedConfidence}%</Badge>
        ) : null}
      </div>

      <div className="agent-panel__body">{body}</div>

      {checklist?.length ? (
        <div className="agent-panel__checklist">
          {checklist.map((item) => (
            <div className="agent-panel__checklist-item" key={item.label}>
              <span className={`agent-panel__checklist-dot ${item.done ? 'agent-panel__checklist-dot--done' : ''}`} aria-hidden="true" />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}

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
