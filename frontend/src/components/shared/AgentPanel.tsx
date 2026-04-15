import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

export type AgentPanelTone = 'default' | 'success' | 'warning' | 'danger'

interface AgentPanelProps {
  actionLabel?: string
  body: string
  checklist?: Array<{ done: boolean; label: string }>
  confidence?: number | null
  engineLabel?: string
  onAction?: () => void
  recommendation: string
  statusLabel?: string
  title: string
  tone?: AgentPanelTone
}

export function AgentPanel({
  actionLabel,
  body,
  checklist,
  confidence,
  engineLabel,
  onAction,
  recommendation,
  statusLabel,
  title,
  tone = 'default',
}: AgentPanelProps) {
  const normalizedConfidence =
    typeof confidence === 'number'
      ? Math.max(0, Math.min(99, Math.round(confidence)))
      : null
  const checklistItems = checklist ?? []
  const completedChecklistCount = checklistItems.filter((item) => item.done).length
  const hasChecklist = checklistItems.length > 0

  return (
    <Card eyebrow="LendPay Agent" title={title} className={`agent-panel agent-panel--${tone}`}>
      <div className="agent-panel__hero">
        <div className="agent-panel__hero-main">
          <div className="agent-panel__header">
            <div className="agent-panel__signal-row">
              <div className="agent-panel__signal">
                <span className="agent-panel__signal-dot" aria-hidden="true" />
                <span>{actionLabel ? 'Ready to act' : 'Watching now'}</span>
              </div>
              <span className="agent-panel__engine-pill">{engineLabel ?? 'Live planner'}</span>
              {statusLabel ? <span className="agent-panel__status-pill">{statusLabel}</span> : null}
            </div>
            {normalizedConfidence !== null ? (
              <Badge tone="info">Confidence {normalizedConfidence}%</Badge>
            ) : null}
          </div>

          <div className="agent-panel__body">{body}</div>
        </div>

        <div className="agent-panel__hero-aside">
          <div className="agent-panel__hero-avatar" aria-hidden="true">
            AI
          </div>
          <div className="agent-panel__hero-label">Borrower state</div>
          <strong>{hasChecklist ? `${completedChecklistCount}/${checklistItems.length}` : 'Live'}</strong>
          <small>{hasChecklist ? 'signals ready' : 'planner tracking now'}</small>
        </div>
      </div>

      {hasChecklist ? (
        <div className="agent-panel__checklist">
          {checklistItems.map((item) => (
            <div
              className={`agent-panel__checklist-item ${item.done ? 'agent-panel__checklist-item--done' : ''}`}
              key={item.label}
            >
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
          <small>
            {actionLabel
              ? 'You can trigger this now, or let the borrower-approved flow stay ready.'
              : 'LendPay Agent will keep watching until the next safe action is available.'}
          </small>
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
