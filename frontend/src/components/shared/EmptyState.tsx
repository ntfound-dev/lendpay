import { Button } from '../ui/Button'

interface EmptyStateProps {
  actionLabel?: string
  onAction?: () => void
  subtitle: string
  title: string
}

export function EmptyState({ actionLabel, onAction, subtitle, title }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M4.75 8.25h14.5v9a2 2 0 0 1-2 2H6.75a2 2 0 0 1-2-2v-9Z" />
          <path d="M8 8.25V6.8A2.8 2.8 0 0 1 10.8 4h2.4A2.8 2.8 0 0 1 16 6.8v1.45" />
          <path d="M4.75 11.5h14.5" />
        </svg>
      </div>
      <strong className="empty-state__title">{title}</strong>
      <p className="empty-state__subtitle">{subtitle}</p>
      {actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  )
}
