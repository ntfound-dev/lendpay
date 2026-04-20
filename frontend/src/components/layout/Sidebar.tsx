import { useEffect, useState } from 'react'
import type { NavKey } from '../../types/domain'
import { getVisibleNavItems } from '../../lib/nav'
import { Button } from '../ui/Button'

interface SidebarProps {
  active: NavKey
  accountActionDisabled?: boolean
  accountActionLabel?: string
  assistantDetail: string
  assistantLabel: string
  connected: boolean
  identityLabel: string
  onAccountAction?: () => void
  onChange: (value: NavKey) => void
}

export function Sidebar({
  active,
  accountActionDisabled = false,
  accountActionLabel,
  assistantDetail,
  assistantLabel,
  connected,
  identityLabel,
  onAccountAction,
  onChange,
}: SidebarProps) {
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false)
  const visibleNavItems = getVisibleNavItems(connected)

  useEffect(() => {
    if (!connected) {
      setIsWalletMenuOpen(false)
    }
  }, [connected])

  const canToggleWalletMenu = connected && Boolean(accountActionLabel && onAccountAction)

  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <div className="sidebar__brand-wrap">
          <div className="sidebar__brandmark" aria-hidden="true">
            <img
              className="sidebar__brandmark-svg"
              src="/favicon.svg"
              alt=""
            />
          </div>
          <div className="sidebar__brand-copy">
            <div className="sidebar__brand">LendPay</div>
            <div className="sidebar__tagline">Pay later across Initia apps</div>
          </div>
        </div>

        <div className={`sidebar__wallet-panel ${isWalletMenuOpen ? 'sidebar__wallet-panel--open' : ''}`}>
          <button
            aria-controls="sidebar-wallet-actions"
            aria-expanded={canToggleWalletMenu ? isWalletMenuOpen : undefined}
            className={`sidebar__wallet ${canToggleWalletMenu ? 'sidebar__wallet--interactive' : ''}`}
            onClick={() => {
              if (!canToggleWalletMenu) return
              setIsWalletMenuOpen((current) => !current)
            }}
            type="button"
          >
            <span className={`sidebar__wallet-dot ${connected ? 'sidebar__wallet-dot--live' : ''}`} />
            <div className="sidebar__wallet-copy">
              <span>Wallet</span>
              <strong>{identityLabel}</strong>
            </div>
            {canToggleWalletMenu ? (
              <span className="sidebar__wallet-toggle" aria-hidden="true">
                {isWalletMenuOpen ? 'Hide' : 'Open'}
              </span>
            ) : null}
          </button>

          {canToggleWalletMenu && isWalletMenuOpen ? (
            <div className="sidebar__wallet-actions" id="sidebar-wallet-actions">
              <Button
                variant="danger"
                wide
                onClick={onAccountAction}
                disabled={accountActionDisabled}
              >
                {accountActionLabel}
              </Button>
            </div>
          ) : null}
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
          {visibleNavItems.map((item) => (
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
