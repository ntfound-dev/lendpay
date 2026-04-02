import type { HTMLAttributes, PropsWithChildren, ReactNode } from 'react'

interface CardProps {
  eyebrow?: string
  title?: ReactNode
  actions?: ReactNode
  className?: string
}

export function Card({
  actions,
  children,
  className = '',
  eyebrow,
  title,
  ...props
}: PropsWithChildren<CardProps & HTMLAttributes<HTMLElement>>) {
  return (
    <section className={['card', className].filter(Boolean).join(' ')} {...props}>
      {(eyebrow || title || actions) && (
        <div className="card__header">
          <div>
            {eyebrow ? <div className="card__eyebrow">{eyebrow}</div> : null}
            {title ? <div className="card__title">{title}</div> : null}
          </div>
          {actions ? <div className="card__actions">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  )
}
