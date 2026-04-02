export type NavKey = 'overview' | 'analyze' | 'request' | 'loan' | 'rewards' | 'admin'

export type RiskBand = 'Low' | 'Medium' | 'High'
export type RequestStatus = 'pending' | 'approved' | 'rejected'
export type LoanStatus = 'active' | 'repaid' | 'defaulted'
export type InstallmentStatus = 'paid' | 'due' | 'upcoming'
export type ToastTone = 'success' | 'info' | 'warning' | 'danger'
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
  provider?: 'heuristic' | 'ollama'
  model?: string
  summary?: string
  signals?: {
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
    tier: RewardsState['tier']
  }
}

export interface LoanRequestState {
  id: string
  amount: number
  collateralAmount: number
  merchantId?: string
  merchantCategory?: string
  merchantAddress?: string
  assetSymbol?: string
  tenorMonths: number
  submittedAt: string
  status: RequestStatus
  txHash?: string
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

export interface ActivityItem {
  id: string
  kind: 'score' | 'loan' | 'repayment' | 'identity'
  label: string
  detail: string
  timestamp: string
}

export interface RewardsState {
  points: number
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond'
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

export interface AuthResponse {
  token: string
  user: UserProfile
}

export interface ToastState {
  tone: ToastTone
  title: string
  message: string
}
