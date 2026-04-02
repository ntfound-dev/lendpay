import type {
  Activity,
  CreditScore,
  Loan,
  LoanRequest,
  OracleSnapshot,
  Session,
  User,
} from '@prisma/client'
import type {
  ActivityItem,
  CreditScoreSignals,
  ChallengeRecord,
  CreditScoreState,
  InstallmentState,
  LoanRequestState,
  LoanState,
  OracleSnapshot as DomainOracleSnapshot,
  RewardsState,
  SessionRecord,
  UserProfile,
} from '../types/domain.js'

export const serializeJson = (value: unknown) => JSON.stringify(value)

const parseJson = <T>(value: string): T => JSON.parse(value) as T

export const mapRewards = (
  user: Pick<
    User,
    | 'heldLend'
    | 'liquidLend'
    | 'stakedLend'
    | 'claimableLend'
    | 'claimableStakingRewards'
    | 'points'
    | 'streak'
    | 'tier'
    | 'creditLimitBoostBps'
    | 'interestDiscountBps'
    | 'premiumChecksAvailable'
    | 'badgeCount'
  >,
): RewardsState => ({
  heldLend: user.heldLend,
  liquidLend: user.liquidLend,
  stakedLend: user.stakedLend,
  claimableLend: user.claimableLend,
  claimableStakingRewards: user.claimableStakingRewards,
  points: user.points,
  streak: user.streak,
  tier: user.tier as RewardsState['tier'],
  creditLimitBoostBps: user.creditLimitBoostBps,
  interestDiscountBps: user.interestDiscountBps,
  premiumChecksAvailable: user.premiumChecksAvailable,
  badgeCount: user.badgeCount,
})

export const mapUserProfile = (user: User): UserProfile => ({
  id: user.id,
  initiaAddress: user.initiaAddress,
  username: user.username ?? undefined,
  wallet: {
    nativeBalance: user.nativeBalance,
    lockedCollateralLend: user.lockedCollateralLend,
  },
  rewards: mapRewards(user),
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
})

export const mapScore = (score: CreditScore): CreditScoreState => ({
  score: score.score,
  limitUsd: score.limitUsd,
  risk: score.risk as CreditScoreState['risk'],
  apr: score.apr,
  scannedAt: score.scannedAt.toISOString(),
  breakdown: parseJson<CreditScoreState['breakdown']>(score.breakdownJson),
  provider: (score.provider as CreditScoreState['provider']) ?? undefined,
  model: score.model ?? undefined,
  summary: score.summary ?? undefined,
  signals: score.signalsJson ? parseJson<CreditScoreSignals>(score.signalsJson) : undefined,
})

export const mapLoanRequest = (request: LoanRequest): LoanRequestState => ({
  id: request.id,
  amount: request.amount,
  collateralAmount: request.collateralAmount,
  merchantId: request.merchantId ?? undefined,
  merchantCategory: request.merchantCategory ?? undefined,
  merchantAddress: request.merchantAddress ?? undefined,
  assetSymbol: request.assetSymbol,
  tenorMonths: request.tenorMonths,
  submittedAt: request.submittedAt.toISOString(),
  status: request.status as LoanRequestState['status'],
  txHash: request.txHash ?? undefined,
})

export const mapLoan = (loan: Loan): LoanState => ({
  id: loan.id,
  requestId: loan.requestId,
  principal: loan.principal,
  collateralAmount: loan.collateralAmount,
  merchantId: loan.merchantId ?? undefined,
  merchantCategory: loan.merchantCategory ?? undefined,
  merchantAddress: loan.merchantAddress ?? undefined,
  collateralStatus: loan.collateralStatus as LoanState['collateralStatus'],
  apr: loan.apr,
  tenorMonths: loan.tenorMonths,
  installmentsPaid: loan.installmentsPaid,
  status: loan.status as LoanState['status'],
  schedule: parseJson<InstallmentState[]>(loan.scheduleJson),
  txHashApprove: loan.txHashApprove ?? undefined,
})

export const mapActivity = (activity: Activity): ActivityItem => ({
  id: activity.id,
  kind: activity.kind as ActivityItem['kind'],
  label: activity.label,
  detail: activity.detail,
  timestamp: activity.timestamp.toISOString(),
})

export const mapSession = (session: Session): SessionRecord => ({
  token: session.token,
  initiaAddress: session.initiaAddress,
  expiresAt: session.expiresAt.toISOString(),
})

export const mapChallenge = (challenge: {
  id: string
  initiaAddress: string
  message: string
  expiresAt: Date
}): ChallengeRecord => ({
  id: challenge.id,
  initiaAddress: challenge.initiaAddress,
  message: challenge.message,
  expiresAt: challenge.expiresAt.toISOString(),
})

export const mapOracleSnapshot = (snapshot: OracleSnapshot): DomainOracleSnapshot => ({
  id: snapshot.id,
  baseCurrency: snapshot.baseCurrency,
  quoteCurrency: snapshot.quoteCurrency,
  price: snapshot.price,
  sourcePath: snapshot.sourcePath,
  fetchedAt: snapshot.fetchedAt.toISOString(),
})
