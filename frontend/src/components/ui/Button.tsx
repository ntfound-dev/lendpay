import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  wide?: boolean
}

export function Button({
  children,
  className = '',
  type = 'button',
  variant = 'primary',
  wide = false,
  ...props
}: PropsWithChildren<ButtonProps>) {
  const classes = ['button', `button--${variant}`, wide ? 'button--wide' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  )
}
