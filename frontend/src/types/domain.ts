export type NavKey = 'overview' | 'analyze' | 'request' | 'loan' | 'rewards' | 'admin'

export type RiskBand = 'Low' | 'Medium' | 'High'
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type LoanStatus = 'active' | 'repaid' | 'defaulted'
export type InstallmentStatus = 'paid' | 'due' | 'upcoming'
export type ToastTone = 'success' | 'info' | 'warning' | 'danger'
export type CollateralStatus = 'none' | 'locked' | 'returned' | 'liquidated'
export type UsernameSource = 'preview' | 'initia_l1' | 'rollup'

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
  txHashApprove?: string
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

export interface MerchantProofState {
  chainId: string
  packageAddress: string
  merchantId: string
  registrationTxHash?: string
  interactionTxHash?: string
  interactionLabel?: string
  resultLabel?: string
  payoutBalance?: number
  receiptAddress?: string
}

export interface TxExplorerNftState {
  tokenId?: string
  description?: string
  uri?: string
  collection?: string
  objectAddress?: string
}

export interface TxExplorerPurchaseState {
  purchaseId?: string
  itemId?: string
  amountPaid?: string
  receiptObject?: string
  merchantId?: string
  buyer?: string
}

export interface TxExplorerState {
  txHash: string
  height: number
  status: 'success' | 'failed'
  code: number
  timestamp?: string
  sender?: string
  moduleAddress?: string
  moduleName?: string
  functionName?: string
  memo?: string
  gasUsed: number
  gasWanted: number
  fee?: string
  recipient?: string
  nft?: TxExplorerNftState | null
  purchase?: TxExplorerPurchaseState | null
}

export interface MerchantState {
  id: string
  merchantAddress: string
  category: string
  name?: string
  description?: string
  contract?: string
  actions?: string[]
  source?: 'onchain' | 'mock'
  listingFeeBps: number
  partnerFeeBps: number
  active: boolean
  partnerFeeQuote: number
  proof?: MerchantProofState
}

export interface ViralDropItemState {
  id: string
  appLabel: string
  merchantId?: string
  merchantAddress?: string
  name: string
  uri: string
  price: number
  instantCollateralRequired: number
  active: boolean
}

export type ViralDropDeliveryMode = 'claim_on_repay' | 'secured_instant'

export interface ViralDropPurchaseState {
  id: string
  itemId: string
  itemName: string
  appLabel: string
  merchantId: string
  merchantAddress?: string
  buyer: string
  amountPaid: number
  purchasedAt: string
  receiptAddress: string
  loanId?: string
  deliveryMode: ViralDropDeliveryMode
  collectibleClaimed: boolean
  collectibleClaimable: boolean
  collectibleAddress?: string
  claimedAt?: string
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

export interface LiquidityOracleQuoteState {
  requestedPair: string
  resolvedPair: string
  pairMode: 'direct' | 'reference'
  pairSupported: boolean
  pairReason?: string
  price: number
  sourcePath: string
  fetchedAt: string
  rawPrice?: string
  decimals?: number
  blockTimestamp?: string
  blockHeight?: number
}

export interface LendLiquidityRouteState {
  routeMode: 'live' | 'preview'
  routeStatus: 'mapped' | 'mapping_required'
  walletHandler: 'interwovenkit'
  transferMethod: 'ibc_hooks'
  sourceChainId: string
  sourceChainName: string
  destinationChainId: string
  destinationChainName: string
  destinationRestUrl: string
  assetSymbol: string
  assetDenom: string
  erc20FactoryAddress?: string
  erc20Address?: string
  swapSummary: string
  oracleQuote: LiquidityOracleQuoteState
}

export interface TierVoucherState {
  tier: RewardsState['tier']
  label: string
  discountBps: number
  status: 'unlocked' | 'next' | 'locked'
  requirementLabel: string
  detail: string
}

export interface UserProfile {
  id: string
  initiaAddress: string
  username?: string
  usernameSource?: UsernameSource
  usernameVerified: boolean
  usernameVerifiedOnL1: boolean
  usernameAttestedOnRollup: boolean
  referralCode?: string
  referredBy?: string
  referralPointsEarned?: number
  wallet: {
    nativeBalance: number
    lockedCollateralLend: number
  }
  rewards: RewardsState
  createdAt: string
  updatedAt: string
}

export interface FaucetState {
  enabled: boolean
  claimAmount: number
  nativeSymbol: string
  cooldownHours: number
  canClaim: boolean
  lastClaimAt?: string
  nextClaimAt?: string
  txHash?: string
}

export interface AuthResponse {
  token: string
  user: UserProfile
}

export interface ToastState {
  tone: ToastTone
  title: string
  message: string
  layout?: 'corner' | 'center'
}

export interface ReferralEntry {
  address: string
  username?: string
  joinedAt: string
  status: 'pending' | 'active' | 'defaulted'
  pointsGenerated: number
}

export interface ReferralState {
  referralCode: string
  referredBy?: string
  totalReferrals: number
  activeReferrals: number
  pointsEarned: number
  referralList: ReferralEntry[]
}

export interface LeaderboardEntry {
  rank: number
  address: string
  username?: string
  value: string
  metric: string
  badge?: string
  tier: RewardsState['tier']
}

export interface LeaderboardState {
  topBorrowers: LeaderboardEntry[]
  topRepayers: LeaderboardEntry[]
  topReferrers: LeaderboardEntry[]
  risingStars: LeaderboardEntry[]
  myRank?: {
    borrowers?: number
    repayers?: number
    referrers?: number
    risingStars?: number
  }
}
