import type { Dispatch, SetStateAction } from 'react'
import {
  BADGE_COST,
  INTEREST_DISCOUNT_COST_PER_PERCENT,
  LIMIT_BOOST_COST,
  PREMIUM_CHECK_COST,
  REDEEM_LEND_OUTPUT,
  REDEEM_POINTS_BASE,
  titleCase,
} from '../../lib/appHelpers'
import {
  formatDate,
  formatNumber,
  formatPoints,
  shortenAddress,
} from '../../lib/format'
import type {
  LeaderboardEntry,
  ReferralState,
  RewardsState,
} from '../../types/domain'
import { EmptyState } from '../shared/EmptyState'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

type BenefitRow = {
  label: string
  current: string
  next: string
}

type LoyaltyHubPageProps = {
  benefitRows: BenefitRow[]
  canClaimAvailableRewards: boolean
  currentLeaderboardRows: LeaderboardEntry[]
  currentTier: RewardsState['tier'] | null
  handleApplyReferralCode: () => void | Promise<void>
  handleBuyInterestDiscount: () => void | Promise<void>
  handleBuyLimitBoost: () => void | Promise<void>
  handleClaimAvailableRewards: () => void | Promise<void>
  handleCopyReferralCode: () => void | Promise<void>
  handleDismissWalletRecovery: () => void | Promise<void>
  handleOpenWalletApproval: () => void | Promise<void>
  handleRedeemBadge: () => void | Promise<void>
  handleRedeemPointsToLend: () => void | Promise<void>
  handleRetryLoad: () => void | Promise<void>
  handleShareReferralCode: () => void | Promise<void>
  handleStake: () => void | Promise<void>
  handleUnlockPremiumCheck: () => void | Promise<void>
  handleUnstake: () => void | Promise<void>
  hasLendInventory: boolean
  hasPointInventory: boolean
  heldLendAmount: number
  initiaAddress?: string | null
  interestDiscountPercent: string
  isApplyingReferral: boolean
  isProtocolActionPending: (key: string) => boolean
  leaderboardMyRank?: number
  leaderboardTab: 'borrowers' | 'repayers' | 'referrers' | 'risingStars'
  leaderboardTabMeta: string
  loyaltyHeroUsername: string
  redeemPointsAmount: string
  redeemPreviewLend: number
  referral: ReferralState | null
  referralCodeInput: string
  rewards: RewardsState | null
  sectionErrors: Partial<Record<string, string>>
  showWalletRecovery: boolean
  setInterestDiscountPercent: Dispatch<SetStateAction<string>>
  setLeaderboardTab: Dispatch<
    SetStateAction<'borrowers' | 'repayers' | 'referrers' | 'risingStars'>
  >
  setRedeemPointsAmount: Dispatch<SetStateAction<string>>
  setReferralCodeInput: Dispatch<SetStateAction<string>>
  setStakeAmount: Dispatch<SetStateAction<string>>
  setUnstakeAmount: Dispatch<SetStateAction<string>>
  stakeAmount: string
  streakLabel: string
  technicalModeEnabled: boolean
  tierNote: string | null
  tierProgressLabel: string
  tierProgressPercent: number
  nextTierTargetLabel: string
  unstakeAmount: string
}

export function LoyaltyHubPage({
  benefitRows,
  canClaimAvailableRewards,
  currentLeaderboardRows,
  currentTier,
  handleApplyReferralCode,
  handleBuyInterestDiscount,
  handleBuyLimitBoost,
  handleClaimAvailableRewards,
  handleCopyReferralCode,
  handleDismissWalletRecovery,
  handleOpenWalletApproval,
  handleRedeemBadge,
  handleRedeemPointsToLend,
  handleRetryLoad,
  handleShareReferralCode,
  handleStake,
  handleUnlockPremiumCheck,
  handleUnstake,
  hasLendInventory,
  hasPointInventory,
  heldLendAmount,
  initiaAddress,
  interestDiscountPercent,
  isApplyingReferral,
  isProtocolActionPending,
  leaderboardMyRank,
  leaderboardTab,
  leaderboardTabMeta,
  loyaltyHeroUsername,
  redeemPointsAmount,
  redeemPreviewLend,
  referral,
  referralCodeInput,
  rewards,
  sectionErrors,
  showWalletRecovery,
  setInterestDiscountPercent,
  setLeaderboardTab,
  setRedeemPointsAmount,
  setReferralCodeInput,
  setStakeAmount,
  setUnstakeAmount,
  stakeAmount,
  streakLabel,
  technicalModeEnabled,
  tierNote,
  tierProgressLabel,
  tierProgressPercent,
  nextTierTargetLabel,
  unstakeAmount,
}: LoyaltyHubPageProps) {
  return (
    <>
      <Card className="loyalty-hero-card">
        <div className="loyalty-hero-card__header">
          <div className="loyalty-hero-card__identity">
            <div className="loyalty-hero-card__avatar">
              {loyaltyHeroUsername
                .replace('.init', '')
                .replace(/[^a-zA-Z0-9]/g, '')
                .slice(0, 2)
                .toUpperCase() || 'Z2'}
            </div>
            <div className="loyalty-hero-card__copy">
              <div className="loyalty-hero-card__name">{loyaltyHeroUsername}</div>
              <div className="loyalty-hero-card__badges">
                <Badge tone="success">Verified</Badge>
              </div>
              <p className="loyalty-hero-card__streak">{streakLabel}</p>
            </div>
          </div>
          <Badge tone="warning">{currentTier ? `${currentTier} tier` : 'Tier unavailable'}</Badge>
        </div>
      </Card>

      <div className="loyalty-sections section-stack">
        <Card
          eyebrow="Your points"
          title={rewards ? `${formatPoints(rewards.points)} points` : 'Points unavailable'}
          className="loyalty-panel"
        >
          <div className="loyalty-panel__stack">
            <div className="loyalty-info-strip">
              <span>Repay on time</span>
              <span>→</span>
              <span>Earn points</span>
              <span>→</span>
              <span>Unlock perks</span>
            </div>
            {tierNote ? <div className="loyalty-panel__note">{tierNote}</div> : null}
          </div>
        </Card>

        <Card eyebrow="Your LEND" title={`${formatNumber(heldLendAmount)} total LEND`} className="loyalty-panel">
          <div className="loyalty-lend-grid">
            <div className="loyalty-lend-stat">
              <span>Liquid</span>
              <strong>{formatNumber(rewards?.liquidLend ?? 0)} LEND</strong>
            </div>
            <div className="loyalty-lend-stat">
              <span>Claimable</span>
              <strong>{formatNumber(rewards?.claimableLend ?? 0)} LEND</strong>
            </div>
            <div className="loyalty-lend-stat">
              <span>Staked</span>
              <strong>{formatNumber(rewards?.stakedLend ?? 0)} LEND</strong>
            </div>
            <div className="loyalty-lend-stat">
              <span>Staking rewards</span>
              <strong>{formatNumber(rewards?.claimableStakingRewards ?? 0)} LEND</strong>
            </div>
          </div>
          <div className="loyalty-panel__actions">
            <Button
              onClick={handleClaimAvailableRewards}
              disabled={!canClaimAvailableRewards || isProtocolActionPending('claim-all')}
            >
              {isProtocolActionPending('claim-all')
                ? 'Claiming rewards...'
                : `Claim ${formatNumber((rewards?.claimableLend ?? 0) + (rewards?.claimableStakingRewards ?? 0))} LEND`}
            </Button>
          </div>
          {showWalletRecovery ? (
            <div className="wallet-recovery">
              <p>Wallet is not responding. Check your extension for a pending transaction.</p>
              <div className="wallet-recovery__actions">
                <Button onClick={handleOpenWalletApproval}>
                  Open wallet
                </Button>
                <Button variant="secondary" onClick={handleDismissWalletRecovery}>
                  Dismiss
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid--2 section-stack">
        <Card eyebrow="Referral" title="Your referral code" className="loyalty-panel">
          {sectionErrors.referral ? (
            <EmptyState
              title="Referral data unavailable"
              subtitle={sectionErrors.referral}
              actionLabel="Retry load"
              onAction={handleRetryLoad}
            />
          ) : referral ? (
            <>
              <div className="referral-code-box">
                <div>
                  <div className="referral-code">{referral.referralCode}</div>
                  <div className="muted-copy">
                    Invite healthy borrowers. You earn when they borrow and keep repaying on time.
                  </div>
                </div>
                <div className="card-action-row">
                  <Button variant="secondary" onClick={handleCopyReferralCode}>
                    Copy
                  </Button>
                  <Button onClick={handleShareReferralCode}>Share</Button>
                </div>
              </div>

              {!referral.referredBy ? (
                <div className="referral-apply-box">
                  <label htmlFor="referralCode">Apply a referral code</label>
                  <div className="referral-apply">
                    <input
                      id="referralCode"
                      type="text"
                      placeholder="Enter referral code"
                      value={referralCodeInput}
                      onChange={(event) => setReferralCodeInput(event.target.value.toUpperCase())}
                      maxLength={20}
                    />
                    <Button
                      onClick={handleApplyReferralCode}
                      disabled={isApplyingReferral || !referralCodeInput.trim()}
                    >
                      {isApplyingReferral ? 'Applying...' : 'Apply code'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="loyalty-panel__note">
                  Referral already linked to {shortenAddress(referral.referredBy)}.
                </div>
              )}

              <div className="loyalty-lend-grid">
                <div className="loyalty-lend-stat">
                  <span>Total referrals</span>
                  <strong>{formatNumber(referral.totalReferrals)}</strong>
                </div>
                <div className="loyalty-lend-stat">
                  <span>Active referrals</span>
                  <strong>{formatNumber(referral.activeReferrals)}</strong>
                </div>
                <div className="loyalty-lend-stat">
                  <span>Referral points</span>
                  <strong>{formatNumber(referral.pointsEarned)}</strong>
                </div>
              </div>
            </>
          ) : (
            <p className="muted-copy">Referral tools appear after your account sync finishes.</p>
          )}
        </Card>

        <Card eyebrow="Referral list" title="Your referral activity" className="loyalty-panel">
          {sectionErrors.referral ? (
            <EmptyState
              title="Referral list unavailable"
              subtitle={sectionErrors.referral}
              actionLabel="Retry load"
              onAction={handleRetryLoad}
            />
          ) : referral?.referralList.length ? (
            <div className="referral-list">
              {referral.referralList.map((entry) => (
                <div className="referral-row" key={entry.address}>
                  <div className="referral-row__identity">
                    <div className="request-row__title">
                      {entry.username ?? shortenAddress(entry.address)}
                    </div>
                    <div className="muted-copy">Joined {formatDate(entry.joinedAt)}</div>
                  </div>
                  <Badge
                    tone={
                      entry.status === 'active'
                        ? 'success'
                        : entry.status === 'defaulted'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {titleCase(entry.status)}
                  </Badge>
                  <div className="referral-row__points">
                    <span>Points</span>
                    <strong>{formatNumber(entry.pointsGenerated)}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No referrals yet"
              subtitle="Share your code once your friends are ready to borrow and repay responsibly."
            />
          )}
        </Card>
      </div>

      <Card eyebrow="Leaderboard" title="Healthy borrower rankings" className="story-card section-stack">
        {sectionErrors.leaderboard ? (
          <EmptyState
            title="Leaderboard unavailable"
            subtitle={sectionErrors.leaderboard}
            actionLabel="Retry load"
            onAction={handleRetryLoad}
          />
        ) : (
          <>
            <div className="leaderboard-tabs">
              {[
                ['borrowers', 'Top Borrowers'],
                ['repayers', 'Top Repayers'],
                ['referrers', 'Top Referrers'],
                ['risingStars', 'Rising Stars'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`leaderboard-tab ${leaderboardTab === key ? 'leaderboard-tab--active' : ''}`}
                  type="button"
                  onClick={() =>
                    setLeaderboardTab(
                      key as 'borrowers' | 'repayers' | 'referrers' | 'risingStars',
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="loyalty-panel__hint">{leaderboardTabMeta}</div>

            {currentLeaderboardRows.length ? (
              <div className="leaderboard-list">
                {currentLeaderboardRows.map((entry) => (
                  <div
                    className={`leaderboard-row ${entry.address === initiaAddress ? 'leaderboard-row--me' : ''}`}
                    key={`${leaderboardTab}-${entry.address}`}
                  >
                    <div
                      className={`rank-badge ${
                        entry.rank === 1
                          ? 'rank-badge--1'
                          : entry.rank === 2
                            ? 'rank-badge--2'
                            : entry.rank === 3
                              ? 'rank-badge--3'
                              : 'rank-badge--other'
                      }`}
                    >
                      {entry.rank}
                    </div>
                    <div className="leaderboard-row__identity">
                      <div className="request-row__title">
                        {entry.username ?? shortenAddress(entry.address)}
                      </div>
                      <div className="muted-copy">{entry.metric}</div>
                    </div>
                    <div className="leaderboard-row__meta">
                      <strong>{entry.value}</strong>
                      <Badge
                        tone={
                          entry.tier === 'Gold' || entry.tier === 'Diamond'
                            ? 'warning'
                            : entry.tier === 'Silver'
                              ? 'info'
                              : 'neutral'
                        }
                      >
                        {entry.tier}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No leaderboard data yet"
                subtitle="Borrower rankings appear after more live activity is recorded."
              />
            )}

            {leaderboardMyRank ? (
              <div className="loyalty-panel__hint">Your current rank: #{leaderboardMyRank}</div>
            ) : null}
          </>
        )}
      </Card>

      <Card eyebrow="Tier benefits" title="What unlocks next" className="loyalty-benefits-card section-stack">
        <div className="loyalty-benefits-card__header">
          <div>
            <div className="loyalty-benefits-card__tier">
              {currentTier ? `${currentTier} tier` : 'Tier unavailable'}
            </div>
            <div className="loyalty-benefits-card__distance">{tierProgressLabel}</div>
          </div>
          <div className="loyalty-benefits-card__held">{formatNumber(heldLendAmount)} LEND held</div>
        </div>
        <div className="tier-progress">
          <div className="tier-progress__bar">
            <div
              className="tier-progress__fill"
              style={{ width: `${tierProgressPercent}%` }}
            />
          </div>
          <div className="tier-progress__labels">
            <span>{formatNumber(heldLendAmount)} LEND held</span>
            <span>{nextTierTargetLabel}</span>
          </div>
        </div>
        <div className="loyalty-benefits-list">
          {benefitRows.map((item) => (
            <div className="loyalty-benefits-list__row" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.current}</strong>
              <small>{item.next}</small>
            </div>
          ))}
        </div>
      </Card>

      {technicalModeEnabled ? (
        <div className="grid--2">
          <Card eyebrow="Advanced LEND actions" title="Stake and manage protocol inventory" className="story-card">
            {hasLendInventory ? (
              <>
                <div className="summary">
                  <div className="summary-row">
                    <span>Liquid balance</span>
                    <strong>{rewards ? formatNumber(rewards.liquidLend) : '0'}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Currently staked</span>
                    <strong>{rewards ? formatNumber(rewards.stakedLend) : '0'}</strong>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="stakeAmount">Stake amount</label>
                  <input
                    id="stakeAmount"
                    type="number"
                    min="1"
                    value={stakeAmount}
                    onChange={(event) => setStakeAmount(event.target.value)}
                  />
                </div>
                <div className="card-action-row">
                  <Button
                    onClick={handleStake}
                    disabled={isProtocolActionPending('stake') || !rewards?.liquidLend}
                  >
                    {isProtocolActionPending('stake') ? 'Staking...' : 'Stake'}
                  </Button>
                </div>
                <div className="field">
                  <label htmlFor="unstakeAmount">Unstake amount</label>
                  <input
                    id="unstakeAmount"
                    type="number"
                    min="1"
                    value={unstakeAmount}
                    onChange={(event) => setUnstakeAmount(event.target.value)}
                  />
                </div>
                <div className="card-action-row">
                  <Button
                    onClick={handleUnstake}
                    variant="secondary"
                    disabled={isProtocolActionPending('unstake') || !rewards?.stakedLend}
                  >
                    {isProtocolActionPending('unstake') ? 'Unstaking...' : 'Unstake'}
                  </Button>
                </div>
              </>
            ) : (
              <p className="muted-copy">
                Claim LEND from borrower rewards first. Once you hold LEND, you can stake it here
                for protocol fee rewards.
              </p>
            )}
          </Card>

          <Card eyebrow="Advanced point actions" title="Convert and spend points" className="story-card">
            {hasPointInventory ? (
              <>
                <div className="summary">
                  <div className="summary-row">
                    <span>Conversion rule</span>
                    <strong>
                      {REDEEM_POINTS_BASE} pts = {REDEEM_LEND_OUTPUT} LEND
                    </strong>
                  </div>
                  <div className="summary-row">
                    <span>Current points</span>
                    <strong>{rewards ? formatPoints(rewards.points) : '0'}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Preview output</span>
                    <strong>{formatNumber(redeemPreviewLend)} LEND</strong>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="redeemPoints">Redeem points</label>
                  <input
                    id="redeemPoints"
                    type="number"
                    min={REDEEM_POINTS_BASE}
                    step="100"
                    value={redeemPointsAmount}
                    onChange={(event) => setRedeemPointsAmount(event.target.value)}
                  />
                </div>
                <div className="card-action-row">
                  <Button
                    onClick={handleRedeemPointsToLend}
                    disabled={isProtocolActionPending('redeem-points') || !rewards?.points}
                  >
                    {isProtocolActionPending('redeem-points')
                      ? 'Redeeming...'
                      : 'Convert to claimable LEND'}
                  </Button>
                </div>
                <div className="summary">
                  <div className="summary-row">
                    <span>Limit boost cost</span>
                    <strong>{LIMIT_BOOST_COST} points</strong>
                  </div>
                  <div className="summary-row">
                    <span>APR discount cost</span>
                    <strong>{INTEREST_DISCOUNT_COST_PER_PERCENT} points per 1%</strong>
                  </div>
                  <div className="summary-row">
                    <span>Premium check cost</span>
                    <strong>{PREMIUM_CHECK_COST} points</strong>
                  </div>
                  <div className="summary-row">
                    <span>Badge cost</span>
                    <strong>{BADGE_COST} points</strong>
                  </div>
                </div>
                <div className="card-action-row">
                  <Button
                    onClick={handleBuyLimitBoost}
                    disabled={
                      isProtocolActionPending('limit-boost') ||
                      (rewards?.points ?? 0) < LIMIT_BOOST_COST
                    }
                  >
                    {isProtocolActionPending('limit-boost') ? 'Buying...' : 'Buy limit boost'}
                  </Button>
                  <Button
                    onClick={handleUnlockPremiumCheck}
                    variant="secondary"
                    disabled={
                      isProtocolActionPending('premium-check') ||
                      (rewards?.points ?? 0) < PREMIUM_CHECK_COST
                    }
                  >
                    {isProtocolActionPending('premium-check')
                      ? 'Unlocking...'
                      : 'Unlock premium check'}
                  </Button>
                </div>
                <div className="field">
                  <label htmlFor="interestDiscountPercent">Discount percent</label>
                  <input
                    id="interestDiscountPercent"
                    type="number"
                    min="1"
                    max="10"
                    value={interestDiscountPercent}
                    onChange={(event) => setInterestDiscountPercent(event.target.value)}
                  />
                </div>
                <div className="card-action-row">
                  <Button
                    onClick={handleBuyInterestDiscount}
                    disabled={isProtocolActionPending('interest-discount') || !rewards?.points}
                  >
                    {isProtocolActionPending('interest-discount') ? 'Applying...' : 'Buy APR discount'}
                  </Button>
                  <Button
                    onClick={handleRedeemBadge}
                    variant="secondary"
                    disabled={isProtocolActionPending('badge') || (rewards?.points ?? 0) < BADGE_COST}
                  >
                    {isProtocolActionPending('badge') ? 'Redeeming...' : 'Redeem badge'}
                  </Button>
                </div>
              </>
            ) : (
              <p className="muted-copy">
                Point-based perks unlock after you build repayment history. Healthy borrower behavior
                is what fills this section.
              </p>
            )}
          </Card>
        </div>
      ) : null}
    </>
  )
}
