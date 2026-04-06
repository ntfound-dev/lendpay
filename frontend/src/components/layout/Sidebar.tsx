import type { NavKey } from '../../types/domain'

interface SidebarProps {
  active: NavKey
  assistantDetail: string
  assistantLabel: string
  connected: boolean
  identityLabel: string
  onChange: (value: NavKey) => void
}

const navItems: Array<{ key: NavKey; label: string; index: string }> = [
  { key: 'overview', label: 'Overview', index: '01' },
  { key: 'analyze', label: 'Profile', index: '02' },
  { key: 'request', label: 'Request', index: '03' },
  { key: 'loan', label: 'Repay', index: '04' },
  { key: 'rewards', label: 'Loyalty Hub', index: '05' },
  { key: 'admin', label: 'Ecosystem', index: '06' },
]

export function Sidebar({
  active,
  assistantDetail,
  assistantLabel,
  connected,
  identityLabel,
  onChange,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <div className="sidebar__brand-wrap">
          <div className="sidebar__brand-copy">
            <div className="sidebar__brand">LendPay</div>
            <div className="sidebar__tagline">Pay later across Initia apps</div>
          </div>
        </div>

        <div className="sidebar__wallet">
          <span className={`sidebar__wallet-dot ${connected ? 'sidebar__wallet-dot--live' : ''}`} />
          <div className="sidebar__wallet-copy">
            <span>Wallet</span>
            <strong>{identityLabel}</strong>
          </div>
        </div>

        <div className="sidebar__assistant">
          <div className="sidebar__assistant-head">
            <span className="sidebar__assistant-dot" aria-hidden="true" />
            <strong>Agent status</strong>
          </div>
          <div className="sidebar__assistant-label">{assistantLabel}</div>
          <p>{assistantDetail}</p>
        </div>

        <nav className="sidebar__nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar__link ${item.key === active ? 'sidebar__link--active' : ''}`}
              onClick={() => onChange(item.key)}
              type="button"
            >
              <div className="sidebar__link-index">{item.index}</div>
              <div className="sidebar__link-copy">
                <span>{item.label}</span>
              </div>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  )
}
