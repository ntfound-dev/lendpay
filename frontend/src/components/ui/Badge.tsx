import type { PropsWithChildren } from 'react'

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

interface BadgeProps {
  tone?: Tone
}

export function Badge({ children, tone = 'neutral' }: PropsWithChildren<BadgeProps>) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
