import type { NavKey } from '../../types/domain'
import { NAV_ITEMS } from '../../lib/nav'

interface MobileNavProps {
  active: NavKey
  onChange: (value: NavKey) => void
}

export function MobileNav({ active, onChange }: MobileNavProps) {
  return (
    <nav className="mobile-nav" aria-label="Mobile">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          className={`mobile-nav__link ${active === item.key ? 'mobile-nav__link--active' : ''}`}
          onClick={() => onChange(item.key)}
          type="button"
        >
          <span className="mobile-nav__tag">{item.index}</span>
          <span className="mobile-nav__label">{item.mobileLabel ?? item.label}</span>
        </button>
      ))}
    </nav>
  )
}
