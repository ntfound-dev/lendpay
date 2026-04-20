import { Button } from '../ui/Button'

interface TopbarProps {
  accountActionDisabled?: boolean
  accountActionLabel?: string
  agentDetail?: string
  agentLabel?: string
  connected: boolean
  onAccountAction?: () => void
  onPrimaryAction?: () => void
  onSecondaryAction?: () => void
  pageSubtitle: string
  pageTitle: string
  primaryDisabled?: boolean
  primaryLabel?: string
  secondaryLabel?: string
  statusLabel?: string
  titleBadgeLabel?: string
}

export function Topbar({
  accountActionDisabled = false,
  accountActionLabel,
  agentDetail,
  agentLabel,
  connected,
  onAccountAction,
  onPrimaryAction,
  onSecondaryAction,
  pageSubtitle,
  pageTitle,
  primaryDisabled = false,
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
            {accountActionLabel && onAccountAction ? (
              <span className="topbar__account-action">
                <Button variant="ghost" onClick={onAccountAction} disabled={accountActionDisabled}>
                  {accountActionLabel}
                </Button>
              </span>
            ) : null}
            {secondaryLabel && onSecondaryAction ? (
              <Button variant="secondary" onClick={onSecondaryAction}>
                {secondaryLabel}
              </Button>
            ) : null}
            {primaryLabel && onPrimaryAction ? (
              <Button onClick={onPrimaryAction} disabled={primaryDisabled}>
                {primaryLabel}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </header>
  )
}
