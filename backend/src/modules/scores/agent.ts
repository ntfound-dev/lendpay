import type { OllamaScoringClient } from '../../integrations/ai/ollama.js'
import type {
  AiProviderState,
  CreditScoreSignals,
  CreditScoreState,
  RewardTier,
  RiskBand,
  ScoreBreakdownItem,
  UserProfile,
} from '../../types/domain.js'

const SCORE_MIN = 620
const SCORE_MAX = 835

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const tierDiscount = (tier: RewardTier) => {
  if (tier === 'Diamond') return 1.8
  if (tier === 'Gold') return 1.2
  if (tier === 'Silver') return 0.6
  return 0.15
}

const resolveRisk = (score: number): RiskBand => {
  if (score >= 780) return 'Low'
  if (score >= 700) return 'Medium'
  return 'High'
}

const riskAprBounds = (risk: RiskBand) => {
  if (risk === 'Low') return { min: 5.9, max: 8.2, anchor: 6.9 }
  if (risk === 'Medium') return { min: 7.6, max: 11.8, anchor: 9.5 }
  return { min: 12.5, max: 18, anchor: 15.5 }
}

const tierLimitCap = (tier: RewardTier) => {
  if (tier === 'Diamond') return 5000
  if (tier === 'Gold') return 3800
  if (tier === 'Silver') return 2800
  return 1800
}

const buildSignals = (
  initiaAddress: string,
  user: UserProfile,
  oraclePrice: number,
): CreditScoreSignals => {
  const addressSignal = [...initiaAddress].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 36
  const usernameBonus = user.username ? 26 : 10
  const tierBonus = user.rewards.tier === 'Diamond' ? 20 : user.rewards.tier === 'Gold' ? 14 : user.rewards.tier === 'Silver' ? 8 : 3

  return {
    initiaAddress,
    username: user.username,
    oraclePrice,
    addressSignal,
    identityStrength: clamp(42 + usernameBonus + Math.floor(addressSignal / 2), 0, 100),
    activityStrength: clamp(40 + Math.min(user.rewards.streak * 9, 32) + Math.min(Math.floor(user.rewards.points / 220), 24), 0, 100),
    balanceStrength: clamp(36 + Math.min(user.rewards.heldLend * 11, 36) + (oraclePrice > 0.5 ? 10 : 6), 0, 100),
    repaymentStrength: clamp(48 + Math.min(user.rewards.streak * 7, 24) + Math.min(Math.floor(user.rewards.points / 180), 26), 0, 100),
    loyaltyStrength: clamp(34 + tierBonus + Math.min(user.rewards.heldLend * 5, 20), 0, 100),
    points: user.rewards.points,
    streak: user.rewards.streak,
    heldLend: user.rewards.heldLend,
    tier: user.rewards.tier,
  }
}

const buildBreakdown = (signals: CreditScoreSignals): ScoreBreakdownItem[] => [
  {
    label: 'Wallet age',
    points: Math.round(95 + signals.addressSignal * 0.7),
    detail: 'Wallet age and address continuity indicate a stable borrower identity.',
  },
  {
    label: 'Transaction activity',
    points: Math.round(signals.activityStrength + 40),
    detail: `Observed platform cadence reflects ${signals.streak} recent repayment-aligned activity streak(s).`,
  },
  {
    label: 'Average balance',
    points: Math.round(signals.balanceStrength + 36),
    detail: `Wallet balance quality was normalized at ${signals.oraclePrice.toFixed(2)} USD using Connect data.`,
  },
  {
    label: 'Repayment behavior',
    points: Math.round(signals.repaymentStrength + 74),
    detail: `Points (${signals.points}) and repayment streak indicate borrower discipline over time.`,
  },
  {
    label: 'Cross-app behavior',
    points: Math.round(signals.identityStrength * 0.5 + signals.loyaltyStrength * 0.45),
    detail: signals.username
      ? `Identity ${signals.username} and holder tier ${signals.tier} strengthen portable trust.`
      : 'Username identity is still missing, so cross-app trust remains partially constrained.',
  },
]

const buildBaseline = (signals: CreditScoreSignals): CreditScoreState => {
  const weighted =
    signals.identityStrength * 0.16 +
    signals.activityStrength * 0.2 +
    signals.balanceStrength * 0.14 +
    signals.repaymentStrength * 0.3 +
    signals.loyaltyStrength * 0.2

  const score = Math.round(clamp(620 + weighted * 1.7, SCORE_MIN, SCORE_MAX))
  const risk = resolveRisk(score)
  const aprBounds = riskAprBounds(risk)
  const apr = Number(clamp(aprBounds.anchor - tierDiscount(signals.tier), aprBounds.min, aprBounds.max).toFixed(2))
  const rawLimit = score * 3.05 + signals.heldLend * 18 + signals.points * 0.09 + (signals.username ? 220 : 0)
  const limitUsd = Math.round(clamp(rawLimit, 350, tierLimitCap(signals.tier) + (signals.username ? 250 : 0)))

  return {
    score,
    limitUsd,
    risk,
    apr,
    scannedAt: new Date().toISOString(),
    breakdown: buildBreakdown(signals),
    provider: 'heuristic',
    summary: signals.username
      ? `Baseline profile is supported by verified identity ${signals.username}, repayment streak ${signals.streak}, and ${signals.points} points.`
      : `Baseline profile relies on wallet behavior, repayment streak ${signals.streak}, and ${signals.points} points without verified username support yet.`,
    signals,
  }
}

const applyPolicy = (draft: CreditScoreState, signals: CreditScoreSignals): CreditScoreState => {
  const score = Math.round(clamp(draft.score, SCORE_MIN, SCORE_MAX))
  const risk = resolveRisk(score)
  const aprBounds = riskAprBounds(risk)
  const anchorApr = clamp(aprBounds.anchor - tierDiscount(signals.tier), aprBounds.min, aprBounds.max)
  const blendedApr = draft.apr * 0.45 + anchorApr * 0.55
  const apr = Number(clamp(blendedApr, aprBounds.min, aprBounds.max).toFixed(2))

  const hardCap = tierLimitCap(signals.tier) + (signals.username ? 250 : 0)
  const riskCap = risk === 'High' ? 1600 : risk === 'Medium' ? 3200 : 5000
  const signalsCap = 500 + signals.points * 0.12 + signals.heldLend * 22 + signals.repaymentStrength * 14
  const limitUsd = Math.round(clamp(Math.min(draft.limitUsd, hardCap, riskCap, signalsCap), 350, 5000))

  const summaryBase =
    draft.summary ??
    `Agent reviewed wallet identity, onchain activity, repayment behavior, and holdings before policy enforcement.`

  return {
    ...draft,
    score,
    risk,
    apr,
    limitUsd,
    summary: `${summaryBase} Final decision was policy-checked against tier, risk band, and exposure caps.`,
    signals,
  }
}

export class CreditScoringAgent {
  constructor(private ollamaClient: OllamaScoringClient) {}

  async providerState(): Promise<AiProviderState> {
    return this.ollamaClient.getStatus()
  }

  async analyze(initiaAddress: string, user: UserProfile, oraclePrice: number): Promise<CreditScoreState> {
    const signals = buildSignals(initiaAddress, user, oraclePrice)
    const baseline = buildBaseline(signals)
    const aiSuggestion = await this.ollamaClient.score({
      signals,
      fallback: baseline,
    })

    const draft: CreditScoreState = aiSuggestion
      ? {
          score: aiSuggestion.score,
          limitUsd: aiSuggestion.limitUsd,
          apr: aiSuggestion.apr,
          risk: resolveRisk(aiSuggestion.score),
          scannedAt: new Date().toISOString(),
          breakdown: aiSuggestion.breakdown,
          provider: aiSuggestion.provider,
          model: aiSuggestion.model,
          summary: aiSuggestion.summary,
          signals,
        }
      : baseline

    return applyPolicy(draft, signals)
  }
}
