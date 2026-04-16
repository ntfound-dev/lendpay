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
  const avatarLabel =
    (username || 'Z2')
      .replace('.init', '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 2)
      .toUpperCase() || 'Z2'
  const hasWalletOnlyUsername = Boolean(username && !usernameVerified && !usernameSource)
  const linkedIdentityLabel = usernameVerified
    ? score?.signals?.username ?? username ?? 'Not available yet'
    : username
      ? username
      : 'Wallet only'
  const identityBadgeTone =
    usernameVerified ? 'success' : hasWalletOnlyUsername ? 'info' : username ? 'warning' : 'warning'
  const identityBadgeLabel = usernameVerified
    ? usernameAttestedOnRollup && usernameVerifiedOnL1
      ? 'L1 + rollup verified'
      : usernameAttestedOnRollup
        ? 'Verified on rollup'
        : usernameVerifiedOnL1 || usernameSource === 'initia_l1'
          ? 'Verified on Initia L1'
          : 'Verified identity'
    : hasWalletOnlyUsername
      ? 'Wallet username'
      : usernameSource === 'preview'
        ? 'Preview username'
        : username
          ? 'Unverified'
          : 'Not linked'
  const identityActionLabel =
    hasWalletOnlyUsername || usernameSource === 'preview' ? 'Check live identity' : 'Refresh identity status'
  const identityActionHint = hasWalletOnlyUsername
    ? 'This re-checks whether the same wallet has already been verified by Initia or attested on the LendPay rollup.'
    : usernameSource === 'preview'
      ? 'This clears preview identity data and re-checks live Initia or rollup identity status for the connected wallet.'
      : 'Use this to re-check live Initia or rollup identity status for the connected wallet.'
  const identitySubline = usernameVerified
    ? usernameAttestedOnRollup && usernameVerifiedOnL1
      ? 'Verified on Initia L1 and attested into the LendPay rollup.'
      : usernameAttestedOnRollup
        ? 'Identity is attested inside the LendPay rollup and ready for app credit.'
        : usernameVerifiedOnL1 || usernameSource === 'initia_l1'
          ? 'Identity is verified on Initia L1 and ready for borrower checks.'
          : 'Identity verified and ready for Initia app credit.'
    : hasWalletOnlyUsername
      ? 'Username detected in the connected wallet, but LendPay has not verified it onchain yet.'
      : usernameSource === 'preview'
        ? 'This username came from preview mode and is not accepted as live identity.'
        : username
          ? 'Identity is present, but live verification is still missing.'
          : 'Connect a wallet with a .init username to strengthen identity checks.'

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
                  {usernameVerifiedOnL1 ? <Badge tone="info">Initia L1</Badge> : null}
                  {usernameAttestedOnRollup ? <Badge tone="success">Rollup attested</Badge> : null}
                  {rewards?.tier ? <Badge tone={tierBadgeTone}>{rewards.tier}</Badge> : null}
                </div>
                <div className="profile-identity-card__subline">
                  {identitySubline}
                </div>
              </div>
            </div>

            {username && (!usernameVerified || !usernameAttestedOnRollup) ? (
              <div className="card-action-row">
                <Button onClick={handleRefreshUsernameVerification} disabled={isRefreshingUsername}>
                  {isRefreshingUsername ? 'Checking live identity...' : identityActionLabel}
                </Button>
                <span className="muted-copy">
                  {identityActionHint}
                </span>
              </div>
            ) : null}

            <div className="profile-identity-card__wallet">
              <span>Wallet address</span>
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
