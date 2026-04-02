import type { NavKey } from '../../types/domain'

interface SidebarProps {
  active: NavKey
  onChange: (value: NavKey) => void
}

const navItems: Array<{ key: NavKey; label: string; short: string; index: string }> = [
  { key: 'overview', label: 'Overview', short: 'Dashboard', index: '01' },
  { key: 'analyze', label: 'Analyze', short: 'Score details', index: '02' },
  { key: 'request', label: 'Request', short: 'New loan', index: '03' },
  { key: 'loan', label: 'Repayment', short: 'Payments', index: '04' },
  { key: 'rewards', label: 'Reputation', short: 'Rewards & tier', index: '05' },
  { key: 'admin', label: 'Operations', short: 'Admin tools', index: '06' },
]

export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <div className="sidebar__brand-wrap">
          <div className="sidebar__brandmark" aria-hidden="true">
            <svg className="sidebar__brandmark-svg" viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="lendpayMark" x1="10" y1="8" x2="56" y2="58" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#9FD2FF" />
                  <stop offset="0.55" stopColor="#58A6FF" />
                  <stop offset="1" stopColor="#2DD4BF" />
                </linearGradient>
              </defs>
              <rect x="9" y="9" width="46" height="46" rx="16" stroke="url(#lendpayMark)" strokeWidth="2.5" />
              <path d="M22 21V43H34" stroke="url(#lendpayMark)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M30 21H42C46.4183 21 50 24.5817 50 29C50 33.4183 46.4183 37 42 37H30" stroke="url(#lendpayMark)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="47" cy="18" r="4" fill="#F5A524" />
            </svg>
            <span className="sidebar__brandmark-tag">LP</span>
          </div>
          <div className="sidebar__brand-copy">
            <div className="sidebar__brand">LendPay</div>
            <div className="sidebar__tagline">AI credit app on Initia</div>
          </div>
        </div>

        <div className="sidebar__panel">
          <div className="sidebar__eyebrow">What the AI checks</div>
          <div className="sidebar__panel-title">
            Identity, wallet balance, and repayment history.
          </div>
          <p>The app explains those signals, sets a limit, and shows the next safe action.</p>
          <div className="sidebar__panel-metrics">
            <div className="sidebar__panel-metric">
              <span>Identity</span>
              <strong>.init</strong>
            </div>
            <div className="sidebar__panel-metric">
              <span>Balance</span>
              <strong>Wallet</strong>
            </div>
            <div className="sidebar__panel-metric">
              <span>Repayments</span>
              <strong>History</strong>
            </div>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar__link ${item.key === active ? 'sidebar__link--active' : ''}`}
              onClick={() => onChange(item.key)}
              type="button"
            >
              <div className="sidebar__link-copy">
                <span>{item.label}</span>
                <small>{item.short}</small>
              </div>
              <div className="sidebar__link-index">{item.index}</div>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  )
}
