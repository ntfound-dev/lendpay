import { Button } from '../ui/Button'

interface TopbarProps {
  agentDetail?: string
  agentLabel?: string
  connected: boolean
  onPrimaryAction?: () => void
  onSecondaryAction?: () => void
  pageSubtitle: string
  pageTitle: string
  primaryLabel?: string
  secondaryLabel?: string
  statusLabel?: string
  titleBadgeLabel?: string
}

export function Topbar({
  agentDetail,
  agentLabel,
  connected,
  onPrimaryAction,
  onSecondaryAction,
  pageSubtitle,
  pageTitle,
  primaryLabel,
  secondaryLabel,
  statusLabel,
  titleBadgeLabel,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="topbar__title-row">
          <h1 className="topbar__title">{pageTitle}</h1>
          {titleBadgeLabel ? <span className="topbar__title-badge">{titleBadgeLabel}</span> : null}
        </div>
        <p className="topbar__subtitle">{pageSubtitle}</p>
        {agentLabel ? (
          <div className="topbar__agent">
            <span className="topbar__agent-dot" aria-hidden="true" />
            <span className="topbar__agent-label">{agentLabel}</span>
            {agentDetail ? <span className="topbar__agent-detail">{agentDetail}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="topbar__actions">
        {statusLabel ? (
          <span className={`topbar__status ${connected ? 'topbar__status--live' : ''}`}>{statusLabel}</span>
        ) : null}

        {connected ? (
          <>
            {secondaryLabel && onSecondaryAction ? (
              <Button variant="secondary" onClick={onSecondaryAction}>
                {secondaryLabel}
              </Button>
            ) : null}
            {primaryLabel && onPrimaryAction ? <Button onClick={onPrimaryAction}>{primaryLabel}</Button> : null}
          </>
        ) : null}
      </div>
    </header>
  )
}
