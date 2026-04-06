import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import type { EncodeObject } from '@cosmjs/proto-signing'
import { signBackendChallenge } from './lib/auth'
import { appEnv, isChainWriteReady } from './config/env'
import { lendpayApi } from './lib/api'
import {
  createBuyViralDropMessage,
  createClaimCampaignMessage,
  createClaimLendMessage,
  createClaimViralDropCollectibleMessage,
  createRepayInstallmentMessage,
  createRequestCollateralizedLoanMessage,
  createRequestLoanMessage,
  createSpendPointsMessage,
  createStakeMessage,
} from './lib/move'
import { extractTxHash } from './lib/tx'
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelative,
  formatTokenAmount,
  formatTxHash,
  shortenAddress,
} from './lib/format'
import {
  APP_FAMILIES,
  BADGE_COST,
  INTEREST_DISCOUNT_COST_PER_PERCENT,
  LIMIT_BOOST_COST,
  PREMIUM_CHECK_COST,
  REDEEM_LEND_OUTPUT,
  REDEEM_POINTS_BASE,
  appCategoryMeta,
  buildRestTxInfoUrl,
  buildRpcTxUrl,
  consumerScoreLine,
  dedupeApps,
  describeCampaign,
  describePurchaseDelivery,
  fetchTxData,
  formatAppLabel,
  formatBpsPercent,
  formatProfileLabel,
  getAppUpdateDescription,
  getCampaignIneligibleReason,
  getProtocolEventBadge,
  getAppPostApprovalCopy,
  getErrorMessage,
  humanizeRepayError,
  nextTierBenefitCopy,
  nextTierLabel,
  parseNumericId,
  scoreStatusLabel,
  tierHoldingsThreshold,
  titleCase,
  type AppFamily,
  type RequestDraft,
} from './lib/appHelpers'
import type {
  ActivityItem,
  CampaignState,
  CreditProfileQuote,
  CreditScoreState,
  FaucetState,
  GovernanceProposalState,
  LeaderboardEntry,
  LeaderboardState,
  LoanFeeState,
  LoanRequestState,
  LoanState,
  MerchantState,
  NavKey,
  ReferralState,
  RewardsState,
  ToastState,
  TxExplorerState,
  UserProfile,
  ViralDropItemState,
  ViralDropPurchaseState,
} from './types/domain'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { MobileNav } from './components/layout/MobileNav'
import { Button } from './components/ui/Button'
import { Card } from './components/ui/Card'
import { AgentPanel } from './components/shared/AgentPanel'
import { EmptyState } from './components/shared/EmptyState'
import { OverviewPage } from './components/pages/OverviewPage'
import { ProfilePage, type ScoreBreakdownRow } from './components/pages/ProfilePage'
import { RequestPage } from './components/pages/RequestPage'
import { RepayPage } from './components/pages/RepayPage'
import { LoyaltyHubPage } from './components/pages/LoyaltyHubPage'
import { EcosystemPage, type ProtocolUpdateItem } from './components/pages/EcosystemPage'
import { ProofModal } from './components/shared/ProofModal'


type DataSection =
  | 'activity'
  | 'campaigns'
  | 'faucet'
  | 'governance'
  | 'leaderboard'
  | 'loanFees'
  | 'merchants'
  | 'profiles'
  | 'referral'
  | 'viralDrop'

const defaultDraft: RequestDraft = {
  amount: '',
  collateralAmount: '',
  merchantId: '',
  profileId: appEnv.requestProfileId,
  tenorMonths: 3,
}

const defaultGovernanceDraft = {
  proposalType: '',
  title: '',
  body: '',
}

const defaultCampaignDraft = {
  phase: '',
  totalAllocation: '',
  requiresUsername: false,
  minimumPlatformActions: '',
}

const defaultAllocationDraft = {
  campaignId: '',
  userAddress: '',
  amount: '',
}

const defaultMerchantDraft = {
  merchantAddress: '',
  category: 'nft',
  listingFeeBps: '',
  partnerFeeBps: '',
}

function App() {
  const {
    initiaAddress,
    offlineSigner,
    openConnect,
    openWallet,
    requestTxBlock,
    username: walletUsername,
  } = useInterwovenKit()

  const [activePage, setActivePage] = useState<NavKey>('overview')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [score, setScore] = useState<CreditScoreState | null>(null)
  const [rewards, setRewards] = useState<RewardsState | null>(null)
  const [requests, setRequests] = useState<LoanRequestState[]>([])
  const [loans, setLoans] = useState<LoanState[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loanFees, setLoanFees] = useState<LoanFeeState | null>(null)
  const [profileQuotes, setProfileQuotes] = useState<CreditProfileQuote[]>([])
  const [campaigns, setCampaigns] = useState<CampaignState[]>([])
  const [governance, setGovernance] = useState<GovernanceProposalState[]>([])
  const [merchants, setMerchants] = useState<MerchantState[]>([])
  const [referral, setReferral] = useState<ReferralState | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardState | null>(null)
  const [faucet, setFaucet] = useState<FaucetState | null>(null)
  const [viralDropItems, setViralDropItems] = useState<ViralDropItemState[]>([])
  const [viralDropPurchases, setViralDropPurchases] = useState<ViralDropPurchaseState[]>([])
  const [draft, setDraft] = useState<RequestDraft>(defaultDraft)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isBackendSyncing, setIsBackendSyncing] = useState(false)
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const [isRepaying, setIsRepaying] = useState(false)
  const [pendingProtocolAction, setPendingProtocolAction] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [username, setUsername] = useState<string | undefined>(walletUsername ?? undefined)
  const [stakeAmount, setStakeAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')
  const [redeemPointsAmount, setRedeemPointsAmount] = useState('')
  const [interestDiscountPercent, setInterestDiscountPercent] = useState('')
  const [governanceDraft, setGovernanceDraft] = useState(defaultGovernanceDraft)
  const [campaignDraft, setCampaignDraft] = useState(defaultCampaignDraft)
  const [allocationDraft, setAllocationDraft] = useState(defaultAllocationDraft)
  const [merchantDraft, setMerchantDraft] = useState(defaultMerchantDraft)
  const [hasLoadedBorrowerState, setHasLoadedBorrowerState] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<DataSection, string>>>({})
  const [isRepayGuideOpen, setIsRepayGuideOpen] = useState(false)
  const [buyingDropItemId, setBuyingDropItemId] = useState<string | null>(null)
  const [selectedDropItemId, setSelectedDropItemId] = useState('')
  const [referralCodeInput, setReferralCodeInput] = useState('')
  const [isApplyingReferral, setIsApplyingReferral] = useState(false)
  const [leaderboardTab, setLeaderboardTab] = useState<
    'borrowers' | 'repayers' | 'referrers' | 'risingStars'
  >('borrowers')
  const [selectedAppProofId, setSelectedAppProofId] = useState<string | null>(null)
  const [registrationTxDetails, setRegistrationTxDetails] = useState<TxExplorerState | null>(null)
  const [interactionTxDetails, setInteractionTxDetails] = useState<TxExplorerState | null>(null)
  const [isProofLoading, setIsProofLoading] = useState(false)
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false)
  const [showWalletRecovery, setShowWalletRecovery] = useState(false)

  const apiEnabled = Boolean(appEnv.apiBaseUrl)
  const isConnected = Boolean(initiaAddress)
  const activeLoan = loans.find((loan) => loan.status === 'active') ?? null
  const pendingRequest = requests.find((request) => request.status === 'pending') ?? null
  const nextDueItem = activeLoan?.schedule.find((item) => item.status === 'due') ?? null
  const latestRequest = requests[0] ?? null
  const requestedAmount = Number(draft.amount || '0')
  const parsedApr = score?.apr ?? 0
  const monthlyPaymentPreview = useMemo(() => {
    const totalInterest = (requestedAmount * ((parsedApr / 100) * draft.tenorMonths)) / 12
    return requestedAmount > 0 ? (requestedAmount + totalInterest) / draft.tenorMonths : 0
  }, [draft.tenorMonths, parsedApr, requestedAmount])
  const loanProgressPercent = activeLoan
    ? (activeLoan.installmentsPaid / activeLoan.schedule.length) * 100
    : 0
  const collateralDraftAmount = Number(draft.collateralAmount || 0)
  const estimatedTotalRepayment = monthlyPaymentPreview * draft.tenorMonths
  const paidAmount = activeLoan
    ? activeLoan.schedule
        .filter((item) => item.status === 'paid')
        .reduce((sum, item) => sum + item.amount, 0)
    : 0
  const outstandingAmount = activeLoan
    ? activeLoan.schedule
        .filter((item) => item.status !== 'paid')
        .reduce((sum, item) => sum + item.amount, 0)
    : 0
  const totalFeesDue = (loanFees?.originationFeeDue ?? 0) + (loanFees?.lateFeeDue ?? 0)
  const isProtocolActionPending = (key: string) => pendingProtocolAction === key
  const selectedDraftProfile =
    profileQuotes.find((profile) => profile.profileId === draft.profileId) ?? null
  const selectedProfile =
    (selectedDraftProfile?.qualified ? selectedDraftProfile : null) ??
    profileQuotes.find((profile) => profile.qualified) ??
    selectedDraftProfile ??
    profileQuotes[0] ??
    null
  const requiredCollateralAmount =
    selectedProfile?.requiresCollateral && requestedAmount > 0
      ? Math.ceil((requestedAmount * selectedProfile.collateralRatioBps) / 10_000)
      : 0
  const effectiveAvailableLimit = selectedProfile
    ? selectedProfile.requiresCollateral
      ? selectedProfile.maxPrincipal
      : Math.min(score?.limitUsd ?? selectedProfile.maxPrincipal, selectedProfile.maxPrincipal)
    : score?.limitUsd ?? null
  const walletNativeBalance = profile?.wallet.nativeBalance ?? null
  const walletNativeBalanceLabel =
    walletNativeBalance === null
      ? '—'
      : `${formatTokenAmount(walletNativeBalance, appEnv.nativeDecimals)} ${appEnv.nativeSymbol}`
  const faucetClaimAmountLabel = faucet
    ? `${formatTokenAmount(faucet.claimAmount, appEnv.nativeDecimals)} ${appEnv.nativeSymbol}`
    : `1 ${appEnv.nativeSymbol}`
  const needsTestnetFunds =
    isConnected && hasLoadedBorrowerState && (walletNativeBalance === null || walletNativeBalance <= 0)
  const faucetTxUrl = buildRestTxInfoUrl(faucet?.txHash)
  const faucetAvailabilityLabel = faucet?.canClaim
    ? 'Available now'
    : faucet?.nextClaimAt
      ? `Available again ${formatDate(faucet.nextClaimAt)} · ${formatRelative(faucet.nextClaimAt)}`
      : 'Unavailable right now'
  const uniqueApps = dedupeApps(merchants)
  const activeMerchants = uniqueApps.filter((merchant) => merchant.active)
  const selectedAppProof = uniqueApps.find((merchant) => merchant.id === selectedAppProofId) ?? null
  const selectedMerchant =
    activeMerchants.find((merchant) => merchant.id === draft.merchantId) ?? null
  const selectedAppMeta = appCategoryMeta(selectedMerchant?.category)
  const latestCheckoutMerchant = activeLoan?.merchantId
    ? merchants.find((merchant) => merchant.id === activeLoan.merchantId) ?? null
    : latestRequest?.merchantId
      ? merchants.find((merchant) => merchant.id === latestRequest.merchantId) ?? null
      : null
  const checkoutAppMeta = appCategoryMeta(latestCheckoutMerchant?.category)
  const selectedMerchantTitle = selectedMerchant ? formatAppLabel(selectedMerchant) : 'Pick one app'
  const checkoutMerchant = latestCheckoutMerchant ?? selectedMerchant
  const checkoutMerchantTitle = checkoutMerchant ? formatAppLabel(checkoutMerchant) : 'No app used yet'
  const checkoutDueLabel = nextDueItem
    ? `${formatDate(nextDueItem.dueAt)} · ${formatRelative(nextDueItem.dueAt)}`
    : activeLoan
      ? 'No payment due'
      : 'Approval pending'
  const nextDueLabel = nextDueItem
    ? `${formatDate(nextDueItem.dueAt)} · ${formatRelative(nextDueItem.dueAt)}`
    : activeLoan
      ? 'No payment due'
      : 'Approval pending'
  const repayCardEyebrow = activeLoan ? (nextDueItem ? 'Payment due' : 'Active loan') : 'Awaiting approval'
  const requestStatusTone: 'success' | 'warning' | 'danger' | 'neutral' =
    latestRequest?.status === 'approved'
      ? 'success'
      : latestRequest?.status === 'rejected'
        ? 'danger'
        : latestRequest?.status === 'pending'
          ? 'warning'
          : 'neutral'
  const merchantEligibilityTone: 'success' | 'warning' = selectedMerchant ? 'success' : 'warning'
  const requestSecurityLabel = selectedProfile?.requiresCollateral
    ? `Locks ${formatNumber(requiredCollateralAmount)} LEND`
    : 'No collateral'
  const requestSecurityTone: 'success' | 'neutral' =
    selectedProfile?.requiresCollateral ? 'neutral' : 'success'
  const checkoutSliderMax = Math.max(
    0,
    Math.floor(selectedProfile?.maxPrincipal ?? effectiveAvailableLimit ?? 0),
  )
  const checkoutSliderValue = Math.min(
    checkoutSliderMax,
    Math.max(0, Number(draft.amount || 0)),
  )
  const quickPickAmounts = [100, 300, 500]
  const checkoutFormLocked = activeMerchants.length === 0
  const checkoutMerchantReady = Boolean(selectedMerchant)
  const requestBlockingMessage = activeLoan
    ? `You already have an active credit for ${formatCurrency(activeLoan.principal)}. Finish it on the Repay page before sending a new request.`
    : pendingRequest
      ? 'You already have a pending credit request. Wait for approval or rejection before sending another one.'
      : null
  const checkoutSelectionMessage = sectionErrors.merchants
    ? 'Apps could not be loaded right now.'
    : checkoutFormLocked
      ? 'Add an Initia app in Ecosystem to enable credit requests.'
      : 'Choose one app below. The rest of the request form opens after that.'
  const orderedProfiles = [...profileQuotes].sort((left, right) => {
    const order = ['micro_loan', 'standard_bnpl', 'credit_line', 'collateralized']
    return order.indexOf(left.label) - order.indexOf(right.label)
  })
  const openCampaignCount = campaigns.filter((campaign) => campaign.status === 'open').length
  const ecosystemFamilyStats = APP_FAMILIES.map((family) => {
    const apps = uniqueApps.filter((merchant) => appCategoryMeta(merchant.category).family === family)
    const activeApps = apps.filter((merchant) => merchant.active)

    return {
      family,
      count: apps.length,
      liveCount: activeApps.length,
      headline:
        family === 'NFT'
          ? 'Drops and passes'
          : family === 'Gaming'
            ? 'Worlds and items'
            : family === 'DeFi'
              ? 'Protocols and strategies'
              : 'Membership and tools',
    }
  }).filter((item) => item.count > 0)
  const selectedMerchantDropItems = viralDropItems.filter(
    (item) => item.active && (!selectedMerchant || item.merchantId === selectedMerchant.id),
  )
  const selectedDropItem =
    selectedMerchantDropItems.find((item) => item.id === selectedDropItemId) ?? null
  const selectedDropInstantDelivery =
    Boolean(selectedProfile?.requiresCollateral) &&
    Boolean(selectedDropItem) &&
    collateralDraftAmount >= (selectedDropItem?.instantCollateralRequired ?? Number.POSITIVE_INFINITY)
  const activeLoanDropItems = viralDropItems.filter(
    (item) => item.active && item.merchantId === (activeLoan?.merchantId ?? latestRequest?.merchantId),
  )
  const latestDropPurchase = viralDropPurchases[0] ?? null
  const latestDropDelivery = latestDropPurchase ? describePurchaseDelivery(latestDropPurchase) : null
  const claimableDropPurchase =
    viralDropPurchases.find((purchase) => purchase.collectibleClaimable && !purchase.collectibleClaimed) ?? null
  const selectedRouteOutcomeCopy = selectedDropItem
    ? selectedDropInstantDelivery
      ? `If approved, you can buy ${selectedDropItem.name} in ${selectedMerchantTitle}. The receipt and final collectible both arrive right away because enough LEND is locked.`
      : `If approved, you can buy ${selectedDropItem.name} in ${selectedMerchantTitle}. The receipt arrives first, and the final collectible unlocks after full repayment.`
    : checkoutMerchantReady
      ? `If approved, you use this credit inside ${selectedMerchantTitle}. ${getAppPostApprovalCopy(selectedMerchant?.category)}`
      : 'Choose one app first. Then amount, product, and repayment options will open below.'
  const latestDropUnlockRows = latestDropPurchase
    ? [
        {
          step: 'Step 1',
          title: 'Receipt already in wallet',
          detail: `${latestDropPurchase.itemName} receipt ${shortenAddress(latestDropPurchase.receiptAddress)} proves the purchase happened onchain.`,
        },
        {
          step: 'Step 2',
          title: activeLoan ? 'Repayment still in progress' : 'Repayment completed',
          detail: activeLoan
            ? nextDueItem
              ? `Pay ${formatCurrency(nextDueItem.amount)} by ${formatDate(nextDueItem.dueAt)}. ${formatCurrency(outstandingAmount)} is still left on this loan.`
              : `This loan is active with ${formatCurrency(outstandingAmount)} still outstanding.`
            : 'All installments are finished, so the credit side of this purchase is complete.',
        },
        {
          step: 'Step 3',
          title: latestDropPurchase.collectibleClaimed
            ? 'Final collectible delivered'
            : latestDropPurchase.collectibleClaimable
              ? 'Final collectible ready to claim'
              : 'Final collectible still locked',
          detail: latestDropPurchase.collectibleClaimed
            ? latestDropPurchase.collectibleAddress
              ? `The final collectible is already in your wallet at ${shortenAddress(latestDropPurchase.collectibleAddress)}.`
              : 'The final collectible has already been delivered to your wallet.'
            : latestDropPurchase.collectibleClaimable
              ? 'Open the claim action below to mint the final collectible into your wallet now.'
              : latestDropPurchase.deliveryMode === 'secured_instant'
                ? 'Enough LEND collateral allowed instant delivery for this purchase.'
                : 'The final collectible unlocks only after the loan is fully repaid.',
        },
      ]
    : []
  const combinedActivities = useMemo(() => {
    const purchaseActivities = viralDropPurchases.map((purchase) => ({
      id: `purchase-${purchase.id}`,
      kind: 'loan' as const,
      label: 'App purchase completed',
      detail: purchase.collectibleClaimed
        ? `${purchase.itemName} collectible was delivered in ${purchase.appLabel} after using ${formatCurrency(purchase.amountPaid)} in credit.`
        : `${purchase.itemName} receipt was minted in ${purchase.appLabel} with ${formatCurrency(purchase.amountPaid)} in credit.`,
      timestamp: purchase.purchasedAt,
    }))

    return [...purchaseActivities, ...activities].sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    )
  }, [activities, viralDropPurchases])
  const groupedActiveApps = APP_FAMILIES.map((family) => ({
    family,
    apps: activeMerchants
      .filter((merchant) => appCategoryMeta(merchant.category).family === family)
      .sort((left, right) => formatAppLabel(left).localeCompare(formatAppLabel(right))),
  })).filter((group) => group.apps.length > 0)
  const requestQuickApps = groupedActiveApps.flatMap((group) => group.apps)
  const governanceUpdates: ProtocolUpdateItem[] = governance.slice(0, 2).map((proposal) => {
    const badge = getProtocolEventBadge('proposal')

    return {
      id: `governance-${proposal.id}`,
      kind: 'governance',
      title: proposal.titleHash || `Policy proposal #${proposal.id}`,
      meta: `Votes · yes ${formatNumber(proposal.yesVotes)} · no ${formatNumber(proposal.noVotes)}`,
      subtitle: `Voting ends ${formatDate(proposal.endsAt)}`,
      badgeTone: badge.tone,
      badgeLabel: badge.label,
      proposal,
    }
  })
  const campaignUpdates: ProtocolUpdateItem[] = campaigns.slice(0, 2).map((campaign) => {
    const badge = getProtocolEventBadge('campaign')
    const campaignCopy = describeCampaign(campaign)

    return {
      id: `campaign-${campaign.id}`,
      kind: 'campaign',
      title: campaignCopy.title,
      meta: `Phase ${campaign.phase} · Allocation ${formatNumber(campaign.totalAllocation)}`,
      subtitle: campaign.canClaim
        ? `Claimable now: ${formatNumber(campaign.claimableAmount)}`
        : getCampaignIneligibleReason(campaign, username),
      badgeTone: badge.tone,
      badgeLabel: badge.label,
    }
  })
  const appUpdates: ProtocolUpdateItem[] = uniqueApps
    .filter((merchant) => merchant.active)
    .slice(0, 3)
    .map((merchant) => {
      const badge = getProtocolEventBadge('live')

      return {
        id: `app-${merchant.id}`,
        kind: 'app',
        title: formatAppLabel(merchant),
        meta: getAppUpdateDescription(merchant),
        subtitle: 'Available in checkout request',
        badgeTone: badge.tone,
        badgeLabel: badge.label,
      }
    })
  const protocolUpdates: ProtocolUpdateItem[] = [
    ...governanceUpdates,
    ...campaignUpdates,
    ...appUpdates,
  ].slice(0, 6)
  const claimableDropActionKey = claimableDropPurchase ? `claim-drop-${claimableDropPurchase.id}` : null
  const isClaimingDropCollectible = claimableDropActionKey
    ? isProtocolActionPending(claimableDropActionKey)
    : false
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.layout === 'center' ? 6500 : 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!sessionToken && walletUsername) {
      setUsername(walletUsername)
    }
  }, [sessionToken, walletUsername])

  useEffect(() => {
    if (!initiaAddress) return

    setAllocationDraft((current) =>
      current.userAddress ? current : { ...current, userAddress: initiaAddress },
    )
    setMerchantDraft((current) =>
      current.merchantAddress ? current : { ...current, merchantAddress: initiaAddress },
    )
  }, [initiaAddress])

  useEffect(() => {
    if (!profileQuotes.length) return

    const nextProfile =
      profileQuotes.find((profile) => profile.profileId === draft.profileId && profile.qualified) ??
      profileQuotes.find((profile) => profile.qualified) ??
      profileQuotes[0]

    if (nextProfile && nextProfile.profileId !== draft.profileId) {
      setDraft((current) => ({ ...current, profileId: nextProfile.profileId }))
    }
  }, [draft.profileId, profileQuotes])

  useEffect(() => {
    if (!activeMerchants.length) {
      if (draft.merchantId !== '') {
        setDraft((current) => ({ ...current, merchantId: '' }))
      }
      return
    }

    const hasSelected = activeMerchants.some((merchant) => merchant.id === draft.merchantId)
    if (!hasSelected) {
      setDraft((current) => ({ ...current, merchantId: '' }))
    }
  }, [activeMerchants, draft.merchantId])

  useEffect(() => {
    if (!selectedMerchantDropItems.length) {
      if (selectedDropItemId) {
        setSelectedDropItemId('')
      }
      return
    }

    const stillSelected = selectedMerchantDropItems.some((item) => item.id === selectedDropItemId)
    if (!stillSelected) {
      setSelectedDropItemId('')
    }
  }, [selectedDropItemId, selectedMerchantDropItems])

  useEffect(() => {
    if (!selectedAppProofId) return

    const stillExists = uniqueApps.some((merchant) => merchant.id === selectedAppProofId)
    if (!stillExists) {
      setSelectedAppProofId(null)
    }
  }, [selectedAppProofId, uniqueApps])

  useEffect(() => {
    if (!selectedAppProof) {
      setRegistrationTxDetails(null)
      setInteractionTxDetails(null)
      setIsProofLoading(false)
      return
    }

    let cancelled = false

    const loadProofDetails = async () => {
      setIsProofLoading(true)

      try {
        const [registration, interaction] = await Promise.all([
          selectedAppProof.proof?.registrationTxHash
            ? fetchTxData(selectedAppProof.proof.registrationTxHash, appEnv.chainRpcUrl)
            : Promise.resolve(null),
          selectedAppProof.proof?.interactionTxHash
            ? fetchTxData(selectedAppProof.proof.interactionTxHash, appEnv.chainRpcUrl)
            : Promise.resolve(null),
        ])

        if (cancelled) return
        setRegistrationTxDetails(registration)
        setInteractionTxDetails(interaction)
      } catch (error) {
        if (cancelled) return
        setRegistrationTxDetails(null)
        setInteractionTxDetails(null)
        setToast({
          tone: 'warning',
          title: 'Explorer details unavailable',
          message: getErrorMessage(error, 'The tx details could not be loaded right now.'),
        })
      } finally {
        if (!cancelled) {
          setIsProofLoading(false)
        }
      }
    }

    void loadProofDetails()

    return () => {
      cancelled = true
    }
  }, [selectedAppProof])

  useEffect(() => {
    if (!selectedProfile) return

    if (draft.tenorMonths > selectedProfile.maxTenorMonths) {
      const allowedTenors = ([1, 3, 6] as const).filter(
        (tenor) => tenor <= selectedProfile.maxTenorMonths,
      )
      const nextTenor = allowedTenors[allowedTenors.length - 1]

      if (nextTenor) {
        setDraft((current) => ({ ...current, tenorMonths: nextTenor }))
      }
    }
  }, [draft.tenorMonths, selectedProfile])

  useEffect(() => {
    if (!selectedProfile) return

    if (!selectedProfile.requiresCollateral) {
      if (draft.collateralAmount !== '0') {
        setDraft((current) => ({ ...current, collateralAmount: '0' }))
      }
      return
    }

    if (Number(draft.collateralAmount || 0) <= 0 && requestedAmount > 0) {
      setDraft((current) => ({
        ...current,
        collateralAmount: String(requiredCollateralAmount),
      }))
    }
  }, [
    draft.collateralAmount,
    requestedAmount,
    requiredCollateralAmount,
    selectedProfile,
  ])

  const resetBorrowerState = () => {
    setProfile(null)
    setScore(null)
    setRewards(null)
    setRequests([])
    setLoans([])
    setLoanFees(null)
    setProfileQuotes([])
    setCampaigns([])
    setGovernance([])
    setMerchants([])
    setFaucet(null)
    setReferral(null)
    setLeaderboard(null)
    setViralDropItems([])
    setViralDropPurchases([])
    setActivities([])
    setUsername(walletUsername ?? undefined)
    setDraft(defaultDraft)
    setStakeAmount('')
    setUnstakeAmount('')
    setRedeemPointsAmount('')
    setInterestDiscountPercent('')
    setGovernanceDraft(defaultGovernanceDraft)
    setCampaignDraft(defaultCampaignDraft)
    setAllocationDraft(defaultAllocationDraft)
    setMerchantDraft(defaultMerchantDraft)
    setSelectedDropItemId('')
    setReferralCodeInput('')
    setLeaderboardTab('borrowers')
    setSectionErrors({})
  }

  const showToast = (nextToast: ToastState) => setToast(nextToast)

  const executeWithTimeout = async <T,>(txFn: () => Promise<T>, timeoutMs = 15_000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Transaction timed out')), timeoutMs)
    })

    try {
      return await Promise.race([txFn(), timeoutPromise])
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }

  const isTransactionTimedOut = (error: unknown) =>
    error instanceof Error && error.message === 'Transaction timed out'

  const requireOperatorToken = () => {
    if (!appEnv.previewOperatorToken) {
      const message =
        'Operator token not configured. Set VITE_PREVIEW_OPERATOR_TOKEN in your .env file.'
      showToast({
        tone: 'danger',
        title: 'Operator token missing',
        message,
      })
      throw new Error(message)
    }

    return appEnv.previewOperatorToken
  }

  type BorrowerSyncState = {
    loans: LoanState[]
    profile: UserProfile
    profiles: CreditProfileQuote[]
    requests: LoanRequestState[]
    score: CreditScoreState | null
  }

  const syncBorrowerState = async (
    token: string,
    profileOverride?: UserProfile,
  ): Promise<BorrowerSyncState> => {
    const nextErrors: Partial<Record<DataSection, string>> = {}
    const loadOptionalSection = async <T,>(
      section: DataSection,
      loader: () => Promise<T>,
      fallback: T,
      fallbackMessage: string,
    ) => {
      try {
        return await loader()
      } catch (error) {
        nextErrors[section] = getErrorMessage(error, fallbackMessage)
        return fallback
      }
    }

    const [
      profile,
      nextScore,
      nextRequests,
      nextLoans,
      nextActivities,
      nextProfiles,
      nextCampaigns,
      nextGovernance,
      nextMerchants,
      nextFaucet,
      nextReferral,
      nextLeaderboard,
      nextViralDrop,
    ] =
      await Promise.all([
        profileOverride ? Promise.resolve(profileOverride) : lendpayApi.getMe(token),
        lendpayApi.getScore(token),
        lendpayApi.listLoanRequests(token),
        lendpayApi.listLoans(token),
        loadOptionalSection('activity', () => lendpayApi.getActivity(token), [], 'Recent activity could not be loaded.'),
        loadOptionalSection('profiles', () => lendpayApi.listProtocolProfiles(token), [], 'Credit products could not be loaded.'),
        loadOptionalSection('campaigns', () => lendpayApi.listCampaigns(token), [], 'Reward campaigns could not be loaded.'),
        loadOptionalSection('governance', () => lendpayApi.listGovernance(token), [], 'Governance activity could not be loaded.'),
        loadOptionalSection('merchants', () => lendpayApi.listMerchants(token), [], 'Initia apps could not be loaded.'),
        loadOptionalSection('faucet', () => lendpayApi.getFaucet(token), null, 'Faucet status could not be loaded.'),
        loadOptionalSection('referral', () => lendpayApi.getReferral(token), null, 'Referral data could not be loaded.'),
        loadOptionalSection('leaderboard', () => lendpayApi.getLeaderboard(token), null, 'Leaderboard data could not be loaded.'),
        loadOptionalSection(
          'viralDrop',
          async () => ({
            items: await lendpayApi.listViralDropItems(token),
            purchases: await lendpayApi.listViralDropPurchases(token),
          }),
          { items: [], purchases: [] },
          'Viral drop activity could not be loaded.',
        ),
      ])
    const nextActiveLoan = nextLoans.find((loan) => loan.status === 'active') ?? null
    const nextLoanFees = nextActiveLoan
      ? await loadOptionalSection(
          'loanFees',
          () => lendpayApi.getLoanFees(token, nextActiveLoan.id),
          null,
          'Fee details could not be loaded.',
        )
      : null

    setProfile(profile)
    setRewards(profile.rewards)
    setUsername(profile.username ?? walletUsername ?? undefined)
    setScore(nextScore)
    setRequests(nextRequests)
    setLoans(nextLoans)
    setLoanFees(nextLoanFees)
    setProfileQuotes(nextProfiles)
    setCampaigns(nextCampaigns)
    setGovernance(nextGovernance)
    setMerchants(nextMerchants)
    setFaucet(nextFaucet)
    setReferral(nextReferral)
    setLeaderboard(nextLeaderboard)
    setViralDropItems(nextViralDrop.items)
    setViralDropPurchases(nextViralDrop.purchases)
    setActivities(nextActivities)
    setSectionErrors(nextErrors)
    setLoadError(null)

    return {
      loans: nextLoans,
      profile,
      profiles: nextProfiles,
      requests: nextRequests,
      score: nextScore ?? null,
    }
  }

  const syncProtocolAfterTx = async (token: string, txHash?: string) => {
    if (apiEnabled) {
      await lendpayApi.syncRewards(token, txHash)
    }

    return syncBorrowerState(token)
  }

  const ensureBackendSession = async () => {
    if (!apiEnabled) {
      throw new Error('API base URL is not configured.')
    }

    if (!initiaAddress || !offlineSigner) {
      throw new Error('Connect your wallet before starting a backend session.')
    }

    if (sessionToken) {
      return sessionToken
    }

    try {
      const challenge = await lendpayApi.getChallenge(initiaAddress)
      const signedChallenge = await signBackendChallenge(
        offlineSigner,
        initiaAddress,
        challenge.message,
      )
      const auth = await lendpayApi.verifySession(
        initiaAddress,
        challenge.challengeId,
        signedChallenge,
      )
      setSessionToken(auth.token)
      setProfile(auth.user)
      setRewards(auth.user.rewards)
      setUsername(auth.user.username ?? walletUsername ?? undefined)
      setLoadError(null)
      return auth.token
    } catch (error) {
      setSessionToken(null)
      throw new Error(getErrorMessage(error, 'Backend session could not be created.'))
    }
  }

  const loadBorrowerState = async () => {
    if (!apiEnabled || !initiaAddress) {
      setSessionToken(null)
      setLoadError(null)
      setHasLoadedBorrowerState(false)
      resetBorrowerState()
      return
    }

    setIsBackendSyncing(true)
    setLoadError(null)

    try {
      const token = await ensureBackendSession()
      await syncBorrowerState(token)
      setHasLoadedBorrowerState(true)
    } catch (error) {
      setSessionToken(null)
      resetBorrowerState()
      setHasLoadedBorrowerState(false)
      setLoadError(getErrorMessage(error, 'Could not load borrower state from the API.'))
      throw error
    } finally {
      setIsBackendSyncing(false)
    }
  }

  const executeProtocolAction = async (input: {
    actionKey: string
    message: EncodeObject
    successMessage: string
    successTitle: string
  }) => {
    if (!isConnected) {
      openConnect()
      return
    }

    if (!isChainWriteReady) {
      throw new Error('Move package is not configured. Live protocol actions require a real chain target.')
    }

    setPendingProtocolAction(input.actionKey)

    try {
      const result = await requestWalletTx([input.message])
      const txHash = extractTxHash(result)
      const token = await ensureBackendSession()

      if (!apiEnabled || !token) {
        throw new Error('Backend session is required before syncing a live protocol action.')
      }

      await syncProtocolAfterTx(token, txHash || undefined)
      showToast({
        tone: 'success',
        title: input.successTitle,
        message: `${input.successMessage}${txHash ? ` ${formatTxHash(txHash)}` : ''}`,
      })
    } catch (error) {
      if (isTransactionTimedOut(error)) {
        return
      }

      throw error
    } finally {
      setPendingProtocolAction(null)
    }
  }

  const requestWalletTx = async (messages: EncodeObject[]) => {
    if (typeof requestTxBlock !== 'function') {
      throw new Error('Wallet approval is unavailable right now. Reconnect your wallet and try again.')
    }

    try {
      const result = await executeWithTimeout(() =>
        (requestTxBlock as unknown as (payload: unknown) => Promise<unknown>)({
          chainId: appEnv.appchainId,
          messages,
        }),
      )

      setShowWalletRecovery(false)
      return result
    } catch (error) {
      if (isTransactionTimedOut(error)) {
        setShowWalletRecovery(true)
        showToast({
          tone: 'warning',
          title: 'Wallet not responding',
          message: 'Open your wallet and check for a pending transaction, then try again.',
        })
      }

      throw error
    }
  }

  useEffect(() => {
    if (!apiEnabled || !initiaAddress) {
      setSessionToken(null)
      setLoadError(null)
      setHasLoadedBorrowerState(false)
      resetBorrowerState()
      return
    }

    let cancelled = false

    const bootstrap = async () => {
      try {
        if (!offlineSigner) {
          setHasLoadedBorrowerState(false)
          setLoadError('Wallet signer unavailable. Reconnect your wallet to continue.')
          return
        }
        await loadBorrowerState()
      } catch (error) {
        if (cancelled) return

        showToast({
          tone: 'warning',
          title: 'Backend sync unavailable',
          message: getErrorMessage(error, 'Could not load borrower state from the API.'),
        })
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [apiEnabled, initiaAddress, offlineSigner])

  const handleAnalyze = async () => {
    setIsAnalyzing(true)

    try {
      const token = await ensureBackendSession()
      await lendpayApi.analyzeScore(token)
      await syncBorrowerState(token)
      setHasLoadedBorrowerState(true)
      setLoadError(null)
      showToast({
        tone: 'success',
        title: 'Score refreshed',
        message: 'Wallet activity and Connect-priced balances were rescanned successfully.',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Analysis failed',
        message: error instanceof Error ? error.message : 'Wallet analysis could not be completed.',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleRetryLoad = async () => {
    try {
      await loadBorrowerState()
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Retry failed',
        message: getErrorMessage(error, 'Borrower data could not be reloaded.'),
      })
    }
  }

  const handleCopyReferralCode = async () => {
    if (!referral?.referralCode) return

    try {
      await navigator.clipboard.writeText(referral.referralCode)
      showToast({
        tone: 'success',
        title: 'Referral code copied',
        message: `${referral.referralCode} is ready to share.`,
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Copy failed',
        message: getErrorMessage(error, 'Referral code could not be copied.'),
      })
    }
  }

  const handleShareReferralCode = async () => {
    if (!referral?.referralCode) return

    const text = `I'm using LendPay — AI credit on Initia. Use my code ${referral.referralCode} to get a credit limit boost on signup. lendpay.xyz`

    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
      }

      showToast({
        tone: 'success',
        title: 'Referral text ready',
        message: 'Your referral message is ready to share.',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Share failed',
        message: getErrorMessage(error, 'Referral message could not be shared.'),
      })
    }
  }

  const handleApplyReferralCode = async () => {
    const code = referralCodeInput.trim()
    if (!code) {
      showToast({
        tone: 'warning',
        title: 'Enter a code',
        message: 'Paste a referral code before applying it.',
      })
      return
    }

    try {
      setIsApplyingReferral(true)
      const token = await ensureBackendSession()
      const nextReferral = await lendpayApi.applyReferralCode(token, code)
      setReferral(nextReferral)
      setReferralCodeInput('')
      await syncBorrowerState(token)
      showToast({
        tone: 'success',
        title: 'Referral applied',
        message: 'Code applied. You will both earn rewards after first repayment.',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Referral failed',
        message: getErrorMessage(error, 'Referral code could not be applied.'),
      })
    } finally {
      setIsApplyingReferral(false)
    }
  }

  const handleClaimFaucet = async () => {
    if (!isConnected) {
      openConnect()
      return
    }

    try {
      setIsClaimingFaucet(true)
      const token = await ensureBackendSession()
      const nextFaucet = await lendpayApi.claimFaucet(token)
      setFaucet(nextFaucet)
      await syncBorrowerState(token)
      const claimedAmountLabel = `${formatTokenAmount(nextFaucet.claimAmount, appEnv.nativeDecimals)} ${appEnv.nativeSymbol}`
      showToast({
        tone: 'success',
        title: 'Testnet LEND sent',
        message: `${claimedAmountLabel} was sent to your wallet${nextFaucet.txHash ? `: ${formatTxHash(nextFaucet.txHash)}` : '.'}`,
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Faucet claim failed',
        message: getErrorMessage(error, `Testnet ${appEnv.nativeSymbol} could not be sent.`),
      })
    } finally {
      setIsClaimingFaucet(false)
    }
  }

  const updateDraftAmount = (nextValue: string | number) => {
    const rawValue = String(nextValue)

    if (rawValue.trim() === '') {
      setDraft((current) => ({ ...current, amount: '' }))
      return
    }

    const numericValue = Number(rawValue)
    if (!Number.isFinite(numericValue)) return

    const clampedValue = Math.min(checkoutSliderMax, Math.max(0, numericValue))
    setDraft((current) => ({ ...current, amount: String(clampedValue) }))
  }

  const handleRequestLoan = async () => {
    const amount = Number(draft.amount || 0)
    if (requestBlockingMessage) {
      showToast({
        tone: 'warning',
        title: activeLoan ? 'Active credit still running' : 'Request already pending',
        message: requestBlockingMessage,
      })
      return
    }

    if (amount <= 0) {
      showToast({
        tone: 'warning',
        title: 'Invalid amount',
        message: 'Enter a valid amount before requesting a loan.',
      })
      return
    }

    if (!score) {
      showToast({
        tone: 'warning',
        title: 'Analyze profile first',
        message: 'Run the borrower analysis first so the request uses real credit data.',
      })
      return
    }

    if (selectedProfile && !selectedProfile.qualified) {
      showToast({
        tone: 'warning',
        title: 'Profile not qualified',
        message: 'Choose a credit profile that the current wallet qualifies for before requesting.',
      })
      return
    }

    if (effectiveAvailableLimit !== null && amount > effectiveAvailableLimit) {
      showToast({
        tone: 'danger',
        title: 'Amount exceeds limit',
        message: 'Requested amount is above the active combined limit for this profile.',
      })
      return
    }

    if (selectedProfile?.requiresCollateral) {
      if (collateralDraftAmount < requiredCollateralAmount) {
        showToast({
          tone: 'warning',
          title: 'Collateral too low',
          message: `This profile needs at least ${formatNumber(requiredCollateralAmount)} LEND locked before the request can be signed.`,
        })
        return
      }

      if (collateralDraftAmount > (rewards?.liquidLend ?? 0)) {
        showToast({
          tone: 'warning',
          title: 'Not enough liquid LEND',
          message: 'Claim or unstake more LEND before submitting a collateralized request.',
        })
        return
      }
    }

    if (activeMerchants.length > 0 && !selectedMerchant) {
      showToast({
        tone: 'warning',
        title: 'Choose an Initia app',
        message: 'Pick an active Initia app before requesting credit.',
      })
      return
    }

    if (!isConnected) {
      openConnect()
      return
    }

    setIsSubmittingRequest(true)
    let txHash = ''

    try {
      const token = await ensureBackendSession()
      const latestState = await syncBorrowerState(token)
      const existingActiveLoan = latestState.loans.find((loan) => loan.status === 'active')
      const existingPendingRequest = latestState.requests.find((request) => request.status === 'pending')

      if (existingActiveLoan) {
        throw new Error('Finish the current active credit before requesting a new one.')
      }

      if (existingPendingRequest) {
        throw new Error('A credit request is already pending. Wait for a decision before sending another one.')
      }

      if (!isChainWriteReady) {
        throw new Error('Move package is not configured. Live loan requests require a real chain target.')
      }

      const message = selectedProfile?.requiresCollateral
        ? createRequestCollateralizedLoanMessage({
            amount,
            collateralAmount: collateralDraftAmount,
            functionName: appEnv.requestCollateralFunctionName,
            moduleAddress: appEnv.packageAddress,
            moduleName: appEnv.loanModuleName,
            profileId: selectedProfile?.profileId ?? draft.profileId,
            sender: initiaAddress!,
            tenorMonths: draft.tenorMonths,
          })
        : createRequestLoanMessage({
            amount,
            functionName: appEnv.requestFunctionName,
            moduleAddress: appEnv.packageAddress,
            moduleName: appEnv.loanModuleName,
            profileId: selectedProfile?.profileId ?? draft.profileId,
            sender: initiaAddress!,
            tenorMonths: draft.tenorMonths,
          })

      const result = await requestWalletTx([message])
      txHash = extractTxHash(result)

      const nextRequest = await lendpayApi.createLoanRequest(token, {
        amount,
        collateralAmount: selectedProfile?.requiresCollateral ? collateralDraftAmount : 0,
        merchantId: selectedMerchant?.id,
        profileId: selectedProfile?.profileId ?? draft.profileId,
        tenorMonths: draft.tenorMonths,
        txHash: txHash || undefined,
      })

      let approvalMode: 'preview' | 'live' | null = null

      if (appEnv.enableDemoApproval && appEnv.previewOperatorToken) {
        const approval = await lendpayApi.approveLoanRequest(nextRequest.id, {
          operatorToken: appEnv.previewOperatorToken,
          reason: 'Auto-approval from borrower flow',
        })
        approvalMode = approval.mode
      }

      await syncProtocolAfterTx(token, txHash || undefined)
      setDraft(defaultDraft)
      setSelectedDropItemId('')
      setActivePage('loan')

      showToast({
        tone: 'success',
        title: approvalMode ? 'Request approved' : 'Request submitted',
        message: approvalMode
          ? selectedProfile?.requiresCollateral
            ? `Collateral locked and app credit is live for ${selectedMerchantTitle} in ${approvalMode} mode.`
            : `App credit is live for ${selectedMerchantTitle} in ${approvalMode} mode.`
          : selectedProfile?.requiresCollateral
            ? `Collateral locked and credit request submitted for ${selectedMerchantTitle}${txHash ? `: ${formatTxHash(txHash)}` : '.'}`
            : `Credit request submitted for ${selectedMerchantTitle}${txHash ? `: ${formatTxHash(txHash)}` : '.'}`,
      })
    } catch (error) {
      if (isTransactionTimedOut(error)) {
        return
      }

      showToast({
        tone: 'danger',
        title: 'Request failed',
        message: error instanceof Error ? error.message : 'Loan request could not be submitted.',
      })
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  const handleRepay = async () => {
    if (!activeLoan) {
      showToast({
        tone: 'info',
        title: 'No active loan',
        message: 'Submit and approve a request before trying to repay.',
      })
      return
    }

    if (!isConnected) {
      openConnect()
      return
    }

    const nextInstallment = activeLoan.schedule.find((item) => item.status !== 'paid')
    if (!nextInstallment) return

    setIsRepaying(true)
    let txHash = ''

    try {
      if (!/^\d+$/.test(activeLoan.id)) {
        throw new Error(
          'This loan is stored locally but is not linked to a live onchain loan id. Refresh your account first.',
        )
      }

      if (activeLoan.txHashApprove) {
        const approvalUrl = buildRestTxInfoUrl(activeLoan.txHashApprove)
        if (approvalUrl) {
          const approvalResponse = await fetch(approvalUrl)
          if (approvalResponse.status === 404) {
            throw new Error(
              'This approved loan does not exist on the active LendPay chain anymore. Refresh your account first.',
            )
          }
        }
      }

      if (!isChainWriteReady) {
        throw new Error('Move package is not configured. Live repayment requires a real chain target.')
      }

      const numericLoanId = parseNumericId(activeLoan.id) || 1
      const message = createRepayInstallmentMessage({
        functionName: appEnv.repayFunctionName,
        loanId: numericLoanId,
        moduleAddress: appEnv.packageAddress,
        moduleName: appEnv.loanModuleName,
        sender: initiaAddress!,
      })

      const result = await requestWalletTx([message])
      txHash = extractTxHash(result)

      const token = await ensureBackendSession()

      const repayment = await lendpayApi.repayLoan(token, activeLoan.id, txHash || undefined)
      await syncProtocolAfterTx(token, txHash || undefined)
      showToast({
        tone: 'success',
        title: 'Repayment confirmed',
        message:
          repayment.mode === 'live'
            ? `Payment received${repayment.txHash ? `: ${formatTxHash(repayment.txHash)}` : '.'}`
            : 'Payment status has been updated.',
      })
    } catch (error) {
      if (isTransactionTimedOut(error)) {
        return
      }

      const failureMessage = humanizeRepayError(
        getErrorMessage(error, 'Installment could not be repaid.'),
      )
      showToast({
        tone: 'danger',
        title: 'Repayment failed',
        message: failureMessage,
        layout: 'center',
      })
    } finally {
      setIsRepaying(false)
    }
  }

  const handleBuyViralDrop = async (item: ViralDropItemState) => {
    if (!activeLoan) {
      showToast({
        tone: 'warning',
        title: 'No approved credit',
        message: 'Approve a credit request first so funds are live in your wallet.',
      })
      return
    }

    if (!isConnected) {
      openConnect()
      return
    }

    const merchantId = Number(item.merchantId ?? activeLoan.merchantId ?? latestRequest?.merchantId ?? 0)
    if (!Number.isFinite(merchantId) || merchantId <= 0) {
      showToast({
        tone: 'danger',
        title: 'Drop unavailable',
        message: 'This drop is not linked to a live app route yet.',
      })
      return
    }

    setBuyingDropItemId(item.id)

    try {
      if (!isChainWriteReady) {
        throw new Error('Move package is not configured. Live purchases require a real chain target.')
      }

      const message = createBuyViralDropMessage({
        functionName: 'buy_item',
        itemId: Number(item.id),
        merchantId,
        moduleAddress: appEnv.packageAddress,
        moduleName: 'viral_drop',
        sender: initiaAddress!,
      })

      const result = await requestWalletTx([message])
      const txHash = extractTxHash(result)
      const token = await ensureBackendSession()
      await syncProtocolAfterTx(token, txHash || undefined)
      const instantDelivery = activeLoan.collateralAmount >= item.instantCollateralRequired
      showToast({
        tone: 'success',
        title: 'Purchase completed',
        message: instantDelivery
          ? `${item.name} receipt and collectible were delivered onchain${txHash ? `: ${formatTxHash(txHash)}` : '.'}`
          : `${item.name} receipt was minted onchain. The full collectible unlocks after full repayment${txHash ? `: ${formatTxHash(txHash)}` : '.'}`,
      })
    } catch (error) {
      if (isTransactionTimedOut(error)) {
        return
      }

      showToast({
        tone: 'danger',
        title: 'Purchase failed',
        message: error instanceof Error ? error.message : 'The app purchase could not be completed.',
      })
    } finally {
      setBuyingDropItemId(null)
    }
  }

  const handleClaimCollectible = async (purchase: ViralDropPurchaseState) => {
    if (purchase.collectibleClaimed) {
      showToast({
        tone: 'info',
        title: 'Collectible already delivered',
        message: 'This full collectible is already in your wallet.',
      })
      return
    }

    if (!purchase.collectibleClaimable) {
      showToast({
        tone: 'warning',
        title: 'Collectible still locked',
        message: 'Finish repaying this credit first. The full collectible unlocks only after the loan is fully repaid.',
      })
      return
    }

    const purchaseId = parseNumericId(purchase.id)
    if (!purchaseId) {
      showToast({
        tone: 'danger',
        title: 'Purchase unavailable',
        message: 'This purchase is not linked to a live onchain purchase id yet. Refresh your account first.',
      })
      return
    }

    try {
      await executeProtocolAction({
        actionKey: `claim-drop-${purchase.id}`,
        message: createClaimViralDropCollectibleMessage({
          functionName: 'claim_collectible',
          moduleAddress: appEnv.packageAddress,
          moduleName: 'viral_drop',
          purchaseId,
          sender: initiaAddress!,
        }),
        successMessage: `${purchase.itemName} collectible was delivered to your wallet.`,
        successTitle: 'Collectible claimed',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Claim failed',
        message: getErrorMessage(error, 'The collectible could not be claimed right now.'),
      })
    }
  }

  const handleClaimLend = async () => {
    if (!rewards?.claimableLend) {
      showToast({
        tone: 'info',
        title: 'Nothing to claim',
        message: 'Claimable LEND will appear after you earn enough rewards.',
      })
      return
    }

    try {
      await executeProtocolAction({
        actionKey: 'claim-lend',
        message: createClaimLendMessage({
          functionName: 'claim_lend',
          moduleAddress: appEnv.packageAddress,
          moduleName: 'rewards',
          sender: initiaAddress!,
        }),
        successMessage: 'Claimable LEND moved into the wallet.',
        successTitle: 'LEND claimed',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Claim failed',
        message: error instanceof Error ? error.message : 'LEND could not be claimed.',
      })
    }
  }

  const handleStake = async () => {
    const amount = Number(stakeAmount || 0)
    if (!rewards || amount <= 0 || amount > rewards.liquidLend) {
      showToast({
        tone: 'warning',
        title: 'Invalid stake amount',
        message: 'Enter a stake amount that fits within the liquid LEND balance.',
      })
      return
    }

    try {
      await executeProtocolAction({
        actionKey: 'stake',
        message: createStakeMessage({
          amount,
          functionName: 'stake',
          moduleAddress: appEnv.packageAddress,
          moduleName: 'staking',
          sender: initiaAddress!,
        }),
        successMessage: 'LEND moved into the staking vault.',
        successTitle: 'Stake confirmed',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Stake failed',
        message: error instanceof Error ? error.message : 'Stake could not be submitted.',
      })
    }
  }

  const handleUnstake = async () => {
    const amount = Number(unstakeAmount || 0)
    if (!rewards || amount <= 0 || amount > rewards.stakedLend) {
      showToast({
        tone: 'warning',
        title: 'Invalid unstake amount',
        message: 'Enter an unstake amount that fits within the staked LEND balance.',
      })
      return
    }

    try {
      await executeProtocolAction({
        actionKey: 'unstake',
        message: createStakeMessage({
          amount,
          functionName: 'unstake',
          moduleAddress: appEnv.packageAddress,
          moduleName: 'staking',
          sender: initiaAddress!,
        }),
        successMessage: 'LEND returned from the staking vault.',
        successTitle: 'Unstake confirmed',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Unstake failed',
        message: error instanceof Error ? error.message : 'Unstake could not be submitted.',
      })
    }
  }

  const handleClaimStakingRewards = async () => {
    if (!rewards?.claimableStakingRewards) {
      showToast({
        tone: 'info',
        title: 'No staking rewards',
        message: 'Staking rewards will appear after your staked balance starts earning.',
      })
      return
    }

    const stakingClaimMessage = createClaimLendMessage({
      functionName: 'claim_rewards',
      moduleAddress: appEnv.packageAddress,
      moduleName: 'staking',
      sender: initiaAddress!,
    })
    console.log('Claim message:', JSON.stringify(stakingClaimMessage, null, 2))

    try {
      await executeProtocolAction({
        actionKey: 'claim-staking',
        message: stakingClaimMessage,
        successMessage: 'Staking rewards were claimed into the wallet.',
        successTitle: 'Staking rewards claimed',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Claim failed',
        message: error instanceof Error ? error.message : 'Staking rewards could not be claimed.',
      })
    }
  }

  const handleClaimAvailableRewards = async () => {
    const claimableLend = rewards?.claimableLend ?? 0
    const claimableStaking = rewards?.claimableStakingRewards ?? 0

    if (!claimableLend && !claimableStaking) {
      showToast({
        tone: 'info',
        title: 'Nothing to claim',
        message: 'New LEND and staking rewards will appear here as you keep using credit well.',
      })
      return
    }

    if (!isConnected) {
      openConnect()
      return
    }

    if (!isChainWriteReady) {
      showToast({
        tone: 'danger',
        title: 'Claim unavailable',
        message: 'Move package is not configured. Live reward claims require a real chain target.',
      })
      return
    }

    setPendingProtocolAction('claim-all')
    setShowWalletRecovery(false)

    try {
      const token = await ensureBackendSession()

      const txHashes: string[] = []

      if (claimableLend > 0) {
        const lendClaimMessage = createClaimLendMessage({
          functionName: 'claim_lend',
          moduleAddress: appEnv.packageAddress,
          moduleName: 'rewards',
          sender: initiaAddress!,
        })
        console.log('Claim message:', JSON.stringify(lendClaimMessage, null, 2))

        const lendResult = await requestWalletTx([
          lendClaimMessage,
        ])
        const lendHash = extractTxHash(lendResult)
        if (lendHash) txHashes.push(lendHash)
        await syncProtocolAfterTx(token, lendHash || undefined)
      }

      if (claimableStaking > 0) {
        const stakingClaimMessage = createClaimLendMessage({
          functionName: 'claim_rewards',
          moduleAddress: appEnv.packageAddress,
          moduleName: 'staking',
          sender: initiaAddress!,
        })
        console.log('Claim message:', JSON.stringify(stakingClaimMessage, null, 2))

        const stakingResult = await requestWalletTx([
          stakingClaimMessage,
        ])
        const stakingHash = extractTxHash(stakingResult)
        if (stakingHash) txHashes.push(stakingHash)
        await syncProtocolAfterTx(token, stakingHash || undefined)
      }

      showToast({
        tone: 'success',
        title: 'Rewards claimed',
        message: txHashes.length
          ? `Available rewards were claimed.${txHashes[0] ? ` ${formatTxHash(txHashes[0])}` : ''}`
          : 'Available rewards were claimed.',
      })
    } catch (error) {
      if (isTransactionTimedOut(error)) {
        return
      }

      showToast({
        tone: 'danger',
        title: 'Claim failed',
        message: error instanceof Error ? error.message : 'Available rewards could not be claimed.',
        layout: 'corner',
      })
    } finally {
      setPendingProtocolAction(null)
    }
  }

  const handleOpenWalletApproval = () => {
    openWallet()
  }

  const handleDismissWalletRecovery = () => {
    setShowWalletRecovery(false)
  }

  const handlePayFeesInLend = async () => {
    if (!activeLoan || totalFeesDue <= 0) {
      showToast({
        tone: 'info',
        title: 'No outstanding fees',
        message: 'There are no unpaid fees on this purchase right now.',
      })
      return
    }

    try {
      await executeProtocolAction({
        actionKey: 'pay-fees',
        message: createRepayInstallmentMessage({
          functionName: 'pay_outstanding_fees_in_lend',
          loanId: parseNumericId(activeLoan.id),
          moduleAddress: appEnv.packageAddress,
          moduleName: 'fee_engine',
          sender: initiaAddress!,
        }),
        successMessage: 'Outstanding fees were paid in LEND.',
        successTitle: 'Fees paid',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Fee payment failed',
        message: error instanceof Error ? error.message : 'Fees could not be paid in LEND.',
      })
    }
  }

  const handleRedeemPointsToLend = async () => {
    const amount = Number(redeemPointsAmount || 0)
    if (!rewards || amount <= 0 || amount > rewards.points) {
      showToast({
        tone: 'warning',
        title: 'Invalid points amount',
        message: 'Enter a point amount that fits within the current points balance.',
      })
      return
    }

    try {
      await executeProtocolAction({
        actionKey: 'redeem-points',
        message: createSpendPointsMessage({
          amount,
          functionName: 'redeem_points_to_claimable_lend',
          moduleAddress: appEnv.packageAddress,
          moduleName: 'rewards',
          sender: initiaAddress!,
        }),
        successMessage: 'Points were converted into claimable LEND.',
        successTitle: 'Points redeemed',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Redemption failed',
        message: error instanceof Error ? error.message : 'Points could not be converted.',
      })
    }
  }

  const handleBuyLimitBoost = async () => {
    if (!rewards || rewards.points < LIMIT_BOOST_COST) {
      showToast({
        tone: 'warning',
        title: 'Not enough points',
        message: `You need ${LIMIT_BOOST_COST} points to buy a credit limit boost.`,
      })
      return
    }

    try {
      await executeProtocolAction({
        actionKey: 'limit-boost',
        message: createClaimLendMessage({
          functionName: 'spend_points_for_limit_boost',
          moduleAddress: appEnv.packageAddress,
          moduleName: 'rewards',
          sender: initiaAddress!,
        }),
        successMessage: 'Your limit boost is now active.',
        successTitle: 'Limit boost added',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Limit boost failed',
        message: error instanceof Error ? error.message : 'Limit boost could not be purchased.',
      })
    }
  }

  const handleBuyInterestDiscount = async () => {
    const wholePercent = Number(interestDiscountPercent || 0)
    const pointsCost = wholePercent * INTEREST_DISCOUNT_COST_PER_PERCENT

    if (!rewards || wholePercent <= 0 || rewards.points < pointsCost) {
      showToast({
        tone: 'warning',
        title: 'Not enough points',
        message: `You need ${pointsCost} points for a ${wholePercent || 0}% APR discount.`,
      })
      return
    }

    try {
      await executeProtocolAction({
        actionKey: 'interest-discount',
        message: createSpendPointsMessage({
          amount: wholePercent,
          functionName: 'spend_points_for_interest_discount',
          moduleAddress: appEnv.packageAddress,
          moduleName: 'rewards',
          sender: initiaAddress!,
        }),
        successMessage: 'Your APR discount is now active.',
        successTitle: 'APR discount added',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Discount failed',
        message: error instanceof Error ? error.message : 'Interest discount could not be purchased.',
      })
    }
  }

  const handleUnlockPremiumCheck = async () => {
    if (!rewards || rewards.points < PREMIUM_CHECK_COST) {
      showToast({
        tone: 'warning',
        title: 'Not enough points',
        message: `You need ${PREMIUM_CHECK_COST} points to add a premium credit check.`,
      })
      return
    }

    try {
      await executeProtocolAction({
        actionKey: 'premium-check',
        message: createClaimLendMessage({
          functionName: 'unlock_premium_credit_check',
          moduleAddress: appEnv.packageAddress,
          moduleName: 'rewards',
          sender: initiaAddress!,
        }),
        successMessage: 'A premium credit check was added to your account.',
        successTitle: 'Premium check added',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Unlock failed',
        message:
          error instanceof Error ? error.message : 'Premium credit check could not be added.',
      })
    }
  }

  const handleRedeemBadge = async () => {
    if (!rewards || rewards.points < BADGE_COST) {
      showToast({
        tone: 'warning',
        title: 'Not enough points',
        message: `You need ${BADGE_COST} points to claim an exclusive badge.`,
      })
      return
    }

    try {
      await executeProtocolAction({
        actionKey: 'badge',
        message: createClaimLendMessage({
          functionName: 'redeem_exclusive_badge',
          moduleAddress: appEnv.packageAddress,
          moduleName: 'rewards',
          sender: initiaAddress!,
        }),
        successMessage: 'Your badge has been added to the account.',
        successTitle: 'Badge redeemed',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Badge redemption failed',
        message: error instanceof Error ? error.message : 'Badge could not be redeemed.',
      })
    }
  }

  const handleClaimCampaign = async (campaignId: string) => {
    try {
      await executeProtocolAction({
        actionKey: `campaign-${campaignId}`,
        message: createClaimCampaignMessage({
          campaignId: Number(campaignId),
          functionName: 'claim_campaign',
          moduleAddress: appEnv.packageAddress,
          moduleName: 'campaigns',
          sender: initiaAddress!,
        }),
        successMessage: 'Campaign rewards were added to your account.',
        successTitle: 'Campaign claimed',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Campaign claim failed',
        message: error instanceof Error ? error.message : 'Campaign rewards could not be claimed.',
      })
    }
  }

  const handleProposeGovernance = async () => {
    const proposalType = Number(governanceDraft.proposalType || 0)
    if (!proposalType || !governanceDraft.title.trim() || !governanceDraft.body.trim()) {
      showToast({
        tone: 'warning',
        title: 'Incomplete proposal',
        message: 'Fill proposal type, title, and body before submitting governance.',
      })
      return
    }

    try {
      const operatorToken = requireOperatorToken()
      const { txHash } = await lendpayApi.proposeGovernance({
        operatorToken,
        proposalType,
        title: governanceDraft.title.trim(),
        body: governanceDraft.body.trim(),
      })
      const token = await ensureBackendSession()
      await syncBorrowerState(token)
      showToast({
        tone: 'success',
        title: 'Proposal submitted',
        message: `Governance proposal was broadcast.${txHash ? ` ${formatTxHash(txHash)}` : ''}`,
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Proposal failed',
        message: error instanceof Error ? error.message : 'Governance proposal could not be submitted.',
      })
    }
  }

  const handleVoteGovernance = async (proposalId: string, support: boolean) => {
    try {
      const operatorToken = requireOperatorToken()
      const { txHash } = await lendpayApi.voteGovernance({
        operatorToken,
        proposalId,
        support,
      })
      const token = await ensureBackendSession()
      await syncBorrowerState(token)
      showToast({
        tone: 'success',
        title: 'Vote submitted',
        message: `Governance vote ${support ? 'yes' : 'no'} was submitted.${txHash ? ` ${formatTxHash(txHash)}` : ''}`,
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Vote failed',
        message: error instanceof Error ? error.message : 'Governance vote could not be submitted.',
      })
    }
  }

  const handleFinalizeProposal = async (proposalId: string) => {
    try {
      const operatorToken = requireOperatorToken()
      const { txHash } = await lendpayApi.finalizeGovernance({
        operatorToken,
        proposalId,
      })
      const token = await ensureBackendSession()
      await syncBorrowerState(token)
      showToast({
        tone: 'success',
        title: 'Finalization submitted',
        message: `Proposal finalization was submitted.${txHash ? ` ${formatTxHash(txHash)}` : ''}`,
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Finalize failed',
        message: error instanceof Error ? error.message : 'Governance proposal could not be finalized.',
      })
    }
  }

  const handleCreateCampaign = async () => {
    const phase = Number(campaignDraft.phase || 0)
    const totalAllocation = Number(campaignDraft.totalAllocation || 0)
    const minimumPlatformActions = Number(campaignDraft.minimumPlatformActions || 0)

    if (!phase || totalAllocation <= 0 || minimumPlatformActions < 0) {
      showToast({
        tone: 'warning',
        title: 'Invalid campaign',
        message: 'Fill phase, allocation, and minimum platform activity with valid values.',
      })
      return
    }

    try {
      const operatorToken = requireOperatorToken()
      const { txHash } = await lendpayApi.createCampaign({
        operatorToken,
        phase,
        totalAllocation,
        requiresUsername: campaignDraft.requiresUsername,
        minimumPlatformActions,
      })
      const token = await ensureBackendSession()
      await syncBorrowerState(token)
      showToast({
        tone: 'success',
        title: 'Campaign created',
        message: `Campaign created.${txHash ? ` ${formatTxHash(txHash)}` : ''}`,
      })
      setCampaignDraft(defaultCampaignDraft)
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Campaign failed',
        message: error instanceof Error ? error.message : 'Campaign could not be created.',
      })
    }
  }

  const handleAllocateCampaign = async () => {
    const campaignId = Number(allocationDraft.campaignId || 0)
    const amount = Number(allocationDraft.amount || 0)
    const userAddress = allocationDraft.userAddress.trim()

    if (!campaignId || amount <= 0 || !userAddress) {
      showToast({
        tone: 'warning',
        title: 'Invalid allocation',
        message: 'Campaign id, user address, and allocation amount are required.',
      })
      return
    }

    try {
      const operatorToken = requireOperatorToken()
      const { txHash } = await lendpayApi.allocateCampaign({
        operatorToken,
        campaignId: String(campaignId),
        userAddress,
        amount,
      })
      const token = await ensureBackendSession()
      await syncBorrowerState(token)
      showToast({
        tone: 'success',
        title: 'Allocation created',
        message: `Campaign allocation was recorded.${txHash ? ` ${formatTxHash(txHash)}` : ''}`,
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Allocation failed',
        message: error instanceof Error ? error.message : 'Campaign allocation could not be created.',
      })
    }
  }

  const handleRegisterMerchant = async () => {
    const merchantAddress = merchantDraft.merchantAddress.trim()
    const category = merchantDraft.category.trim()
    const listingFeeBps = Number(merchantDraft.listingFeeBps || 0)
    const partnerFeeBps = Number(merchantDraft.partnerFeeBps || 0)

    if (!merchantAddress || !category || listingFeeBps < 0 || partnerFeeBps < 0) {
      showToast({
        tone: 'warning',
        title: 'Invalid merchant',
        message: 'Merchant address, category, and fee fields must be valid before submitting.',
      })
      return
    }

    try {
      const operatorToken = requireOperatorToken()
      const { txHash } = await lendpayApi.registerMerchant({
        operatorToken,
        merchantAddress,
        category,
        listingFeeBps,
        partnerFeeBps,
      })
      const token = await ensureBackendSession()
      await syncBorrowerState(token)
      showToast({
        tone: 'success',
        title: 'Merchant registered',
        message: `Store added.${txHash ? ` ${formatTxHash(txHash)}` : ''}`,
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Merchant failed',
        message: error instanceof Error ? error.message : 'Merchant could not be registered.',
      })
    }
  }

  const handleSetMerchantActive = async (merchantId: string, active: boolean) => {
    try {
      const operatorToken = requireOperatorToken()
      const { txHash } = await lendpayApi.setMerchantActive({
        operatorToken,
        merchantId,
        active,
      })
      const token = await ensureBackendSession()
      await syncBorrowerState(token)
      showToast({
        tone: 'success',
        title: 'Merchant updated',
        message: `Store marked ${active ? 'active' : 'inactive'}.${txHash ? ` ${formatTxHash(txHash)}` : ''}`,
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Merchant update failed',
        message: error instanceof Error ? error.message : 'Merchant status could not be updated.',
      })
    }
  }

  const agentSignals = score?.signals
    ? [
        { label: 'Identity strength', value: `${score.signals.identityStrength}/100` },
        { label: 'Activity strength', value: `${score.signals.activityStrength}/100` },
        { label: 'Balance strength', value: `${score.signals.balanceStrength}/100` },
        { label: 'Repayment strength', value: `${score.signals.repaymentStrength}/100` },
        { label: 'Loyalty strength', value: `${score.signals.loyaltyStrength}/100` },
      ]
    : []
  const agentEngineLabel = score
    ? score.provider === 'ollama'
      ? score.model
        ? `Ollama ${score.model}`
        : 'Ollama'
      : 'Heuristic analysis'
    : 'Not analyzed yet'
  const eligibilityRows = [
    { label: 'Identity', status: isConnected ? 'Connected' : 'Connect wallet', tone: 'success' as const },
    {
      label: 'Risk check',
      status: score ? `${score.score} score ready` : 'Analyze wallet first',
      tone: score ? ('info' as const) : ('warning' as const),
    },
    {
      label: 'App',
      status: checkoutMerchantReady ? selectedMerchantTitle : 'Choose an Initia app',
      tone: merchantEligibilityTone,
    },
    {
      label: 'Profile',
      status: selectedProfile ? formatProfileLabel(selectedProfile.label) : 'Awaiting profile sync',
      tone: 'neutral' as const,
    },
    {
      label: 'Security',
      status: requestSecurityLabel,
      tone: requestSecurityTone,
    },
    {
      label: 'Last request (previous)',
      status: latestRequest ? titleCase(latestRequest.status) : 'No request yet',
      tone: requestStatusTone,
    },
  ]
  const redeemPreviewLend = Math.floor(Number(redeemPointsAmount || 0) / 100)
  const hasLendInventory = Boolean(
    rewards &&
      (rewards.liquidLend > 0 ||
        rewards.claimableLend > 0 ||
        rewards.stakedLend > 0 ||
        rewards.claimableStakingRewards > 0),
  )
  const hasPointInventory = Boolean(rewards && rewards.points > 0)
  const operatorModeEnabled =
    typeof window !== 'undefined' &&
    (window.location.search.includes('operator=1') || window.location.hash.includes('operator'))
  const technicalModeEnabled =
    typeof window !== 'undefined' &&
    (window.location.search.includes('technical=1') || window.location.hash.includes('technical'))

  const verifiedUsername = profile?.usernameVerified ? username ?? undefined : undefined
  const previewUsername = !profile?.usernameVerified ? username ?? undefined : undefined
  const identityLabel = verifiedUsername ?? (initiaAddress ? shortenAddress(initiaAddress) : 'Connect wallet')
  const borrowerGuidance = consumerScoreLine(score, rewards)
  const paidInstallmentsCount = loans.reduce(
    (sum, loan) => sum + loan.schedule.filter((item) => item.status === 'paid').length,
    0,
  )
  const hasRepaymentHistory = paidInstallmentsCount > 0 || loans.some((loan) => loan.installmentsPaid > 0)
  const effectiveStreak = rewards?.streak && rewards.streak > 0 ? rewards.streak : hasRepaymentHistory ? 1 : 0
  const streakLabel =
    effectiveStreak === 0
      ? 'Make your first on-time payment to start your streak'
      : `${effectiveStreak} on-time payment${effectiveStreak > 1 ? 's' : ''} in a row`
  const heroAprLabel = score ? `${score.apr}%` : 'Analyze first'
  const heroScoreLabel = score ? `Score ${formatNumber(score.score)}` : 'Score pending'
  const heroDueDate = nextDueItem?.dueAt ? formatDate(nextDueItem.dueAt) : 'No payment due'
  const heroDueAmount = nextDueItem?.amount ?? null
  const currentTier = rewards?.tier ?? null
  const nextTier = nextTierLabel(currentTier)
  const heldLendAmount = rewards?.heldLend ?? 0
  const currentTierFloor = currentTier ? tierHoldingsThreshold[currentTier] : 0
  const nextTierTarget =
    currentTier && nextTier
      ? currentTier === 'Diamond'
        ? currentTierFloor
        : tierHoldingsThreshold[nextTier]
      : 0
  const tierProgressPercent =
    currentTier === 'Diamond'
      ? 100
      : currentTier && nextTierTarget > currentTierFloor
        ? Math.max(
          0,
          Math.min(
            100,
            ((heldLendAmount - currentTierFloor) / Math.max(nextTierTarget - currentTierFloor, 1)) * 100,
          ),
        )
        : 0
  const tierProgressLabel =
    currentTier === 'Diamond'
      ? 'Top tier unlocked'
      : currentTier && nextTier
        ? `${formatNumber(Math.max(nextTierTarget - heldLendAmount, 0))} LEND to ${nextTier}`
        : 'Tier data will appear after rewards sync.'
  const nextTierTargetLabel =
    currentTier === 'Diamond'
      ? 'Top tier reached'
      : currentTier && nextTier
        ? `${formatNumber(nextTierTarget)} LEND for ${nextTier}`
        : 'Waiting for next tier target'
  const tierNote =
    rewards && rewards.points === 0 && currentTier && currentTier !== 'Bronze'
      ? 'Tier based on LEND held, not points'
      : 'Repay on time and keep LEND in your account to strengthen perks.'
  const claimableRewardsTotal = (rewards?.claimableLend ?? 0) + (rewards?.claimableStakingRewards ?? 0)
  const canClaimAvailableRewards = claimableRewardsTotal > 0
  const overviewClaimableRewardsLabel = rewards ? `${formatNumber(claimableRewardsTotal)} LEND` : '—'
  const overviewRewardsStatusLabel =
    rewards === null
      ? 'Waiting for rewards'
      : canClaimAvailableRewards
        ? 'Ready to claim'
        : 'Nothing claimable'
  const loyaltyHeroUsername =
    verifiedUsername ?? previewUsername ?? (initiaAddress ? shortenAddress(initiaAddress) : 'Identity unavailable')
  const nextTierBenefits = currentTier ? nextTierBenefitCopy[currentTier] : null
  const benefitRows = [
    {
      label: 'APR discount',
      current: formatBpsPercent(rewards?.interestDiscountBps ?? 0),
      next: nextTierBenefits?.apr ?? 'Refresh rewards to see the next unlock',
    },
    {
      label: 'Credit limit boost',
      current: formatBpsPercent(rewards?.creditLimitBoostBps ?? 0),
      next: nextTierBenefits?.limit ?? 'Refresh rewards to see the next unlock',
    },
    {
      label: 'Premium checks',
      current: `${rewards?.premiumChecksAvailable ?? 0}`,
      next: nextTierBenefits?.premium ?? 'Refresh rewards to see the next unlock',
    },
  ]
  const leaderboardRows: LeaderboardEntry[] =
    (leaderboardTab === 'borrowers'
      ? leaderboard?.topBorrowers ?? []
      : leaderboardTab === 'repayers'
        ? leaderboard?.topRepayers ?? []
        : leaderboardTab === 'referrers'
          ? leaderboard?.topReferrers ?? []
          : leaderboard?.risingStars ?? []
    ).map((entry) =>
      entry.address === initiaAddress && rewards?.tier
        ? {
            ...entry,
            tier: rewards.tier,
          }
        : entry,
    )
  const totalBorrowedVolume = loans.reduce((sum, loan) => sum + loan.principal, 0)
  const totalRepaidAmount = loans.reduce(
    (sum, loan) => sum + loan.schedule.filter((item) => item.status === 'paid').reduce((loanSum, item) => loanSum + item.amount, 0),
    0,
  )
  const fallbackLeaderboardEntry: LeaderboardEntry | null =
    score && initiaAddress
      ? {
          rank: 1,
          address: initiaAddress,
          username: verifiedUsername ?? undefined,
          tier: rewards?.tier ?? 'Bronze',
          value:
            leaderboardTab === 'borrowers'
              ? formatCurrency(totalBorrowedVolume || activeLoan?.principal || 0)
              : leaderboardTab === 'repayers'
                ? `${effectiveStreak} payment${effectiveStreak === 1 ? '' : 's'}`
                : leaderboardTab === 'referrers'
                  ? `${formatNumber(referral?.activeReferrals ?? 0)} active`
                  : '+0 this month',
          metric:
            leaderboardTab === 'borrowers'
              ? `${formatCurrency(totalRepaidAmount)} repaid`
              : leaderboardTab === 'repayers'
                ? `${paidInstallmentsCount} installment${paidInstallmentsCount === 1 ? '' : 's'} paid`
                : leaderboardTab === 'referrers'
                  ? `${formatNumber(referral?.pointsEarned ?? 0)} points`
                  : `Current score ${score.score}`,
        }
      : null
  const currentLeaderboardRows: LeaderboardEntry[] =
    leaderboardRows.length === 0 && fallbackLeaderboardEntry ? [fallbackLeaderboardEntry] : leaderboardRows
  const leaderboardMyRank =
    leaderboardTab === 'borrowers'
      ? leaderboard?.myRank?.borrowers
      : leaderboardTab === 'repayers'
        ? leaderboard?.myRank?.repayers
        : leaderboardTab === 'referrers'
          ? leaderboard?.myRank?.referrers
          : leaderboard?.myRank?.risingStars
  const effectiveLeaderboardMyRank =
    leaderboardMyRank ?? (currentLeaderboardRows.length === 1 && fallbackLeaderboardEntry ? 1 : undefined)
  const outstandingLabel = activeLoan ? formatCurrency(outstandingAmount) : '—'
  const installmentsLabel = activeLoan
    ? `${activeLoan.installmentsPaid}/${activeLoan.schedule.length} installment${activeLoan.schedule.length > 1 ? 's' : ''} paid`
    : 'No active payments'
  const walletTagLabel =
    walletNativeBalance === null
      ? 'Waiting for wallet data'
      : walletNativeBalance <= 1
        ? 'Low balance'
        : 'Ready to use'
  const leaderboardTabMeta =
    leaderboardTab === 'borrowers'
      ? 'Ranked by total borrowed volume, with repaid amount shown below.'
      : leaderboardTab === 'repayers'
        ? 'Ranked by repayment streak, with on-time rate shown below.'
        : leaderboardTab === 'referrers'
          ? 'Ranked by active healthy referrals, with referral points shown below.'
          : 'Ranked by score improvement this month, with current score shown below.'
  const progressPercent = activeLoan ? Math.max(12, Math.min(100, loanProgressPercent)) : 8
  const scoreRefreshLabel = score?.scannedAt ? formatDate(score.scannedAt) : '—'
  const riskBadgeTone: 'success' | 'warning' | 'danger' =
    score?.risk === 'Low' ? 'success' : score?.risk === 'High' ? 'danger' : 'warning'
  const tierBadgeTone: 'warning' | 'info' | 'neutral' =
    rewards?.tier === 'Gold' || rewards?.tier === 'Diamond' ? 'warning' : rewards?.tier === 'Silver' ? 'info' : 'neutral'
  const findBreakdownPoints = (...keywords: string[]) => {
    const match = score?.breakdown.find((item) =>
      keywords.some((keyword) => item.label.toLowerCase().includes(keyword)),
    )
    return match?.points ?? null
  }
  const repaymentBreakdownPoints = findBreakdownPoints('repayment')
  const walletBreakdownPoints = findBreakdownPoints('transaction', 'balance')
  const identityBreakdownPoints = findBreakdownPoints('cross-app', 'wallet age')
  const paymentHistoryPercent =
    repaymentBreakdownPoints === null
      ? null
      : Math.max(0, Math.min(Math.round((repaymentBreakdownPoints / 180) * 100), 100))
  const walletActivityPercent =
    walletBreakdownPoints === null
      ? null
      : Math.max(0, Math.min(Math.round((walletBreakdownPoints / 150) * 100), 100))
  const identityStrengthPercent =
    identityBreakdownPoints === null
      ? null
      : Math.max(0, Math.min(Math.round((identityBreakdownPoints / 120) * 100), 100))
  const scoreBreakdownRows: ScoreBreakdownRow[] = [
    {
      label: 'Payment history',
      percent: paymentHistoryPercent,
      tone: 'green',
      points: repaymentBreakdownPoints,
      status: paymentHistoryPercent === null ? 'Not available' : scoreStatusLabel(paymentHistoryPercent),
    },
    {
      label: 'Wallet activity',
      percent: walletActivityPercent,
      tone: 'blue',
      points: walletBreakdownPoints,
      status: walletActivityPercent === null ? 'Not available' : scoreStatusLabel(walletActivityPercent),
    },
    {
      label: 'Identity strength',
      percent: identityStrengthPercent,
      tone: 'green',
      points: identityBreakdownPoints,
      status: identityStrengthPercent === null ? 'Not available' : scoreStatusLabel(identityStrengthPercent),
    },
  ]
  const nextProfileMilestone = !score
    ? {
        title: 'Run a fresh analysis to set your next milestone',
        targetScore: null as number | null,
        scoreGap: null as number | null,
        detail: 'LendPay will map your next score threshold after it rescans wallet and repayment data.',
      }
    : score.score < 700
      ? {
          title: 'Reach 700 to unlock more room',
          targetScore: 700,
          scoreGap: 700 - score.score,
          detail: 'Crossing 700 opens more products and keeps pricing steadier.',
        }
      : score.score < 780
        ? {
            title: 'Reach 780 to unlock a lower APR range',
            targetScore: 780,
            scoreGap: 780 - score.score,
            detail: 'Clean repayments and consistent activity move you into the strongest pricing band.',
          }
        : {
            title: 'Keep your score above 780 to hold best pricing',
            targetScore: 780,
            scoreGap: 0,
            detail: 'You are already in the lowest APR range. Keep your next payment on time to stay there.',
          };

  const suggestedSpendToday = score
    ? Math.max(
        0,
        Math.round(
          Math.min(effectiveAvailableLimit ?? score.limitUsd, selectedProfile?.maxPrincipal ?? score.limitUsd) *
            (score.risk === 'Low' ? 0.5 : score.risk === 'Medium' ? 0.3 : 0.15),
        ),
      )
    : 0
  const heroSafeSpendLabel = score ? formatCurrency(suggestedSpendToday) : '—'
  const overviewIdentityStrip =
    [
      verifiedUsername ?? (initiaAddress ? shortenAddress(initiaAddress) : null),
      rewards?.tier ? `${rewards.tier} tier` : null,
      score ? heroScoreLabel : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Identity not available'

  let agentPanelTitle = 'Connect your wallet to unlock guided credit'
  let agentPanelBody =
    'Once your profile is live, LendPay Agent will explain the safest next move for your account.'
  let agentPanelRecommendation = 'Connect and refresh your profile'
  let agentPanelConfidence: number | null = null
  let agentPanelActionLabel: string | undefined = undefined
  let handleAgentPanelAction: (() => void) | undefined = undefined

  let topbarTitle = 'Overview'
  let topbarSubtitle = 'Limit, activity, and next payment at a glance'
  let topbarTitleBadge: string | undefined = isBackendSyncing
    ? 'Refreshing profile'
    : score
      ? 'Ready to use'
      : 'Run profile'
  let topbarStatus: string | undefined = undefined
  let topbarPrimaryLabel: string | undefined = activeLoan ? 'Repay now' : 'Use credit'
  let topbarSecondaryLabel: string | undefined = activeLoan ? 'Use credit' : undefined
  let handleTopbarPrimaryAction: (() => void) | undefined = activeLoan ? handleRepay : () => setActivePage('request')
  let handleTopbarSecondaryAction: (() => void) | undefined = activeLoan ? () => setActivePage('request') : undefined

  if (activePage === 'analyze') {
    topbarTitle = 'Profile'
    topbarSubtitle = 'Your score, identity, and credit terms in one place'
    topbarTitleBadge = undefined
    topbarStatus = score ? 'Score ready' : 'Needs analysis'
    topbarPrimaryLabel = undefined
    topbarSecondaryLabel = isAnalyzing ? '↻ Re-analyzing...' : '↻ Re-analyze'
    handleTopbarPrimaryAction = undefined
    handleTopbarSecondaryAction = handleAnalyze
    agentPanelTitle = score ? `Your estimated score is ${score.score} and still has room to grow` : 'Refresh your profile to get an updated estimate'
    agentPanelBody = score
      ? borrowerGuidance
      : 'Run one profile refresh and LendPay Agent will turn wallet and repayment data into a clear credit recommendation.'
    agentPanelRecommendation = score
      ? activeLoan
        ? 'Repay your next installment to lift your ceiling'
        : 'Keep activity clean and refresh after your next onchain action'
      : 'Refresh your profile'
    agentPanelConfidence = null
    agentPanelActionLabel = isAnalyzing ? undefined : 'Re-analyze'
    handleAgentPanelAction = isAnalyzing ? undefined : handleAnalyze
  } else if (activePage === 'request') {
    topbarTitle = 'Request'
    topbarSubtitle = 'Choose one app below, then set the amount and send your request'
    topbarTitleBadge = undefined
    topbarStatus = requestBlockingMessage
      ? activeLoan
        ? 'Active credit in progress'
        : 'Request already pending'
      : checkoutMerchantReady
        ? effectiveAvailableLimit !== null
          ? `${formatCurrency(effectiveAvailableLimit)} available`
          : 'Analyze first'
        : 'Choose app below'
    topbarPrimaryLabel = undefined
    topbarSecondaryLabel = undefined
    handleTopbarPrimaryAction = undefined
    handleTopbarSecondaryAction = undefined
    agentPanelTitle = requestBlockingMessage
      ? activeLoan
        ? 'Finish your current credit first'
        : 'Wait for the current request result'
      : !checkoutMerchantReady
        ? 'Choose one app below to start'
      : selectedProfile
        ? `Best fit today: ${formatProfileLabel(selectedProfile.label)}`
        : 'Choose a product before you send a request'
    agentPanelBody = requestBlockingMessage
      ? activeLoan
        ? `You already have ${formatCurrency(activeLoan.principal)} active. Go to Repay to keep that credit healthy before opening another one.`
        : 'A request is already being reviewed. Come back here after it is approved or rejected.'
      : !checkoutMerchantReady
        ? 'Pick one live app below first. After that, the amount, product, and repayment options will open here.'
      : selectedProfile
        ? checkoutMerchantReady
          ? selectedMerchantDropItems.length
            ? score && monthlyPaymentPreview !== null
              ? `${formatProfileLabel(selectedProfile.label)} fits ${selectedMerchantTitle}. Match the amount to a live item and your estimated monthly payment is ${formatCurrency(monthlyPaymentPreview)}.`
              : `${formatProfileLabel(selectedProfile.label)} fits ${selectedMerchantTitle}. Run wallet analysis to price this credit request with live APR and repayment terms.`
          : score && monthlyPaymentPreview !== null
            ? `${formatProfileLabel(selectedProfile.label)} keeps this request ${selectedProfile.requiresCollateral ? 'secured with locked LEND' : 'with no collateral'}. This app has no live item listed yet, so the request stays general until the app publishes one.`
            : `${formatProfileLabel(selectedProfile.label)} is ready. Refresh your profile to price this credit request with live APR and repayment terms.`
        : 'Pick one app here first. Ecosystem is for browsing live apps; Request is where you send credit to one app.'
      : 'Refresh your profile to unlock product recommendations for this purchase.'
    agentPanelRecommendation = requestBlockingMessage
      ? activeLoan
        ? 'Go to Repay'
        : 'Wait for review'
      : !checkoutMerchantReady
        ? 'Choose an app below'
      : checkoutMerchantReady
        ? isSubmittingRequest
          ? 'Preparing your request'
          : 'Send your credit request'
        : 'Pick one app in Request'
    agentPanelConfidence = null
    agentPanelActionLabel = requestBlockingMessage
      ? activeLoan
        ? 'Open Repay'
        : undefined
      : !checkoutMerchantReady
        ? undefined
      : checkoutMerchantReady
        ? isSubmittingRequest
          ? undefined
          : 'Send credit request'
        : undefined
    handleAgentPanelAction = requestBlockingMessage
      ? activeLoan
        ? () => setActivePage('loan')
        : undefined
      : checkoutMerchantReady && !isSubmittingRequest
        ? handleRequestLoan
        : undefined
  } else if (activePage === 'loan') {
    topbarTitle = 'Repay'
    topbarSubtitle = 'Current payment, purchase details, and what is left to repay'
    topbarTitleBadge = undefined
    topbarStatus = activeLoan
      ? nextDueItem
        ? 'Payment due'
        : 'No payment due'
      : claimableDropPurchase
        ? 'Collectible ready'
        : 'No active loan'
    topbarPrimaryLabel = claimableDropPurchase
      ? 'Claim collectible'
      : activeLoan && latestDropPurchase
        ? 'Repay now'
        : 'Use credit'
    topbarSecondaryLabel = !claimableDropPurchase && activeLoan && latestDropPurchase ? 'Use credit' : undefined
    handleTopbarPrimaryAction = claimableDropPurchase
      ? () => void handleClaimCollectible(claimableDropPurchase)
      : activeLoan && latestDropPurchase
        ? handleRepay
        : () => setActivePage('request')
    handleTopbarSecondaryAction =
      !claimableDropPurchase && activeLoan && latestDropPurchase ? () => setActivePage('request') : undefined
    agentPanelTitle = claimableDropPurchase
      ? `${claimableDropPurchase.itemName} is ready to claim`
      : activeLoan
      ? latestDropPurchase
        ? `Pay ${nextDueItem ? formatCurrency(nextDueItem.amount) : 'your next installment'} by ${nextDueItem ? formatDate(nextDueItem.dueAt) : 'the due date'} to protect your limit`
        : 'Your approved balance is ready to use'
      : 'No payment due right now'
    agentPanelBody = claimableDropPurchase
      ? 'Your receipt is already onchain. The full collectible is unlocked now because the repayment flow is complete.'
      : activeLoan
      ? latestDropPurchase
        ? nextDueItem
          ? `Pay ${formatCurrency(nextDueItem.amount)} by ${formatDate(nextDueItem.dueAt)} to protect your limit and keep APR pressure low next cycle.`
          : 'This purchase is current. Stay ready for the next due date and keep your record clean.'
        : activeLoanDropItems.length
          ? 'Use the funded balance in the selected app, receive the onchain item in your wallet, then come back here to stay on schedule.'
          : 'Your wallet has been funded. Use the approved credit inside the linked app before the next repayment date.'
      : 'Once you complete a purchase, LendPay Agent will track the safest repayment path for you.'
    agentPanelRecommendation = claimableDropPurchase
      ? 'Claim the full collectible'
      : activeLoan
      ? latestDropPurchase
        ? 'Repay this installment'
        : 'Use the approved balance in your app'
      : 'Open Request when you are ready'
    agentPanelConfidence = null
    agentPanelActionLabel = claimableDropPurchase
      ? isClaimingDropCollectible
        ? undefined
        : 'Claim collectible'
      : activeLoan && latestDropPurchase && !isRepaying
        ? 'Repay now'
        : undefined
    handleAgentPanelAction = claimableDropPurchase
      ? () => void handleClaimCollectible(claimableDropPurchase)
      : activeLoan && latestDropPurchase && !isRepaying
        ? handleRepay
        : undefined
  } else if (activePage === 'rewards') {
    topbarTitle = 'Loyalty Hub'
    topbarSubtitle = 'Rewards, streaks, and the perks tied to your account'
    topbarTitleBadge = undefined
    topbarStatus = rewards?.tier ? `${rewards.tier} tier` : 'Tier pending'
    topbarPrimaryLabel = 'Use credit'
    topbarSecondaryLabel = activeLoan ? 'Repay now' : undefined
    handleTopbarPrimaryAction = () => setActivePage('request')
    handleTopbarSecondaryAction = activeLoan ? () => setActivePage('loan') : undefined
    agentPanelTitle = canClaimAvailableRewards
      ? `${formatNumber(claimableRewardsTotal)} LEND ready to claim`
      : 'Loyalty is building in the background'
    agentPanelBody = canClaimAvailableRewards
      ? `Claim ${formatNumber(claimableRewardsTotal)} LEND from your rewards balance, keep your streak active, and turn healthy repayment into stronger credit perks.`
      : 'Each clean repayment and repeat purchase adds more trust to your account and moves you closer to better terms.'
    agentPanelRecommendation = canClaimAvailableRewards ? `Claim ${formatNumber(claimableRewardsTotal)} LEND from your rewards balance` : 'Use credit and repay on time'
    agentPanelConfidence = null
    agentPanelActionLabel = canClaimAvailableRewards ? `Claim ${formatNumber(claimableRewardsTotal)} LEND` : 'Use credit'
    handleAgentPanelAction = canClaimAvailableRewards ? handleClaimAvailableRewards : () => setActivePage('request')
  } else if (activePage === 'admin') {
    topbarTitle = 'Ecosystem'
    topbarSubtitle = 'Apps, campaigns, and network activity around LendPay'
    topbarTitleBadge = undefined
    topbarStatus = undefined
    topbarPrimaryLabel = 'Use credit'
    topbarSecondaryLabel = undefined
    handleTopbarPrimaryAction = () => setActivePage('request')
    handleTopbarSecondaryAction = undefined
  } else {
    agentPanelTitle = score
      ? `You can safely spend up to ${formatCurrency(suggestedSpendToday)} today`
      : 'Refresh your profile to unlock your first limit'
    agentPanelBody = score
      ? activeLoan
        ? `Your total limit is ${formatCurrency(score.limitUsd)}. For this cycle, LendPay Agent recommends spending up to ${formatCurrency(suggestedSpendToday)} while you keep the next payment on time.`
        : `Your total limit is ${formatCurrency(score.limitUsd)}. For this cycle, LendPay Agent recommends spending up to ${formatCurrency(suggestedSpendToday)} across trusted Initia apps.`
      : 'Once your profile is refreshed, LendPay Agent will recommend the safest spend amount for this account.'
    agentPanelRecommendation = activeLoan ? 'Repay the next installment' : 'Open Request and choose an app'
    agentPanelConfidence = null
    agentPanelActionLabel = activeLoan ? 'Repay now' : score ? 'Use credit' : 'Refresh profile'
    handleAgentPanelAction = activeLoan ? handleRepay : score ? () => setActivePage('request') : handleAnalyze
  }

  if (isConnected && !hasLoadedBorrowerState) {
    topbarTitleBadge = undefined
    topbarStatus = loadError ? 'Load failed' : 'Syncing account'
    topbarPrimaryLabel = loadError ? 'Retry load' : undefined
    topbarSecondaryLabel = undefined
    handleTopbarPrimaryAction = loadError ? () => void handleRetryLoad() : undefined
    handleTopbarSecondaryAction = undefined
  }

  const assistantLabel = !isConnected
    ? 'Connect to start'
    : !hasLoadedBorrowerState
      ? loadError
        ? 'Waiting for a retry'
        : 'Syncing live account data'
    : activePage === 'analyze'
      ? 'Profile status'
      : activePage === 'request'
        ? 'Credit request'
        : activePage === 'loan'
          ? 'Repayment watch'
          : activePage === 'rewards'
            ? 'Loyalty status'
            : activePage === 'admin'
              ? 'Watching ecosystem activity'
              : 'Account summary'
  const assistantDetail = !isConnected
    ? 'Connect your wallet once and the agent will guide your next step.'
    : !hasLoadedBorrowerState
      ? loadError ?? 'Live borrower data is syncing from the API.'
    : activePage === 'admin'
      ? 'Track which apps, campaigns, and proposals are live around LendPay.'
      : agentPanelRecommendation
  const isInitialDataLoading = isConnected && !hasLoadedBorrowerState && isBackendSyncing
  const hasInitialLoadError = isConnected && !hasLoadedBorrowerState && Boolean(loadError)
  const canRenderConnectedPages = isConnected && hasLoadedBorrowerState

  return (
    <div className="app-shell">
      <div className="app-backdrop" aria-hidden="true">
        <div className="app-backdrop__orb app-backdrop__orb--one" />
        <div className="app-backdrop__orb app-backdrop__orb--two" />
        <div className="app-backdrop__orb app-backdrop__orb--three" />
        <div className="app-backdrop__mesh" />
        <div className="app-backdrop__scan" />
      </div>
      <Sidebar
        active={activePage}
        assistantDetail={assistantDetail}
        assistantLabel={assistantLabel}
        connected={isConnected}
        identityLabel={identityLabel}
        onChange={setActivePage}
      />
      <div className="main-shell">
        <Topbar
          agentDetail={assistantDetail}
          agentLabel={isConnected ? assistantLabel : undefined}
          connected={isConnected}
          onConnect={openConnect}
          onPrimaryAction={handleTopbarPrimaryAction}
          onSecondaryAction={handleTopbarSecondaryAction}
          pageSubtitle={topbarSubtitle}
          pageTitle={topbarTitle}
          primaryLabel={topbarPrimaryLabel}
          secondaryLabel={topbarSecondaryLabel}
          statusLabel={topbarStatus}
          titleBadgeLabel={topbarTitleBadge}
        />

        <main className="page">
          <motion.section
            key={activePage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {!isConnected ? (
              <div className="wallet-gate">
                <Card eyebrow="Wallet required" title="Connect your wallet to get started" className="wallet-gate__card card--primary">
                  <p className="wallet-gate__body">
                    LendPay starts working after it can read your wallet and rewards. Connect once,
                    then you can see your limit, live apps, and upcoming payments.
                  </p>
                  <div className="wallet-gate__steps">
                    <div className="wallet-gate__step">
                      <span>1</span>
                      <strong>Connect wallet</strong>
                      <small>Link your Initia wallet to load your account.</small>
                    </div>
                    <div className="wallet-gate__step">
                      <span>2</span>
                      <strong>Refresh profile</strong>
                      <small>See your limit, pricing, and rewards in one place.</small>
                    </div>
                    <div className="wallet-gate__step">
                      <span>3</span>
                      <strong>Use credit</strong>
                      <small>Pick an Initia app, use credit, and repay over time.</small>
                    </div>
                  </div>
                  <div className="wallet-gate__cta">
                    <Button onClick={openConnect}>Connect wallet</Button>
                  </div>
                </Card>
              </div>
            ) : null}

            {isInitialDataLoading ? (
              <Card eyebrow="Syncing account" title="Loading your live borrower data" className="section-stack">
                <div className="skeleton-stack" aria-hidden="true">
                  <div className="skeleton-bar" />
                  <div className="skeleton-bar" />
                  <div className="skeleton-bar" />
                </div>
              </Card>
            ) : null}

            {hasInitialLoadError ? (
              <Card eyebrow="Load failed" title="We could not load your live data" className="section-stack">
                <EmptyState
                  title="Try loading your account again"
                  subtitle={loadError ?? 'Live borrower data could not be loaded from the API.'}
                  actionLabel="Retry load"
                  onAction={handleRetryLoad}
                />
              </Card>
            ) : null}

            {canRenderConnectedPages && activePage !== 'admin' ? (
              <AgentPanel
                actionLabel={agentPanelActionLabel}
                body={agentPanelBody}
                confidence={agentPanelConfidence}
                onAction={handleAgentPanelAction}
                recommendation={agentPanelRecommendation}
                title={agentPanelTitle}
              />
            ) : null}

            {canRenderConnectedPages && faucet?.enabled && needsTestnetFunds ? (
              <Card eyebrow="Testnet faucet" title="Fund this wallet before sending onchain actions" className="faucet-card section-stack card--primary">
                <div className="faucet-card__main">
                  <div>
                    <div className="faucet-card__amount">{faucetClaimAmountLabel}</div>
                    <p className="faucet-card__body">
                      This wallet needs testnet {appEnv.nativeSymbol} before it can request credit, repay, or claim rewards onchain.
                    </p>
                    <div className="faucet-card__meta">
                      One claim every {faucet.cooldownHours} hours · {faucetAvailabilityLabel}
                    </div>
                    {faucet.txHash ? (
                      <a
                        className="faucet-card__link"
                        href={faucetTxUrl ?? buildRpcTxUrl(faucet.txHash) ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Latest faucet tx {formatTxHash(faucet.txHash)}
                      </a>
                    ) : null}
                  </div>
                  <Button onClick={handleClaimFaucet} disabled={isClaimingFaucet || !faucet.canClaim}>
                    {isClaimingFaucet ? 'Sending...' : faucet.canClaim ? 'Claim testnet LEND' : 'Claim available later'}
                  </Button>
                </div>
              </Card>
            ) : null}

            {canRenderConnectedPages && activePage === 'overview' ? (
              <OverviewPage
                activeLoan={activeLoan}
                canClaimAvailableRewards={canClaimAvailableRewards}
                claimableRewardsLabel={overviewClaimableRewardsLabel}
                combinedActivities={combinedActivities}
                handleClaimAvailableRewards={handleClaimAvailableRewards}
                handleRepay={handleRepay}
                handleRetryLoad={handleRetryLoad}
                heroAprLabel={heroAprLabel}
                heroDueAmount={heroDueAmount}
                heroDueDate={heroDueDate}
                heroSafeSpendLabel={heroSafeSpendLabel}
                installmentsLabel={installmentsLabel}
                isClaimingRewards={isProtocolActionPending('claim-all')}
                isRepaying={isRepaying}
                outstandingLabel={outstandingLabel}
                overviewIdentityStrip={overviewIdentityStrip}
                progressPercent={progressPercent}
                rewards={rewards}
                rewardsStatusLabel={overviewRewardsStatusLabel}
                score={score}
                sectionErrors={sectionErrors}
                walletNativeBalanceLabel={walletNativeBalanceLabel}
                walletTagLabel={walletTagLabel}
              />
            ) : null}

            {canRenderConnectedPages && activePage === 'analyze' ? (
              <ProfilePage
                agentEngineLabel={agentEngineLabel}
                agentSignals={agentSignals}
                initiaAddress={initiaAddress}
                nextProfileMilestone={nextProfileMilestone}
                rewards={rewards}
                riskBadgeTone={riskBadgeTone}
                score={score}
                scoreBreakdownRows={scoreBreakdownRows}
                scoreRefreshLabel={scoreRefreshLabel}
                technicalModeEnabled={technicalModeEnabled}
                tierBadgeTone={tierBadgeTone}
                username={username}
                usernameSource={profile?.usernameSource}
                usernameVerified={profile?.usernameVerified ?? false}
              />
            ) : null}

            {canRenderConnectedPages && activePage === 'request' ? (
              <RequestPage
                activeLoan={activeLoan}
                activeMerchants={activeMerchants}
                checkoutFormLocked={checkoutFormLocked}
                checkoutMerchantReady={checkoutMerchantReady}
                checkoutSelectionMessage={checkoutSelectionMessage}
                checkoutSliderMax={checkoutSliderMax}
                checkoutSliderValue={checkoutSliderValue}
                draft={draft}
                eligibilityRows={eligibilityRows}
                estimatedTotalRepayment={estimatedTotalRepayment}
                groupedActiveApps={groupedActiveApps}
                handleRequestLoan={handleRequestLoan}
                handleRetryLoad={handleRetryLoad}
                isSubmittingRequest={isSubmittingRequest}
                monthlyPaymentPreview={monthlyPaymentPreview}
                orderedProfiles={orderedProfiles}
                quickPickAmounts={quickPickAmounts}
                requestBlockingMessage={requestBlockingMessage}
                requestQuickApps={requestQuickApps}
                requests={requests}
                requiredCollateralAmount={requiredCollateralAmount}
                rewards={rewards}
                score={score}
                sectionErrors={sectionErrors}
                selectedAppMeta={selectedAppMeta}
                selectedDropItem={selectedDropItem}
                selectedDropItemId={selectedDropItemId}
                selectedMerchant={selectedMerchant}
                selectedMerchantDropItems={selectedMerchantDropItems}
                selectedMerchantTitle={selectedMerchantTitle}
                selectedProfile={selectedProfile}
                selectedRouteOutcomeCopy={selectedRouteOutcomeCopy}
                setDraft={setDraft}
                setSelectedDropItemId={setSelectedDropItemId}
                updateDraftAmount={updateDraftAmount}
              />
            ) : null}

            {canRenderConnectedPages && activePage === 'loan' ? (
              <RepayPage
                activeLoan={activeLoan}
                activeLoanDropItems={activeLoanDropItems}
                buyingDropItemId={buyingDropItemId}
                checkoutAppMeta={checkoutAppMeta}
                checkoutDueLabel={checkoutDueLabel}
                checkoutMerchantTitle={checkoutMerchantTitle}
                claimableDropPurchase={claimableDropPurchase}
                handleBuyViralDrop={handleBuyViralDrop}
                handleClaimCollectible={handleClaimCollectible}
                handlePayFeesInLend={handlePayFeesInLend}
                handleRepay={handleRepay}
                handleRetryLoad={handleRetryLoad}
                isClaimingDropCollectible={isClaimingDropCollectible}
                isProtocolActionPending={isProtocolActionPending}
                isRepayGuideOpen={isRepayGuideOpen}
                isRepaying={isRepaying}
                latestDropDelivery={latestDropDelivery}
                latestDropPurchase={latestDropPurchase}
                latestDropUnlockRows={latestDropUnlockRows}
                loanFees={loanFees}
                nextDueItem={nextDueItem}
                nextDueLabel={nextDueLabel}
                outstandingAmount={outstandingAmount}
                paidAmount={paidAmount}
                repayCardEyebrow={repayCardEyebrow}
                sectionErrors={sectionErrors}
                setIsRepayGuideOpen={setIsRepayGuideOpen}
                totalFeesDue={totalFeesDue}
                walletNativeBalanceLabel={walletNativeBalanceLabel}
              />
            ) : null}

            {canRenderConnectedPages && activePage === 'rewards' ? (
              <LoyaltyHubPage
                benefitRows={benefitRows}
                canClaimAvailableRewards={canClaimAvailableRewards}
                currentLeaderboardRows={currentLeaderboardRows}
                currentTier={currentTier}
                handleApplyReferralCode={handleApplyReferralCode}
                handleBuyInterestDiscount={handleBuyInterestDiscount}
                handleBuyLimitBoost={handleBuyLimitBoost}
                handleClaimAvailableRewards={handleClaimAvailableRewards}
                handleCopyReferralCode={handleCopyReferralCode}
                handleOpenWalletApproval={handleOpenWalletApproval}
                handleDismissWalletRecovery={handleDismissWalletRecovery}
                handleRedeemBadge={handleRedeemBadge}
                handleRedeemPointsToLend={handleRedeemPointsToLend}
                handleRetryLoad={handleRetryLoad}
                handleShareReferralCode={handleShareReferralCode}
                handleStake={handleStake}
                handleUnlockPremiumCheck={handleUnlockPremiumCheck}
                handleUnstake={handleUnstake}
                hasLendInventory={hasLendInventory}
                hasPointInventory={hasPointInventory}
                heldLendAmount={heldLendAmount}
                initiaAddress={initiaAddress}
                interestDiscountPercent={interestDiscountPercent}
                isApplyingReferral={isApplyingReferral}
                isProtocolActionPending={isProtocolActionPending}
                leaderboardMyRank={effectiveLeaderboardMyRank}
                leaderboardTab={leaderboardTab}
                leaderboardTabMeta={leaderboardTabMeta}
                loyaltyHeroUsername={loyaltyHeroUsername}
                redeemPointsAmount={redeemPointsAmount}
                redeemPreviewLend={redeemPreviewLend}
                referral={referral}
                referralCodeInput={referralCodeInput}
                rewards={rewards}
                sectionErrors={sectionErrors}
                showWalletRecovery={showWalletRecovery}
                setInterestDiscountPercent={setInterestDiscountPercent}
                setLeaderboardTab={setLeaderboardTab}
                setRedeemPointsAmount={setRedeemPointsAmount}
                setReferralCodeInput={setReferralCodeInput}
                setStakeAmount={setStakeAmount}
                setUnstakeAmount={setUnstakeAmount}
                stakeAmount={stakeAmount}
                streakLabel={streakLabel}
                technicalModeEnabled={technicalModeEnabled}
                tierNote={tierNote}
                tierProgressLabel={tierProgressLabel}
                tierProgressPercent={tierProgressPercent}
                nextTierTargetLabel={nextTierTargetLabel}
                unstakeAmount={unstakeAmount}
              />
            ) : null}

            {canRenderConnectedPages && activePage === 'admin' ? (
              <EcosystemPage
                allocationDraft={allocationDraft}
                campaignDraft={campaignDraft}
                campaigns={campaigns}
                ecosystemFamilyStats={ecosystemFamilyStats}
                governance={governance}
                governanceDraft={governanceDraft}
                handleAllocateCampaign={handleAllocateCampaign}
                handleClaimCampaign={handleClaimCampaign}
                handleCreateCampaign={handleCreateCampaign}
                handleFinalizeProposal={handleFinalizeProposal}
                handleProposeGovernance={handleProposeGovernance}
                handleRegisterMerchant={handleRegisterMerchant}
                handleRetryLoad={handleRetryLoad}
                handleSetMerchantActive={handleSetMerchantActive}
                handleVoteGovernance={handleVoteGovernance}
                isProtocolActionPending={isProtocolActionPending}
                merchantDraft={merchantDraft}
                openCampaignCount={openCampaignCount}
                operatorModeEnabled={operatorModeEnabled}
                protocolUpdates={protocolUpdates}
                sectionErrors={sectionErrors}
                setAllocationDraft={setAllocationDraft}
                setCampaignDraft={setCampaignDraft}
                setGovernanceDraft={setGovernanceDraft}
                setMerchantDraft={setMerchantDraft}
                setSelectedAppProofId={setSelectedAppProofId}
                technicalModeEnabled={technicalModeEnabled}
                uniqueApps={uniqueApps}
                username={username}
              />
            ) : null}
          </motion.section>
        </main>

        {selectedAppProof ? (
          <ProofModal
            interactionTxDetails={interactionTxDetails}
            isProofLoading={isProofLoading}
            onClose={() => setSelectedAppProofId(null)}
            onToast={showToast}
            registrationTxDetails={registrationTxDetails}
            selectedAppProof={selectedAppProof}
          />
        ) : null}

        <MobileNav active={activePage} onChange={setActivePage} />

        {toast ? (
          <div className={toast.layout === 'center' ? 'toast-overlay' : undefined}>
            <div className={`toast toast--${toast.tone} ${toast.layout === 'center' ? 'toast--center' : ''}`}>
              {toast.layout === 'center' ? (
                <button className="toast__close" onClick={() => setToast(null)} type="button">
                  ×
                </button>
              ) : null}
              <div className="toast__title">{toast.title}</div>
              <div className="toast__message">{toast.message}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default App
