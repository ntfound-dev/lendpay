import { formatCurrency, shortenAddress } from '../../lib/format'
import type { CreditScoreState, RewardsState, ScoreBreakdownItem, UsernameSource } from '../../types/domain'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { ScoreRing } from '../score/ScoreRing'
import { Button } from '../ui/Button'

export type ScoreBreakdownRow = {
  label: string
  percent: number | null
  tone: 'green' | 'blue'
  points: number | null
  status: string
}

type NextProfileMilestone = {
  title: string
  targetScore: number | null
  scoreGap: number | null
  detail: string
}

type AgentSignal = {
  label: string
  value: string
}

type ProfilePageProps = {
  agentEngineLabel: string
  agentSignals: AgentSignal[]
  handleRefreshUsernameVerification: () => void | Promise<void>
  initiaAddress?: string | null
  isRefreshingUsername: boolean
  nextProfileMilestone: NextProfileMilestone
  rewards: RewardsState | null
  riskBadgeTone: 'success' | 'warning' | 'danger'
  score: CreditScoreState | null
  scoreBreakdownRows: ScoreBreakdownRow[]
  scoreRefreshLabel: string
  technicalModeEnabled: boolean
  tierBadgeTone: 'warning' | 'info' | 'neutral'
  username?: string
  usernameSource?: UsernameSource
  usernameAttestedOnRollup: boolean
  usernameVerified: boolean
  usernameVerifiedOnL1: boolean
}

export function ProfilePage({
  agentEngineLabel,
  agentSignals,
  handleRefreshUsernameVerification,
  initiaAddress,
  isRefreshingUsername,
  nextProfileMilestone,
  rewards,
  riskBadgeTone,
  score,
  scoreBreakdownRows,
  scoreRefreshLabel,
  technicalModeEnabled,
  tierBadgeTone,
  username,
  usernameAttestedOnRollup,
  usernameSource,
  usernameVerified,
  usernameVerifiedOnL1,
}: ProfilePageProps) {
  const hasConnectedWallet = Boolean(initiaAddress)
  const hasDetectedUsername = Boolean(username)
  const hasL1Identity = usernameVerifiedOnL1 || usernameSource === 'initia_l1'
  const hasRollupIdentity = usernameAttestedOnRollup
  const hasVerifiedIdentity = usernameVerified || hasRollupIdentity || hasL1Identity
  const avatarLabel =
    (username || initiaAddress || 'Z2')
      .replace('.init', '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 2)
      .toUpperCase() || 'Z2'
  const hasWalletOnlyUsername = Boolean(username && !hasVerifiedIdentity && !usernameSource)
  const shouldOfferIdentityRefresh = hasConnectedWallet && (!hasVerifiedIdentity || !usernameAttestedOnRollup)
  const linkedIdentityLabel = hasVerifiedIdentity
    ? score?.signals?.username ?? username ?? 'Not available yet'
    : username
      ? username
      : hasConnectedWallet
        ? 'Wallet connected'
        : 'Not connected'
  const identityBadgeTone =
    hasVerifiedIdentity ? 'success' : hasWalletOnlyUsername || hasConnectedWallet ? 'info' : 'warning'
  const identityBadgeLabel = hasVerifiedIdentity
    ? hasRollupIdentity && hasL1Identity
      ? 'L1 + rollup verified'
      : hasRollupIdentity
        ? 'Verified on rollup'
        : hasL1Identity
          ? 'Verified on Initia L1'
          : 'Verified identity'
    : hasWalletOnlyUsername
      ? 'Wallet username'
      : usernameSource === 'preview'
        ? 'Preview username'
        : username
          ? 'Unverified'
          : hasConnectedWallet
            ? 'Wallet connected'
            : 'Not linked'
  const identityActionLabel =
    hasVerifiedIdentity || hasDetectedUsername ? 'Re-check L1 + rollup' : 'Check L1 + rollup'
  const identityActionHint = usernameSource === 'preview'
    ? 'This clears preview identity data and re-checks both the live Initia L1 username module and the LendPay rollup reputation state for the connected wallet.'
    : hasL1Identity && !hasRollupIdentity
      ? 'This re-checks whether the live .init already found on Initia L1 is now attested inside the LendPay rollup. On live backends, LendPay also tries to write the missing attestation automatically.'
      : hasRollupIdentity && !hasL1Identity
        ? 'This re-checks whether the username already attested inside the LendPay rollup can also be resolved from the live Initia L1 username module.'
        : 'This checks two identity layers for the exact connected wallet address: the live Initia L1 username module and the LendPay rollup reputation state.'
  const identitySubline = hasVerifiedIdentity
    ? hasRollupIdentity && hasL1Identity
      ? 'Verified on Initia L1 and attested into the LendPay rollup.'
      : hasRollupIdentity
        ? 'Identity is attested inside the LendPay rollup. A live Initia L1 .init lookup has not been confirmed for this wallet yet.'
        : hasL1Identity
          ? 'A live .init username was found on Initia L1, but the LendPay rollup does not show an attestation for this wallet yet.'
          : 'Identity verified and ready for Initia app credit.'
    : hasWalletOnlyUsername
      ? 'Username detected in the connected wallet, but no live Initia L1 verification or rollup attestation was found yet.'
      : usernameSource === 'preview'
        ? 'This username came from preview mode and is not accepted as live identity.'
        : username
          ? 'Identity is present, but no live Initia L1 verification or rollup attestation was found yet.'
          : hasConnectedWallet
            ? 'Wallet is connected, but no live .init username or rollup attestation was found for this wallet yet.'
            : 'Connect a wallet with a .init username to strengthen identity checks.'
  const identityLayerHint = hasConnectedWallet
    ? '.init usernames live on Initia L1. LendPay checks the exact connected wallet address on L1, then uses the rollup reputation state as a separate attestation layer. If your .init lives on a different L1 account, this wallet will still show Not found yet. When L1 verification is found for this same address, refresh can also promote it into rollup attestation on live backends.'
    : 'Connect a wallet to check Initia L1 username status and LendPay rollup attestation.'

  return (
    <>
      <div className="profile-layout">
        <div className="profile-layout__main">
          <Card
            title="Credit score estimate"
            actions={<span className="profile-card__meta">Last refreshed {scoreRefreshLabel}</span>}
            className="profile-score-card"
          >
            {score ? (
              <>
                <ScoreRing score={score.score} />
                <div className="profile-score-card__badges">
                  <Badge tone={riskBadgeTone}>{score.risk} risk</Badge>
                  <Badge tone="info">APR {score.apr}%</Badge>
                  {score.source === 'preview' ? <Badge tone="warning">Preview model</Badge> : null}
                </div>
              </>
            ) : (
              <p className="muted-copy">
                No score yet. Refresh once and LendPay will model your wallet and repayment state.
              </p>
            )}
          </Card>

          <Card title="What affects your score" className="profile-breakdown-card section-stack">
            {score ? (
              <div className="profile-breakdown">
                {scoreBreakdownRows.map((item) => (
                  <div className="profile-breakdown__row" key={item.label}>
                    <div className="profile-breakdown__header">
                      <div className="profile-breakdown__label">{item.label}</div>
                      <div className="profile-breakdown__points">
                        {item.points === null ? '—' : `${item.points} pts`}
                      </div>
                    </div>
                    <div className="profile-breakdown__bar">
                      <div
                        className={`profile-breakdown__fill profile-breakdown__fill--${item.tone}`}
                        style={{ width: `${item.percent ?? 0}%` }}
                      />
                    </div>
                    <div className="profile-breakdown__meta">
                      <span>{item.percent === null ? 'Not available' : `${item.percent}%`}</span>
                      <strong>{item.status}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-copy">
                Re-analyze once and LendPay will show the score factors behind your current profile.
              </p>
            )}
          </Card>
        </div>

        <div className="profile-layout__side">
          <Card title="Estimated terms today" className="profile-terms-card">
            <div className="profile-terms">
              <div className="profile-terms__row">
                <span>Estimated credit limit</span>
                <strong className="profile-terms__value profile-terms__value--large">
                  {score ? formatCurrency(score.limitUsd) : 'Not available yet'}
                </strong>
              </div>
              <div className="profile-terms__row">
                <span>Risk band</span>
                <Badge tone={riskBadgeTone}>{score?.risk ?? 'Analyze first'}</Badge>
              </div>
              <div className="profile-terms__row">
                <span>Identity status</span>
                <strong className="profile-terms__value profile-terms__value--identity">
                  {linkedIdentityLabel}
                </strong>
              </div>
              <div className="profile-terms__row">
                <span>Estimated APR</span>
                <strong className="profile-terms__value">
                  {score ? `${score.apr}%` : 'Analyze first'}
                </strong>
              </div>
              <div className="profile-terms__row">
                <span>Tier</span>
                <Badge tone={tierBadgeTone}>{rewards?.tier ?? 'Tier pending'}</Badge>
              </div>
            </div>
          </Card>

          <Card
            eyebrow="Next milestone"
            title={nextProfileMilestone.title}
            className="profile-next-step-card section-stack"
          >
            <div className="profile-next-step-card__stats">
              <div className="profile-next-step-card__stat">
                <span>Target score</span>
                <strong>{nextProfileMilestone.targetScore ?? '--'}</strong>
              </div>
              <div className="profile-next-step-card__stat">
                <span>Points away</span>
                <strong>{nextProfileMilestone.scoreGap ?? '--'}</strong>
              </div>
            </div>
            <p className="profile-next-step-card__body">{nextProfileMilestone.detail}</p>
          </Card>

          <Card title="Identity status" className="profile-identity-card section-stack">
            <div className="profile-identity-card__hero">
              <div className="profile-identity-card__avatar">{avatarLabel}</div>
              <div className="profile-identity-card__copy">
                <div className="profile-identity-card__name">
                  {username ?? (initiaAddress ? shortenAddress(initiaAddress) : 'Identity unavailable')}
                </div>
                <div className="profile-identity-card__badges">
                  <Badge tone={identityBadgeTone}>{identityBadgeLabel}</Badge>
                  {rewards?.tier ? <Badge tone={tierBadgeTone}>{rewards.tier}</Badge> : null}
                </div>
              </div>
            </div>

            <div className="identity-steps">
              <div className={`identity-step${hasL1Identity ? ' identity-step--done' : ' identity-step--pending'}`}>
                <div className="identity-step__icon">{hasL1Identity ? '✓' : '1'}</div>
                <div className="identity-step__body">
                  <div className="identity-step__label">Initia L1 username</div>
                  {hasL1Identity ? (
                    <div className="identity-step__value">
                      {score?.signals?.username ?? username ?? 'Found'}
                    </div>
                  ) : hasConnectedWallet ? (
                    <>
                      <div className="identity-step__value">No .init name on this address yet</div>
                      <a
                        className="identity-step__link"
                        href="https://app.testnet.initia.xyz"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Register at app.testnet.initia.xyz ↗
                      </a>
                    </>
                  ) : (
                    <div className="identity-step__value">Connect a wallet first</div>
                  )}
                </div>
              </div>

              <div className={`identity-step${hasRollupIdentity ? ' identity-step--done' : hasL1Identity ? ' identity-step--pending' : ' identity-step--locked'}`}>
                <div className="identity-step__icon">{hasRollupIdentity ? '✓' : '2'}</div>
                <div className="identity-step__body">
                  <div className="identity-step__label">LendPay rollup attestation</div>
                  <div className="identity-step__value">
                    {hasRollupIdentity
                      ? 'Attested'
                      : hasL1Identity
                        ? 'Click Re-check to verify'
                        : 'Automatic after step 1'}
                  </div>
                </div>
              </div>
            </div>

            {!hasVerifiedIdentity && hasConnectedWallet ? (
              <div className="identity-bonus-callout">
                <span className="identity-bonus-callout__pts">+25 pts</span>
                <span>added to your credit score once identity is verified</span>
              </div>
            ) : null}

            {shouldOfferIdentityRefresh ? (
              <Button
                variant="secondary"
                onClick={handleRefreshUsernameVerification}
                disabled={isRefreshingUsername}
              >
                {isRefreshingUsername
                  ? 'Checking...'
                  : hasL1Identity
                    ? 'Re-check rollup attestation'
                    : 'Re-check L1 + rollup'}
              </Button>
            ) : null}

            <div className="profile-identity-card__wallet">
              <span>Connected wallet</span>
              <strong>{initiaAddress ? shortenAddress(initiaAddress) : 'Not connected'}</strong>
            </div>
          </Card>
        </div>
      </div>

      {technicalModeEnabled ? (
        <Card eyebrow="Technical details" title="Hidden underwriting details" className="grid section-stack">
          {score ? (
            <>
              <div className="summary">
                <div className="summary-row">
                  <span>Engine</span>
                  <strong>{agentEngineLabel}</strong>
                </div>
                <div className="summary-row">
                  <span>Model</span>
                  <strong>{score.model ?? 'Not available'}</strong>
                </div>
                <div className="summary-row">
                  <span>Signal anchor</span>
                  <strong>{score.signals?.username ?? 'Not available'}</strong>
                </div>
              </div>
              {score.signals ? (
                <div className="analysis-signal-grid">
                  {agentSignals.map((item) => (
                    <div className="analysis-signal" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-copy">Run wallet analysis to generate live signals.</p>
              )}
              <div className="breakdown">
                {score.breakdown.map((item: ScoreBreakdownItem) => (
                  <div className="breakdown__row" key={item.label}>
                    <div>
                      <div className="request-row__title">{item.label}</div>
                      <div className="muted-copy">{item.detail}</div>
                    </div>
                    <div className="breakdown__points">+{item.points}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="muted-copy">
              Refresh your profile first to unlock technical underwriting detail.
            </p>
          )}
        </Card>
      ) : null}
    </>
  )
}
