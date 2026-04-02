export type RiskBand = 'Low' | 'Medium' | 'High'
export type RequestStatus = 'pending' | 'approved' | 'rejected'
export type LoanStatus = 'active' | 'repaid' | 'defaulted'
export type InstallmentStatus = 'paid' | 'due' | 'upcoming'
export type ActivityKind = 'score' | 'loan' | 'repayment' | 'identity'
export type RewardTier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond'
export type ScoreProvider = 'heuristic' | 'ollama'
export type CollateralStatus = 'none' | 'locked' | 'returned' | 'liquidated'

export interface ScoreBreakdownItem {
  label: string
  points: number
  detail: string
}

export interface CreditScoreState {
  score: number
  limitUsd: number
  risk: RiskBand
  apr: number
  scannedAt: string
  breakdown: ScoreBreakdownItem[]
  provider?: ScoreProvider
  model?: string
  summary?: string
  signals?: CreditScoreSignals
}

export interface CreditScoreSignals {
  initiaAddress: string
  username?: string
  oraclePrice: number
  addressSignal: number
  identityStrength: number
  activityStrength: number
  balanceStrength: number
  repaymentStrength: number
  loyaltyStrength: number
  points: number
  streak: number
  heldLend: number
  tier: RewardTier
}

export interface LoanRequestState {
  id: string
  amount: number
  collateralAmount: number
  merchantId?: string
  merchantCategory?: string
  merchantAddress?: string
  tenorMonths: number
  submittedAt: string
  status: RequestStatus
  txHash?: string
  assetSymbol: string
}

export interface InstallmentState {
  installmentNumber: number
  amount: number
  dueAt: string
  status: InstallmentStatus
  txHash?: string
}

export interface LoanState {
  id: string
  requestId: string
  principal: number
  collateralAmount: number
  merchantId?: string
  merchantCategory?: string
  merchantAddress?: string
  collateralStatus: CollateralStatus
  apr: number
  tenorMonths: number
  installmentsPaid: number
  status: LoanStatus
  schedule: InstallmentState[]
  txHashApprove?: string
}

export interface ActivityItem {
  id: string
  kind: ActivityKind
  label: string
  detail: string
  timestamp: string
}

export interface RewardsState {
  points: number
  tier: RewardTier
  heldLend: number
  liquidLend: number
  stakedLend: number
  claimableLend: number
  claimableStakingRewards: number
  streak: number
  creditLimitBoostBps: number
  interestDiscountBps: number
  premiumChecksAvailable: number
  badgeCount: number
}

export interface UserProfile {
  id: string
  initiaAddress: string
  username?: string
  wallet: {
    nativeBalance: number
    lockedCollateralLend: number
  }
  rewards: RewardsState
  createdAt: string
  updatedAt: string
}

export interface ChallengeRecord {
  id: string
  initiaAddress: string
  message: string
  expiresAt: string
}

export interface SessionRecord {
  token: string
  initiaAddress: string
  expiresAt: string
}

export interface OracleSnapshot {
  id: string
  baseCurrency: string
  quoteCurrency: string
  price: number
  sourcePath: string
  fetchedAt: string
}

export interface OperatorActionRecord {
  id: string
  actorAddress: string
  actionType: string
  targetType: string
  targetId: string
  reason: string
  txHash?: string
  status: 'preview' | 'submitted' | 'confirmed'
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: UserProfile
}

export interface TreasuryState {
  mode: 'preview' | 'live'
  packageAddress?: string
  canBroadcast: boolean
  nativeSymbol: string
  nativeDenom: string
}

export interface OnchainRequestSnapshot {
  id: number
  profileId: number
  borrowerHex: string
  amount: number
  collateralAmount: number
  tenorMonths: number
  createdAtSeconds: number
  status: number
}

export interface OnchainLoanSnapshot {
  id: number
  requestId: number
  profileId: number
  borrowerHex: string
  amount: number
  collateralAmount: number
  collateralState: number
  aprBps: number
  tenorMonths: number
  installmentAmount: number
  installmentsTotal: number
  installmentsPaid: number
  issuedAtSeconds: number
  nextDueAtSeconds: number
  gracePeriodSeconds: number
  totalRepaid: number
  status: number
}

export interface OnchainRewardsSnapshot {
  points: number
  streak: number
  heldLend: number
  liquidLend: number
  stakedLend: number
  claimableLend: number
  claimableStakingRewards: number
  creditLimitBoostBps: number
  interestDiscountBps: number
  premiumChecksAvailable: number
  badgeCount: number
  tier: RewardTier
  username?: string
}

export interface WalletSnapshot {
  nativeBalance: number
  lockedCollateralLend: number
}

export interface AiProviderState {
  configuredProvider: ScoreProvider
  activeProvider: ScoreProvider
  available: boolean
  model?: string
  baseUrl?: string
  reason?: string
}

export interface LoanFeeState {
  loanId: string
  borrower: string
  originationFeeDue: number
  lateFeeDue: number
  totalFeesPaid: number
  totalFeesPaidInLend: number
}

export interface CreditProfileQuote {
  profileId: number
  label: string
  qualified: boolean
  maxPrincipal: number
  maxTenorMonths: number
  requiresCollateral: boolean
  revolving: boolean
  collateralRatioBps: number
  minLendHoldings: number
  currentLendHoldings: number
  tierLimitMultiplierBps: number
  creditLimitBoostBps: number
}

export interface CampaignState {
  id: string
  phase: number
  totalAllocation: number
  totalClaimed: number
  requiresUsername: boolean
  minimumPlatformActions: number
  status: 'open' | 'closed'
  claimableAmount: number
  canClaim: boolean
}

export interface GovernanceProposalState {
  id: string
  proposer: string
  proposalType: number
  titleHash: string
  bodyHash: string
  createdAt: string
  endsAt: string
  yesVotes: number
  noVotes: number
  status: 'open' | 'passed' | 'rejected'
  hasVoted: boolean
}

export interface MerchantState {
  id: string
  merchantAddress: string
  category: string
  listingFeeBps: number
  partnerFeeBps: number
  active: boolean
  partnerFeeQuote: number
}
