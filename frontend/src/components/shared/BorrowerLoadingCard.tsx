import { Card } from '../ui/Card'

const syncSteps = [
  {
    index: '01',
    title: 'Wallet session',
    detail: 'Confirming your active signer and borrower identity.',
  },
  {
    index: '02',
    title: 'Live profile',
    detail: 'Loading credit limit, wallet balance, rewards, and score signals.',
  },
  {
    index: '03',
    title: 'Repayment watch',
    detail: 'Checking due dates, outstanding balance, and recent activity.',
  },
]

export function BorrowerLoadingCard() {
  return (
    <Card
      eyebrow="Syncing account"
      title="Preparing your live borrower dashboard"
      className="borrower-loading-card section-stack"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="borrower-loading-card__hero">
        <div className="borrower-loading-card__signal">
          <span className="borrower-loading-card__signal-dot" aria-hidden="true" />
          Live borrower data is syncing from the API
        </div>
        <p className="borrower-loading-card__copy">
          This usually only takes a moment after wallet sign-in. We are loading your limit,
          repayment state, wallet balance, and rewards so the first screen opens fully populated.
        </p>
      </div>

      <div className="borrower-loading-card__preview" aria-hidden="true">
        <div className="borrower-loading-card__surface borrower-loading-card__surface--hero">
          <div className="borrower-loading-card__chip-row">
            <div className="borrower-loading-card__chip" />
            <div className="borrower-loading-card__chip borrower-loading-card__chip--muted" />
          </div>
          <div className="skeleton-bar borrower-loading-card__display" />
          <div className="skeleton-bar borrower-loading-card__line borrower-loading-card__line--long" />
          <div className="skeleton-bar borrower-loading-card__line borrower-loading-card__line--medium" />

          <div className="borrower-loading-card__stat-grid">
            <div className="borrower-loading-card__mini-card">
              <div className="skeleton-bar borrower-loading-card__line borrower-loading-card__line--label" />
              <div className="skeleton-bar borrower-loading-card__line borrower-loading-card__line--value" />
            </div>
            <div className="borrower-loading-card__mini-card">
              <div className="skeleton-bar borrower-loading-card__line borrower-loading-card__line--label" />
              <div className="skeleton-bar borrower-loading-card__line borrower-loading-card__line--value borrower-loading-card__line--value-short" />
            </div>
          </div>
        </div>

        <div className="borrower-loading-card__surface borrower-loading-card__surface--side">
          <div className="borrower-loading-card__steps-label">What we are checking</div>
          <div className="borrower-loading-card__steps">
            {syncSteps.map((step) => (
              <div className="borrower-loading-card__step" key={step.index}>
                <span className="borrower-loading-card__step-index">{step.index}</span>
                <div className="borrower-loading-card__step-copy">
                  <strong>{step.title}</strong>
                  <span>{step.detail}</span>
                </div>
                <span className="borrower-loading-card__step-status" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
