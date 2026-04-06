import type { NavKey } from '../../types/domain'

interface MobileNavProps {
  active: NavKey
  onChange: (value: NavKey) => void
}

const navItems: Array<{ key: NavKey; label: string; tag: string }> = [
  { key: 'overview', label: 'Overview', tag: '01' },
  { key: 'analyze', label: 'Profile', tag: '02' },
  { key: 'request', label: 'Request', tag: '03' },
  { key: 'loan', label: 'Repay', tag: '04' },
  { key: 'rewards', label: 'Loyalty', tag: '05' },
  { key: 'admin', label: 'Ecosystem', tag: '06' },
]

export function MobileNav({ active, onChange }: MobileNavProps) {
  return (
    <nav className="mobile-nav" aria-label="Mobile">
      {navItems.map((item) => (
        <button
          key={item.key}
          className={`mobile-nav__link ${active === item.key ? 'mobile-nav__link--active' : ''}`}
          onClick={() => onChange(item.key)}
          type="button"
        >
          <span className="mobile-nav__tag">{item.tag}</span>
          <span className="mobile-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
