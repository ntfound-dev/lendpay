import { Card } from '../ui/Card'

interface IdentityCardProps {
  points: number
  tier: string
  username?: string
  verified?: boolean
}

export function IdentityCard({ points, tier, username, verified = false }: IdentityCardProps) {
  const identityLabel = username || 'Connect your .init'
  const monogram =
    identityLabel.replace('.init', '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'LP'

  return (
    <Card eyebrow="Linked identity" title="Trusted account" className="identity-card">
      <div className="identity-card__hero">
        <div className="identity-card__avatar">{monogram}</div>
        <div className="identity-card__hero-copy">
          <div className="identity-card__name">{identityLabel}</div>
          <div className="identity-card__badges">
            {verified ? <span className="identity-badge identity-badge--verified">Verified</span> : null}
            <span className="identity-badge identity-badge--tier">{tier} tier</span>
          </div>
        </div>
      </div>

      <div className="identity-card__subline">Ready for guided app access and repayment tracking</div>

      <div className="identity-card__foot">
        <span>Loyalty points</span>
        <strong>{points}</strong>
      </div>
    </Card>
  )
}
