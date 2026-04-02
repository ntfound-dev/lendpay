import { shortenAddress } from '../../lib/format'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

interface IdentityCardProps {
  address?: string
  autosignAvailable: boolean
  autosignEnabled: boolean
  onToggleAutosign: () => Promise<void> | void
  points: number
  tier: string
  username?: string
}

export function IdentityCard({
  address,
  autosignAvailable,
  autosignEnabled,
  onToggleAutosign,
  points,
  tier,
  username,
}: IdentityCardProps) {
  const identityLabel = username || shortenAddress(address)
  const hasUsername = Boolean(username)
  const monogram =
    identityLabel.replace('.init', '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() ||
    'LP'

  return (
    <Card
      eyebrow="Identity"
      title={identityLabel}
      actions={<span className="meta-pill">{tier} tier</span>}
      className="identity-card"
    >
      <div className="identity-card__lead">
        <div className="identity-card__identity">
          <div className="identity-card__crest">{monogram}</div>
          <div>
            <div className="metric-label">Primary identity</div>
            <div className="identity-card__name">{identityLabel}</div>
          </div>
        </div>
        <div className="identity-card__chip">{points} pts</div>
      </div>

      <div className="identity-grid">
        <div>
          <div className="metric-label">Initia address</div>
          <div className="mono-text">{shortenAddress(address)}</div>
        </div>
        <div>
          <div className="metric-label">Points</div>
          <div className="metric-value">{points}</div>
        </div>
      </div>

      <div className="identity-card__rail">
        <span className="meta-pill">{hasUsername ? 'Username linked' : 'Username not linked yet'}</span>
        <span className="meta-pill">Wallet session</span>
      </div>

      <div className="identity-actions">
        <div>
          <div className="metric-label">Wallet signing</div>
          <div className="muted-copy">
            {autosignAvailable
              ? autosignEnabled
                ? 'Autosign is active for this chain.'
                : 'You can enable autosign when the wallet supports it.'
              : 'Manual signing is fine for now.'}
          </div>
        </div>
        <Button variant="secondary" onClick={onToggleAutosign}>
          {autosignEnabled ? 'Disable Autosign' : 'Try Autosign'}
        </Button>
      </div>
    </Card>
  )
}
