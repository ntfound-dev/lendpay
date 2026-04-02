import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { signBackendChallenge } from './lib/auth'
import { appEnv, isChainWriteReady } from './config/env'
import { lendpayApi } from './lib/api'
import {
  createClaimCampaignMessage,
  createClaimLendMessage,
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
  formatPoints,
  formatRelative,
  formatTokenAmount,
  formatTxHash,
  shortenAddress,
} from './lib/format'
import type {
  ActivityItem,
  CampaignState,
  CreditProfileQuote,
  CreditScoreState,
  GovernanceProposalState,
  LoanFeeState,
  LoanRequestState,
  LoanState,
  MerchantState,
  NavKey,
  RewardsState,
  ToastState,
  UserProfile,
} from './types/domain'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { MobileNav } from './components/layout/MobileNav'
import { Button } from './components/ui/Button'
import { Card } from './components/ui/Card'
import { Badge } from './components/ui/Badge'
import { ScoreRing } from './components/score/ScoreRing'
import { LoanSchedule } from './components/loans/LoanSchedule'
import { ActivityFeed } from './components/shared/ActivityFeed'
import { IdentityCard } from './components/shared/IdentityCard'

type RequestDraft = {
  amount: string
  collateralAmount: string
  merchantId: string
  tenorMonths: 1 | 3 | 6
  profileId: number
}

const REDEEM_POINTS_BASE = 1000
const REDEEM_LEND_OUTPUT = 10
const LIMIT_BOOST_COST = 500
const INTEREST_DISCOUNT_COST_PER_PERCENT = 300
const PREMIUM_CHECK_COST = 200
const BADGE_COST = 1000

const defaultDraft: RequestDraft = {
  amount: '500',
  collateralAmount: '0',
  merchantId: '',
  profileId: 1,
  tenorMonths: 3,
}

const parseNumericId = (value?: string | null) => Number(value?.replace(/\D/g, '') || 0)

const formatMerchantCategory = (value?: string) =>
  value ? value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : 'Merchant checkout'

function App() {
  const {
    autoSign,
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
  const [draft, setDraft] = useState<RequestDraft>(defaultDraft)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isBackendSyncing, setIsBackendSyncing] = useState(false)
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const [isRepaying, setIsRepaying] = useState(false)
  const [pendingProtocolAction, setPendingProtocolAction] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [username, setUsername] = useState<string | undefined>(walletUsername ?? undefined)
  const [stakeAmount, setStakeAmount] = useState('1')
  const [unstakeAmount, setUnstakeAmount] = useState('1')
  const [redeemPointsAmount, setRedeemPointsAmount] = useState(String(REDEEM_POINTS_BASE))
  const [interestDiscountPercent, setInterestDiscountPercent] = useState('1')
  const [governanceDraft, setGovernanceDraft] = useState({
    proposalType: '1',
    title: 'Adjust treasury allocation',
    body: 'Rebalance treasury policy to support healthy borrower growth.',
  })
  const [campaignDraft, setCampaignDraft] = useState({
    phase: '1',
    totalAllocation: '100',
    requiresUsername: false,
    minimumPlatformActions: '0',
  })
  const [allocationDraft, setAllocationDraft] = useState({
    campaignId: '1',
    userAddress: '',
    amount: '25',
  })
  const [merchantDraft, setMerchantDraft] = useState({
    merchantAddress: '',
    category: 'marketplace',
    listingFeeBps: '100',
    partnerFeeBps: '150',
  })

  const apiEnabled = Boolean(appEnv.apiBaseUrl)
  const isConnected = Boolean(initiaAddress)
  const autosignEnabledForChain = Boolean(autoSign?.isEnabledByChain?.[appEnv.appchainId])
  const activeLoan = loans.find((loan) => loan.status === 'active') ?? null
  const nextDueItem = activeLoan?.schedule.find((item) => item.status === 'due') ?? null
  const latestRequest = requests[0] ?? null
  const monthlyPaymentPreview = useMemo(() => {
    const amount = Number(draft.amount || 0)
    const totalInterest = (amount * (((score?.apr ?? 0) / 100) * draft.tenorMonths)) / 12
    return amount > 0 ? (amount + totalInterest) / draft.tenorMonths : 0
  }, [draft.amount, draft.tenorMonths, score?.apr])
  const loanProgressPercent = activeLoan
    ? (activeLoan.installmentsPaid / activeLoan.schedule.length) * 100
    : 0
  const requestedAmount = Number(draft.amount || 0)
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
  const selectedProfile =
    profileQuotes.find((profile) => profile.profileId === draft.profileId) ?? profileQuotes[0] ?? null
  const requiredCollateralAmount =
    selectedProfile?.requiresCollateral && requestedAmount > 0
      ? Math.ceil((requestedAmount * selectedProfile.collateralRatioBps) / 10_000)
      : 0
  const effectiveAvailableLimit = selectedProfile
    ? selectedProfile.requiresCollateral
      ? selectedProfile.maxPrincipal
      : Math.min(score?.limitUsd ?? selectedProfile.maxPrincipal, selectedProfile.maxPrincipal)
    : score?.limitUsd ?? 0
  const walletNativeBalance = profile?.wallet.nativeBalance ?? 0
  const lockedCollateralLend = profile?.wallet.lockedCollateralLend ?? 0
  const walletNativeBalanceLabel = `${formatTokenAmount(walletNativeBalance, appEnv.nativeDecimals)} ${appEnv.nativeSymbol}`
  const lockedCollateralLabel = `${formatNumber(lockedCollateralLend)} LEND`
  const activeMerchants = merchants.filter((merchant) => merchant.active)
  const selectedMerchant =
    activeMerchants.find((merchant) => merchant.id === draft.merchantId) ?? activeMerchants[0] ?? null
  const latestCheckoutMerchant = activeLoan?.merchantId
    ? merchants.find((merchant) => merchant.id === activeLoan.merchantId) ?? null
    : latestRequest?.merchantId
      ? merchants.find((merchant) => merchant.id === latestRequest.merchantId) ?? null
      : null
  const selectedMerchantTitle = selectedMerchant
    ? formatMerchantCategory(selectedMerchant.category)
    : 'No merchant selected'
  const selectedMerchantAddress = selectedMerchant
    ? shortenAddress(selectedMerchant.merchantAddress)
    : 'No live partner'
  const selectedMerchantFeeLabel = selectedMerchant
    ? `${(selectedMerchant.partnerFeeBps / 100).toFixed(2)}% partner fee`
    : 'No fee quote'
  const activeCollateralAmount = activeLoan?.collateralAmount ?? latestRequest?.collateralAmount ?? 0
  const activeCollateralStatus = activeLoan?.collateralStatus
    ? activeLoan.collateralStatus
    : latestRequest?.collateralAmount
      ? latestRequest.status === 'rejected'
        ? 'returned'
      : 'locked'
      : 'none'
  const checkoutMerchant = latestCheckoutMerchant ?? selectedMerchant
  const checkoutMerchantTitle = checkoutMerchant
    ? formatMerchantCategory(checkoutMerchant.category)
    : 'Merchant checkout'
  const checkoutMerchantWalletLabel = checkoutMerchant
    ? shortenAddress(checkoutMerchant.merchantAddress)
    : 'Merchant wallet unavailable'
  const checkoutFundingAmount = activeLoan?.principal ?? latestRequest?.amount ?? requestedAmount
  const checkoutPartnerFeeAmount = checkoutMerchant
    ? (checkoutFundingAmount * checkoutMerchant.partnerFeeBps) / 10_000
    : 0
  const checkoutDueLabel = nextDueItem
    ? `${formatDate(nextDueItem.dueAt)} · ${formatRelative(nextDueItem.dueAt)}`
    : activeLoan
      ? 'No payment due'
      : 'Approval pending'
  const checkoutFundingState = activeLoan
    ? 'Funds released to your wallet'
    : latestRequest
      ? 'Funds release after approval'
      : 'No checkout funded yet'

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
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

    const hasSelected = profileQuotes.some((profile) => profile.profileId === draft.profileId)
    if (!hasSelected) {
      setDraft((current) => ({ ...current, profileId: profileQuotes[0].profileId }))
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
      setDraft((current) => ({ ...current, merchantId: activeMerchants[0].id }))
    }
  }, [activeMerchants, draft.merchantId])

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
    setActivities([])
    setUsername(walletUsername ?? undefined)
  }

  const showToast = (nextToast: ToastState) => setToast(nextToast)

  const requireOperatorToken = () => {
    if (!appEnv.previewOperatorToken) {
      showToast({
        tone: 'warning',
        title: 'Operator token missing',
        message: 'Set VITE_PREVIEW_OPERATOR_TOKEN so admin actions can be sent from the app.',
      })
      throw new Error('Missing operator token')
    }

    return appEnv.previewOperatorToken
  }

  const syncBorrowerState = async (token: string, profileOverride?: UserProfile) => {
    const [profile, nextScore, nextRequests, nextLoans, nextActivities, nextProfiles, nextCampaigns, nextGovernance, nextMerchants] = await Promise.all([
      profileOverride ? Promise.resolve(profileOverride) : lendpayApi.getMe(token),
      lendpayApi.getScore(token),
      lendpayApi.listLoanRequests(token),
      lendpayApi.listLoans(token),
      lendpayApi.getActivity(token),
      lendpayApi.listProtocolProfiles(token).catch(() => []),
      lendpayApi.listCampaigns(token).catch(() => []),
      lendpayApi.listGovernance(token).catch(() => []),
      lendpayApi.listMerchants(token).catch(() => []),
    ])
    const nextActiveLoan = nextLoans.find((loan) => loan.status === 'active') ?? null
    const nextLoanFees = nextActiveLoan
      ? await lendpayApi.getLoanFees(token, nextActiveLoan.id).catch(() => null)
      : null

    setProfile(profile)
    setRewards(profile.rewards)
    setUsername(profile.username ?? walletUsername ?? shortenAddress(initiaAddress))
    setScore(nextScore)
    setRequests(nextRequests)
    setLoans(nextLoans)
    setLoanFees(nextLoanFees)
    setProfileQuotes(nextProfiles)
    setCampaigns(nextCampaigns)
    setGovernance(nextGovernance)
    setMerchants(nextMerchants)
    setActivities(nextActivities)

    return {
      loans: nextLoans,
      profile,
      profiles: nextProfiles,
      requests: nextRequests,
      score: nextScore,
    }
  }

  const syncProtocolAfterTx = async (token: string, txHash?: string) => {
    if (apiEnabled) {
      await lendpayApi.syncRewards(token, txHash)
    }

    return syncBorrowerState(token)
  }

  const ensureBackendSession = async () => {
    if (!apiEnabled || !initiaAddress || !offlineSigner) return null

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
      setUsername(auth.user.username ?? walletUsername ?? shortenAddress(initiaAddress))
      return auth.token
    } catch {
      return null
    }
  }

  const executeProtocolAction = async (input: {
    actionKey: string
    message: unknown
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
      const result = await (requestTxBlock as unknown as (payload: unknown) => Promise<unknown>)({
        chainId: appEnv.appchainId,
        messages: [input.message],
      })
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
    } finally {
      setPendingProtocolAction(null)
    }
  }

  useEffect(() => {
    if (!apiEnabled || !initiaAddress) {
      setSessionToken(null)
      resetBorrowerState()
      return
    }

    let cancelled = false

    const bootstrap = async () => {
      setIsBackendSyncing(true)

      try {
        if (!offlineSigner) {
          return
        }

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

        if (cancelled) return

        setSessionToken(auth.token)
        await syncBorrowerState(auth.token, auth.user)
      } catch (error) {
        if (cancelled) return

        resetBorrowerState()

        showToast({
          tone: 'warning',
          title: 'Backend sync unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'Could not load borrower state from the API.',
        })
      } finally {
        if (!cancelled) {
          setIsBackendSyncing(false)
        }
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

      if (!apiEnabled || !token) {
        throw new Error('Backend session is required before analyzing a real borrower profile.')
      }

      await lendpayApi.analyzeScore(token)
      await syncBorrowerState(token)
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

  const handleToggleAutosign = async () => {
    if (!autoSign) {
      showToast({
        tone: 'info',
        title: 'Autosign not available',
        message: 'This wallet session does not expose autosign controls yet.',
      })
      return
    }

    try {
      if (autosignEnabledForChain) {
        await autoSign.disable(appEnv.appchainId)
        showToast({
          tone: 'info',
          title: 'Autosign disabled',
          message: 'Session-based signing has been revoked for this chain.',
        })
      } else {
        await autoSign.enable(appEnv.appchainId)
        showToast({
          tone: 'success',
          title: 'Autosign enabled',
          message: 'Wallet autosign is now active for this rollup.',
        })
      }
    } catch (error) {
      showToast({
        tone: 'warning',
        title: 'Autosign unavailable',
        message:
          error instanceof Error ? error.message : 'Provider autosign is not configured yet.',
      })
    }
  }

  const handleRequestLoan = async () => {
    const amount = Number(draft.amount || 0)
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

    if (amount > effectiveAvailableLimit) {
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

    if (merchants.length > 0 && !selectedMerchant) {
      showToast({
        tone: 'warning',
        title: 'Choose a merchant',
        message: 'Pick an active merchant partner before requesting checkout credit.',
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

      const result = await (requestTxBlock as unknown as (payload: unknown) => Promise<unknown>)({
        chainId: appEnv.appchainId,
        messages: [message],
      })
      txHash = extractTxHash(result)

      const token = await ensureBackendSession()

      if (!apiEnabled || !token) {
        throw new Error('Backend session is required before submitting a live request.')
      }

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
      setActivePage('loan')

      showToast({
        tone: 'success',
        title: approvalMode ? 'Request approved' : 'Request submitted',
        message: approvalMode
          ? selectedProfile?.requiresCollateral
            ? `Collateral locked and checkout credit is live for ${selectedMerchantTitle} in ${approvalMode} mode.`
            : `Checkout credit is live for ${selectedMerchantTitle} in ${approvalMode} mode.`
          : selectedProfile?.requiresCollateral
            ? `Collateral locked and checkout request submitted for ${selectedMerchantTitle}${txHash ? `: ${formatTxHash(txHash)}` : '.'}`
            : `Checkout request submitted for ${selectedMerchantTitle}${txHash ? `: ${formatTxHash(txHash)}` : '.'}`,
      })
    } catch (error) {
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

      const result = await (requestTxBlock as unknown as (payload: unknown) => Promise<unknown>)({
        chainId: appEnv.appchainId,
        messages: [message],
      })
      txHash = extractTxHash(result)

      const token = await ensureBackendSession()

      if (!apiEnabled || !token) {
        throw new Error('Backend session is required before repaying a live loan.')
      }

      const repayment = await lendpayApi.repayLoan(token, activeLoan.id, txHash || undefined)
      await syncProtocolAfterTx(token, txHash || undefined)
      showToast({
        tone: 'success',
        title: 'Repayment confirmed',
        message:
          repayment.mode === 'live'
            ? `Installment settled onchain${repayment.txHash ? `: ${formatTxHash(repayment.txHash)}` : '.'}`
            : 'Installment state was synced from the backend.',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Repayment failed',
        message: error instanceof Error ? error.message : 'Installment could not be repaid.',
      })
    } finally {
      setIsRepaying(false)
    }
  }

  const handleClaimLend = async () => {
    if (!rewards?.claimableLend) {
      showToast({
        tone: 'info',
        title: 'Nothing to claim',
        message: 'Claimable LEND will appear after points convert into protocol rewards.',
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
        message: 'Claimable staking rewards will appear after protocol fees accrue to stakers.',
      })
      return
    }

    try {
      await executeProtocolAction({
        actionKey: 'claim-staking',
        message: createClaimLendMessage({
          functionName: 'claim_rewards',
          moduleAddress: appEnv.packageAddress,
          moduleName: 'staking',
          sender: initiaAddress!,
        }),
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

  const handlePayFeesInLend = async () => {
    if (!activeLoan || totalFeesDue <= 0) {
      showToast({
        tone: 'info',
        title: 'No outstanding fees',
        message: 'This loan does not have unpaid origination or late fees in the protocol state.',
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
        successMessage: 'Outstanding protocol fees were settled in LEND.',
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
        successMessage: 'Credit limit boost was recorded onchain.',
        successTitle: 'Limit boost unlocked',
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
        successMessage: 'APR discount was recorded onchain.',
        successTitle: 'Interest discount unlocked',
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
        message: `You need ${PREMIUM_CHECK_COST} points to unlock a premium credit check.`,
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
        successMessage: 'A premium credit check slot was added onchain.',
        successTitle: 'Premium check unlocked',
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Unlock failed',
        message:
          error instanceof Error ? error.message : 'Premium credit check could not be unlocked.',
      })
    }
  }

  const handleRedeemBadge = async () => {
    if (!rewards || rewards.points < BADGE_COST) {
      showToast({
        tone: 'warning',
        title: 'Not enough points',
        message: `You need ${BADGE_COST} points to mint an exclusive borrower badge.`,
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
        successMessage: 'A borrower badge was redeemed onchain.',
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
        successMessage: 'Campaign rewards were claimed from the protocol.',
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
      if (token) {
        await syncBorrowerState(token)
      }
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
      if (token) {
        await syncBorrowerState(token)
      }
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
      if (token) {
        await syncBorrowerState(token)
      }
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
      if (token) {
        await syncBorrowerState(token)
      }
      showToast({
        tone: 'success',
        title: 'Campaign created',
        message: `Campaign was created onchain.${txHash ? ` ${formatTxHash(txHash)}` : ''}`,
      })
      setCampaignDraft((current) => ({ ...current, totalAllocation: '100', minimumPlatformActions: '0' }))
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
      if (token) {
        await syncBorrowerState(token)
      }
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

  const handleCloseCampaign = async (campaignId: string) => {
    try {
      const operatorToken = requireOperatorToken()
      const { txHash } = await lendpayApi.closeCampaign({
        operatorToken,
        campaignId,
      })
      const token = await ensureBackendSession()
      if (token) {
        await syncBorrowerState(token)
      }
      showToast({
        tone: 'success',
        title: 'Campaign closed',
        message: `Campaign was closed onchain.${txHash ? ` ${formatTxHash(txHash)}` : ''}`,
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Close failed',
        message: error instanceof Error ? error.message : 'Campaign could not be closed.',
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
      if (token) {
        await syncBorrowerState(token)
      }
      showToast({
        tone: 'success',
        title: 'Merchant registered',
        message: `Merchant was registered onchain.${txHash ? ` ${formatTxHash(txHash)}` : ''}`,
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
      if (token) {
        await syncBorrowerState(token)
      }
      showToast({
        tone: 'success',
        title: 'Merchant updated',
        message: `Merchant was marked ${active ? 'active' : 'inactive'} onchain.${txHash ? ` ${formatTxHash(txHash)}` : ''}`,
      })
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Merchant update failed',
        message: error instanceof Error ? error.message : 'Merchant status could not be updated.',
      })
    }
  }

  const overviewStats = [
    {
      label: 'Approved limit',
      value: score ? formatCurrency(score.limitUsd) : 'Analyze first',
      foot: score ? `APR ${score.apr}% · ${score.risk} risk` : 'No live score yet',
      tone: 'limit',
    },
    {
      label: 'Wallet balance',
      value: walletNativeBalanceLabel,
      foot: `${lockedCollateralLabel} locked · ${formatNumber(rewards?.liquidLend ?? 0)} liquid LEND`,
      tone: 'wallet',
    },
    {
      label: 'Score',
      value: score ? formatNumber(score.score) : 'Not analyzed',
      foot: score ? `Updated ${formatDate(score.scannedAt)}` : 'Run wallet analysis',
      tone: 'score',
    },
    {
      label: 'Points',
      value: rewards ? formatPoints(rewards.points) : 'No rewards yet',
      foot: rewards
        ? `${rewards.tier} tier · ${rewards.claimableLend} claimable LEND · ${rewards.streak} repayment streak`
        : 'Sync wallet profile',
      tone: 'points',
    },
  ]
  const heroSignals = [
    { label: 'Linked identity', value: username ?? 'No username yet' },
    { label: 'Borrow now', value: score ? formatCurrency(score.limitUsd) : 'Analyze wallet' },
    { label: 'Wallet cash', value: walletNativeBalanceLabel },
    { label: 'Do next', value: activeLoan ? 'Repay installment' : 'Request loan' },
  ]
  const analysisSignals = [...(score?.breakdown ?? [])]
    .sort((left, right) => right.points - left.points)
    .slice(0, 3)
  const agentSignals = score?.signals
    ? [
        { label: 'Identity strength', value: `${score.signals.identityStrength}/100` },
        { label: 'Activity strength', value: `${score.signals.activityStrength}/100` },
        { label: 'Balance strength', value: `${score.signals.balanceStrength}/100` },
        { label: 'Repayment strength', value: `${score.signals.repaymentStrength}/100` },
        { label: 'Loyalty strength', value: `${score.signals.loyaltyStrength}/100` },
      ]
    : []
  const overviewAgentSignals = score?.signals
    ? [
        { label: 'Identity', value: `${score.signals.identityStrength}/100` },
        { label: 'Repayment', value: `${score.signals.repaymentStrength}/100` },
        { label: 'Loyalty', value: `${score.signals.loyaltyStrength}/100` },
      ]
    : []
  const agentEngineLabel = score
    ? score.provider === 'ollama'
      ? `Ollama ${score.model ?? 'local model'}`
      : 'Heuristic fallback'
    : 'Awaiting analysis'
  const requestStages = [
    { label: 'Identity', status: isConnected ? 'Connected' : 'Connect wallet' },
    { label: 'Risk check', status: score ? `${score.score} score ready` : 'Analyze wallet first' },
    { label: 'Merchant', status: selectedMerchant ? selectedMerchantTitle : 'Choose a merchant' },
    { label: 'Profile', status: selectedProfile ? selectedProfile.label : 'Awaiting profile sync' },
    selectedProfile?.requiresCollateral
      ? {
          label: 'Collateral',
          status: requiredCollateralAmount
            ? `${formatNumber(collateralDraftAmount)}/${formatNumber(requiredCollateralAmount)} LEND`
            : 'Set collateral amount',
        }
      : {
          label: 'Collateral',
          status: 'Not required',
        },
    { label: 'Request state', status: latestRequest ? latestRequest.status : 'Awaiting request' },
  ]
  const redeemPreviewLend = Math.floor(Number(redeemPointsAmount || 0) / 100)
  const feeDiscountLabel = rewards ? `${(rewards.interestDiscountBps / 100).toFixed(0)}% APR` : '0%'
  const limitBoostLabel = rewards ? `${(rewards.creditLimitBoostBps / 100).toFixed(0)}% limit` : '0%'

  const identityLabel = username || (initiaAddress ? shortenAddress(initiaAddress) : 'No wallet connected')
  const topbarAiSummary = score
    ? `${score.score} score · ${score.risk} risk`
    : 'Run wallet analysis to generate a live score'
  const topbarNextStep = activeLoan
    ? 'Repay the current installment'
    : latestRequest
      ? `Track request: ${latestRequest.status}`
      : isConnected
        ? 'Analyze wallet and request a loan'
        : 'Connect wallet to begin'
  const topbarModeLabel = isChainWriteReady ? 'Live on-chain' : 'Preview mode'

  return (
    <div className="app-shell">
      <div className="app-backdrop" aria-hidden="true">
        <div className="app-backdrop__orb app-backdrop__orb--one" />
        <div className="app-backdrop__orb app-backdrop__orb--two" />
        <div className="app-backdrop__orb app-backdrop__orb--three" />
        <div className="app-backdrop__mesh" />
        <div className="app-backdrop__scan" />
      </div>
      <Sidebar active={activePage} onChange={setActivePage} />
      <div className="main-shell">
        <Topbar
          aiSummary={topbarAiSummary}
          connected={isConnected}
          identityLabel={identityLabel}
          modeLabel={topbarModeLabel}
          nextStep={topbarNextStep}
          onConnect={openConnect}
          onOpenWallet={openWallet}
        />

        <main className="page">
          <motion.section
            key={activePage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {activePage === 'overview' ? (
              <>
                <div className="page__heading">
                  <div>
                    <h2 className="page__title">Borrower overview</h2>
                    <p className="page__subtitle">
                      The full borrower lifecycle stays visible here: connect, score, request,
                      approve, and repay.
                    </p>
                  </div>
                  <Badge tone={isBackendSyncing ? 'info' : isChainWriteReady ? 'success' : 'warning'}>
                    {isBackendSyncing
                      ? 'Syncing state'
                      : isChainWriteReady
                        ? 'Chain write ready'
                        : 'Preview state'}
                  </Badge>
                </div>

                <div className="overview-hero">
                  <div className="overview-hero__copy">
                    <div className="hero-kicker">AI credit desk</div>
                    <h3 className="overview-hero__title">
                      See what the agent saw before you borrow.
                    </h3>
                    <p className="overview-hero__body">
                      The app explains your score, shows your live limit, tracks your wallet payout,
                      and tells you the next action in plain language.
                    </p>
                    <div className="overview-hero__telemetry">
                      <div className="hero-telemetry">
                        <span>Linked identity</span>
                        <strong>{username ?? 'Not resolved yet'}</strong>
                      </div>
                      <div className="hero-telemetry">
                        <span>APR offered</span>
                        <strong>{score ? `${score.apr}%` : 'Analyze first'}</strong>
                      </div>
                      <div className="hero-telemetry">
                        <span>AI engine</span>
                        <strong>{agentEngineLabel}</strong>
                      </div>
                    </div>
                    <div className="overview-hero__chips">
                      {heroSignals.map((signal) => (
                        <div className="hero-chip" key={signal.label}>
                          <span>{signal.label}</span>
                          <strong>{signal.value}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="overview-hero__actions">
                      <Button onClick={() => setActivePage('request')}>Request checkout credit</Button>
                      <Button variant="secondary" onClick={() => setActivePage('analyze')}>
                        Refresh score view
                      </Button>
                    </div>
                    <div className="overview-hero__note">
                      This screen should tell you what the AI decided, what you can borrow, and what
                      to do next without guessing.
                    </div>
                  </div>

                  <div className="overview-hero__panel">
                    <div className="hero-panel__eyebrow">AI decision snapshot</div>
                    <div className="hero-panel__status">
                      <span className="meta-pill">AI analyst live</span>
                      <span className="meta-pill">On-chain policy</span>
                    </div>
                    <div className="hero-panel__value">{score ? score.score : '--'}</div>
                    <div className="hero-panel__label">
                      {score ? `${score.risk} risk · ${score.apr}% APR` : 'Waiting for live borrower analysis'}
                    </div>
                    <div className="hero-panel__grid">
                      <div>
                        <span>Available limit</span>
                        <strong>{score ? formatCurrency(score.limitUsd) : 'Analyze wallet'}</strong>
                      </div>
                      <div>
                        <span>Wallet balance</span>
                        <strong>{walletNativeBalanceLabel}</strong>
                      </div>
                      <div>
                        <span>Active loan</span>
                        <strong>{activeLoan ? formatCurrency(activeLoan.principal) : 'None'}</strong>
                      </div>
                      <div>
                        <span>Next due</span>
                        <strong>{nextDueItem ? formatDate(nextDueItem.dueAt) : 'N/A'}</strong>
                      </div>
                      <div>
                        <span>Identity</span>
                        <strong>{username ?? 'No username yet'}</strong>
                      </div>
                      <div>
                        <span>Locked collateral</span>
                        <strong>{lockedCollateralLabel}</strong>
                      </div>
                    </div>
                    <div className="hero-panel__foot">
                      {score?.summary ??
                        'The AI will explain the score after the first wallet analysis.'}
                    </div>
                  </div>
                </div>

                <div className="stats-grid">
                  {overviewStats.map((stat) => (
                    <Card key={stat.label} className={`stat-card stat-card--${stat.tone}`}>
                      <div className="stat-card__label">{stat.label}</div>
                      <div className="stat-card__value">{stat.value}</div>
                      <div className="stat-card__foot">{stat.foot}</div>
                    </Card>
                  ))}
                </div>

                <div className="double-grid section-stack">
                  <div className="grid">
                    <IdentityCard
                      address={initiaAddress}
                      autosignAvailable={Boolean(autoSign)}
                      autosignEnabled={autosignEnabledForChain}
                      onToggleAutosign={handleToggleAutosign}
                      points={rewards?.points ?? 0}
                      tier={rewards?.tier ?? 'No tier yet'}
                      username={username}
                    />

                    <Card eyebrow="Current checkout" title={activeLoan ? activeLoan.id : 'No active checkout'} className="loan-focus-card">
                      {activeLoan ? (
                        <>
                          <div className="loan-focus-card__meter">
                            <div className="loan-focus-card__meter-track">
                              <div
                                className="loan-focus-card__meter-fill"
                                style={{ width: `${loanProgressPercent}%` }}
                              />
                            </div>
                            <span>{Math.round(loanProgressPercent)}% settled</span>
                          </div>
                          <div className="summary">
                            <div className="summary-row">
                              <span>Merchant</span>
                              <strong>
                                {activeLoan.merchantCategory
                                  ? formatMerchantCategory(activeLoan.merchantCategory)
                                  : 'General credit'}
                              </strong>
                            </div>
                            <div className="summary-row">
                              <span>Principal</span>
                              <strong>{formatCurrency(activeLoan.principal)}</strong>
                            </div>
                            <div className="summary-row">
                              <span>Installments</span>
                              <strong>
                                {activeLoan.installmentsPaid}/{activeLoan.schedule.length} paid
                              </strong>
                            </div>
                            <div className="summary-row">
                              <span>Next due</span>
                              <strong>
                                {formatDate(nextDueItem?.dueAt ?? activeLoan.schedule[activeLoan.schedule.length - 1].dueAt)}
                              </strong>
                            </div>
                          </div>
                          <div className="card-action-row">
                            <Button onClick={handleRepay} wide variant="secondary" disabled={isRepaying}>
                              {isRepaying ? 'Repaying...' : 'Repay next installment'}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="muted-copy">No approved checkout yet. Submit a merchant checkout request to start.</p>
                      )}
                    </Card>
                  </div>

                  <div className="grid">
                    <Card eyebrow="Score summary" title="How the scoring agent rates this borrower" className="story-card">
                      {score ? (
                        <>
                          <div className="summary">
                            <div className="summary-row">
                              <span>Engine</span>
                              <strong>{agentEngineLabel}</strong>
                            </div>
                            <div className="summary-row">
                              <span>Main identity signal</span>
                              <strong>{score.signals?.username ?? 'Wallet-only identity'}</strong>
                            </div>
                            <div className="summary-row">
                              <span>Why this score</span>
                              <strong>{score.summary ?? 'Agent summary not available.'}</strong>
                            </div>
                          </div>
                          <div className="analysis-signal-grid">
                            {overviewAgentSignals.map((item) => (
                              <div className="analysis-signal" key={item.label}>
                                <span>{item.label}</span>
                                <strong>{item.value}</strong>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="muted-copy">
                          Run wallet analysis first to see the score summary and the main factors behind it.
                        </p>
                      )}
                    </Card>

                    <Card eyebrow="Native Feature" title="Initia Usernames" className="feature-card">
                      <p className="muted-copy">
                        LendPay uses `.init` identity as the main native Initia feature in the
                        borrower-facing flow.
                      </p>
                        <div className="summary">
                          <div className="summary-row">
                            <span>Primary label</span>
                            <strong>{username ?? 'Unverified'}</strong>
                          </div>
                        <div className="summary-row">
                          <span>Fallback address</span>
                          <strong>{shortenAddress(initiaAddress)}</strong>
                        </div>
                        <div className="summary-row">
                          <span>Wallet autosign</span>
                          <strong>{autosignEnabledForChain ? 'Enabled' : 'Optional'}</strong>
                        </div>
                      </div>
                    </Card>
                    <Card eyebrow="Live activity" title="Recent updates">
                      <ActivityFeed items={activities} />
                    </Card>
                  </div>
                </div>
              </>
            ) : null}

            {activePage === 'analyze' ? (
              <>
                <div className="page__heading">
                  <div>
                    <h2 className="page__title">AI credit analysis</h2>
                    <p className="page__subtitle">
                      Score output blends wallet behavior with Connect-normalized pricing for cleaner
                      limit and APR decisions.
                    </p>
                  </div>
                  <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                    {isAnalyzing ? 'Scanning wallet...' : 'Analyze wallet'}
                  </Button>
                </div>

                <div className="double-grid">
                  <Card eyebrow="Score ring" title="Current borrower score" className="analysis-hero">
                    {score ? (
                      <>
                        <ScoreRing score={score.score} subtitle={`${score.risk} risk · APR ${score.apr}%`} />
                        <p className="score-note">
                          Last scanned {formatDate(score.scannedAt)}. Official Connect pricing keeps the
                          backend normalization consistent.
                        </p>
                        <div className="analysis-signal-grid">
                          {analysisSignals.map((item) => (
                            <div className="analysis-signal" key={item.label}>
                              <span>{item.label}</span>
                              <strong>+{item.points}</strong>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="muted-copy">
                        No live score yet. Connect the wallet and run analysis to load real borrower data.
                      </p>
                    )}
                  </Card>

                  <Card eyebrow="Decision summary" title="Approved terms" className="decision-card">
                    <div className="summary">
                      <div className="summary-row">
                        <span>Credit limit</span>
                        <strong>{score ? formatCurrency(score.limitUsd) : 'Not available yet'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Risk band</span>
                        <strong>{score?.risk ?? 'Pending analysis'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Active engine</span>
                        <strong>
                          {score
                            ? score.provider === 'ollama'
                              ? `${score.provider} · ${score.model ?? 'local model'}`
                              : 'heuristic fallback'
                            : 'Analyze wallet first'}
                        </strong>
                      </div>
                      <div className="summary-row">
                        <span>Signal anchor</span>
                        <strong>{score?.signals?.username ?? 'Wallet-only identity'}</strong>
                      </div>
                    </div>
                    <div className="decision-card__band">
                      <div>
                        <span>Agent summary</span>
                        <strong>{score?.summary ?? 'Backend agent has not produced a live summary yet.'}</strong>
                      </div>
                      <div>
                        <span>Underwriting mode</span>
                        <strong>
                          {score?.signals
                            ? `Wallet + identity + repayment + holdings`
                            : 'Connect wallet and analyze to unlock real signals'}
                        </strong>
                      </div>
                    </div>
                  </Card>
                </div>

                <Card eyebrow="Breakdown" title="Why this borrower qualifies" className="grid section-stack">
                  {score ? (
                    <>
                      <div className="analysis-signal-grid">
                        {agentSignals.map((item) => (
                          <div className="analysis-signal" key={item.label}>
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="breakdown">
                        {score.breakdown.map((item) => (
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
                    <p className="muted-copy">Breakdown will appear after the backend agent analyzes this wallet.</p>
                  )}
                </Card>
              </>
            ) : null}

            {activePage === 'request' ? (
              <>
                <div className="page__heading">
                  <div>
                    <h2 className="page__title">Merchant checkout credit</h2>
                    <p className="page__subtitle">
                      Choose a merchant partner, set the checkout amount, and submit on-chain credit
                      for that purchase.
                    </p>
                  </div>
                  <Badge tone="info">{score ? `${formatCurrency(effectiveAvailableLimit)} available` : 'Analyze first'}</Badge>
                </div>

                <div className="double-grid">
                  <Card eyebrow="Checkout request" title="Where will you use this credit?" className="request-form-card">
                    <div className="field-gap-md">
                      <div className="metric-label">Merchant partner</div>
                      {activeMerchants.length ? (
                        <div className="analysis-signal-grid merchant-grid">
                          {activeMerchants.map((merchant) => (
                            <button
                              className={`analysis-signal analysis-signal--button merchant-option ${selectedMerchant?.id === merchant.id ? 'analysis-signal--active' : ''}`}
                              key={merchant.id}
                              onClick={() =>
                                setDraft((current) => ({ ...current, merchantId: merchant.id }))
                              }
                              type="button"
                            >
                              <div className="merchant-option__head">
                                <span className="merchant-option__eyebrow">Partner merchant</span>
                                <span className="merchant-option__status">Checkout ready</span>
                              </div>
                              <strong>{formatMerchantCategory(merchant.category)}</strong>
                              <div className="merchant-option__body">
                                <span>{shortenAddress(merchant.merchantAddress)}</span>
                                <small className="merchant-option__meta">
                                  {(merchant.partnerFeeBps / 100).toFixed(2)}% partner fee · borrower wallet payout
                                </small>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="muted-copy">
                          No active merchant partners are available yet. Register one in Operations to
                          enable checkout credit.
                        </p>
                      )}
                    </div>

                    <div className="field">
                      <label htmlFor="amount">Checkout amount (USD)</label>
                      <input
                        id="amount"
                        value={draft.amount}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, amount: event.target.value }))
                        }
                        placeholder="500"
                        type="number"
                        min="50"
                        max={effectiveAvailableLimit || 0}
                        disabled={!score}
                      />
                    </div>

                    <div className="field-gap-sm">
                      <input
                        className="range-input"
                        type="range"
                        min="50"
                        max={Math.max(100, effectiveAvailableLimit || 0)}
                        step="10"
                        value={Math.min(Number(draft.amount || 50), effectiveAvailableLimit || 100)}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, amount: event.target.value }))
                        }
                        disabled={!score}
                      />
                    </div>

                    <div className="field-gap-md">
                      <div className="metric-label">Credit product</div>
                      {profileQuotes.length ? (
                        <div className="analysis-signal-grid">
                          {profileQuotes.map((profile) => (
                            <button
                              className={`analysis-signal analysis-signal--button ${draft.profileId === profile.profileId ? 'analysis-signal--active' : ''}`}
                              key={profile.profileId}
                              onClick={() =>
                                setDraft((current) => ({ ...current, profileId: profile.profileId }))
                              }
                              type="button"
                            >
                              <span>{profile.label.replace(/_/g, ' ')}</span>
                              <strong>{profile.qualified ? formatCurrency(profile.maxPrincipal) : 'Locked'}</strong>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="muted-copy">Profile quotes will appear after protocol sync.</p>
                      )}
                    </div>

                    <div className="field-gap-md">
                      <div className="metric-label">Tenor</div>
                      <div className="pill-group pill-group--spaced">
                        {[1, 3, 6].map((tenor) => (
                          <button
                            className={`pill ${draft.tenorMonths === tenor ? 'pill--active' : ''}`}
                            key={tenor}
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                tenorMonths: tenor as RequestDraft['tenorMonths'],
                              }))
                            }
                            type="button"
                            disabled={selectedProfile ? tenor > selectedProfile.maxTenorMonths : false}
                          >
                            {tenor} month{tenor > 1 ? 's' : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="request-form-card__meta">
                      <span>Max you can request now</span>
                      <strong>{score ? formatCurrency(effectiveAvailableLimit) : 'Analyze wallet first'}</strong>
                    </div>

                    {selectedProfile?.requiresCollateral ? (
                      <div className="field-gap-md">
                        <div className="field">
                          <label htmlFor="collateralAmount">Collateral to lock (LEND)</label>
                          <input
                            id="collateralAmount"
                            value={draft.collateralAmount}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                collateralAmount: event.target.value,
                              }))
                            }
                            placeholder={String(requiredCollateralAmount || 0)}
                            type="number"
                            min={requiredCollateralAmount || 0}
                            step="1"
                          />
                        </div>
                        <div className="request-form-card__meta">
                          <span>Minimum required collateral</span>
                          <strong>{formatNumber(requiredCollateralAmount)} LEND</strong>
                        </div>
                        <div className="request-form-card__meta">
                          <span>Liquid LEND available</span>
                          <strong>{formatNumber(rewards?.liquidLend ?? 0)} LEND</strong>
                        </div>
                      </div>
                    ) : null}

                    <div className="request-stage-strip">
                      {requestStages.map((stage) => (
                        <div className="request-stage" key={stage.label}>
                          <span>{stage.label}</span>
                          <strong>{stage.status}</strong>
                        </div>
                      ))}
                    </div>

                    <div className="checkout-explainer">
                      <div className="checkout-explainer__item">
                        <span>What happens</span>
                        <strong>LendPay approves the checkout amount, funds your wallet, and you pay the merchant.</strong>
                      </div>
                      <div className="checkout-explainer__item">
                        <span>Why the merchant matters</span>
                        <strong>The selected partner gives this credit a real purchase destination, not a generic cash loan.</strong>
                      </div>
                    </div>

                    <div className="card-action-row">
                      <Button onClick={handleRequestLoan} disabled={isSubmittingRequest || !score || (merchants.length > 0 && !selectedMerchant)} wide>
                        {isSubmittingRequest ? 'Submitting checkout...' : 'Sign and request checkout credit'}
                      </Button>
                    </div>
                  </Card>

                  <Card eyebrow="Checkout summary" title="What this request will do" className="preview-card">
                    <div className="summary">
                      <div className="summary-row">
                        <span>Use of funds</span>
                        <strong>Merchant checkout</strong>
                      </div>
                      <div className="summary-row">
                        <span>Merchant</span>
                        <strong>{selectedMerchantTitle}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Merchant wallet</span>
                        <strong>{selectedMerchantAddress}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Requested amount</span>
                        <strong>{formatCurrency(requestedAmount)}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Selected profile</span>
                        <strong>{selectedProfile ? selectedProfile.label.replace(/_/g, ' ') : 'Awaiting sync'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Tenor</span>
                        <strong>{draft.tenorMonths} months</strong>
                      </div>
                      <div className="summary-row">
                        <span>Wallet balance</span>
                        <strong>{walletNativeBalanceLabel}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Partner fee</span>
                        <strong>{selectedMerchantFeeLabel}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Estimated APR</span>
                        <strong>{score ? `${score.apr}%` : 'Pending analysis'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Est. monthly payment</span>
                        <strong>{formatCurrency(monthlyPaymentPreview)}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Submission method</span>
                        <strong>{isChainWriteReady ? 'On-chain transaction' : 'Chain target not configured'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Profile ceiling</span>
                        <strong>
                          {selectedProfile
                            ? `${formatCurrency(selectedProfile.maxPrincipal)} · ${selectedProfile.maxTenorMonths} months`
                            : 'Awaiting profile sync'}
                        </strong>
                      </div>
                      <div className="summary-row">
                        <span>Collateral requirement</span>
                        <strong>
                          {selectedProfile?.requiresCollateral
                            ? `${formatNumber(requiredCollateralAmount)} LEND minimum`
                            : 'Not required'}
                        </strong>
                      </div>
                      <div className="summary-row">
                        <span>Collateral to lock</span>
                        <strong>
                          {selectedProfile?.requiresCollateral
                            ? `${formatNumber(collateralDraftAmount)} LEND`
                            : '0 LEND'}
                        </strong>
                      </div>
                      <div className="summary-row">
                        <span>Latest request</span>
                        <strong>{latestRequest ? latestRequest.status : 'No request yet'}</strong>
                      </div>
                    </div>
                    <div className="story-card__rail">
                      <span>What approval means</span>
                      <strong>
                        Once approved, the checkout amount is released to your wallet so you can complete payment with the selected merchant partner.
                      </strong>
                    </div>
                    <div className="preview-card__total">
                      <span>Estimated total repayment</span>
                      <strong>{formatCurrency(estimatedTotalRepayment)}</strong>
                    </div>
                  </Card>
                </div>

                <Card eyebrow="Request history" title="Request status" className="grid section-stack queue-card">
                  {requests.length === 0 ? (
                    <p className="muted-copy">No requests yet. Submit one to see pending and approved states.</p>
                  ) : (
                    <div className="request-list">
                      {requests.map((request) => (
                        <div className="request-row" key={request.id}>
                          <div>
                            <div className="request-row__title">{request.id}</div>
                            <div className="muted-copy">
                              {request.merchantCategory
                                ? `${formatMerchantCategory(request.merchantCategory)} · `
                                : ''}
                              {formatCurrency(request.amount)} · {request.tenorMonths} month tenor ·{' '}
                              {formatDate(request.submittedAt)} · {formatNumber(request.collateralAmount)} LEND collateral
                            </div>
                          </div>
                          <div className="schedule__right">
                            <span className="request-row__amount">{formatTxHash(request.txHash)}</span>
                            <Badge tone={request.status === 'approved' ? 'success' : 'warning'}>
                              {request.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </>
            ) : null}

            {activePage === 'loan' ? (
              <>
                <div className="page__heading">
                  <div>
                    <h2 className="page__title">Repayment</h2>
                    <p className="page__subtitle">
                      This page shows where checkout funds went, what must be paid next, and when repayment is due.
                    </p>
                  </div>
                  <Button onClick={handleRepay} disabled={!activeLoan || isRepaying}>
                    {isRepaying ? 'Repaying...' : 'Repay next installment'}
                  </Button>
                </div>

                <Card eyebrow="Repayment guide" title="How checkout credit works" className="section-stack">
                  <div className="summary">
                    <div className="summary-row">
                      <span>Approval</span>
                      <strong>LendPay approves a merchant checkout amount for this wallet</strong>
                    </div>
                    <div className="summary-row">
                      <span>Wallet funding</span>
                      <strong>Loan funds land in your wallet so you can complete the purchase</strong>
                    </div>
                    <div className="summary-row">
                      <span>Merchant payment</span>
                      <strong>You use those funds at the selected merchant partner</strong>
                    </div>
                    <div className="summary-row">
                      <span>Repayment</span>
                      <strong>Pay LendPay back on schedule and unlock stronger future checkout limits</strong>
                    </div>
                  </div>
                </Card>

                <div className="double-grid">
                  <Card eyebrow="Checkout loan" title={activeLoan ? activeLoan.id : 'Awaiting approval'} className="repayment-card">
                    {activeLoan ? (
                      <>
                        <div className="repayment-card__spotlight">
                          <span>Pay this now</span>
                          <strong>{nextDueItem ? formatCurrency(nextDueItem.amount) : 'Complete'}</strong>
                          <small>
                            {nextDueItem
                              ? `Pay before ${formatDate(nextDueItem.dueAt)}`
                              : 'All installments settled'}
                          </small>
                        </div>
                        <div className="summary">
                          <div className="summary-row">
                            <span>Merchant</span>
                            <strong>
                              {activeLoan.merchantCategory
                                ? `${formatMerchantCategory(activeLoan.merchantCategory)} · ${shortenAddress(activeLoan.merchantAddress)}`
                                : 'General credit'}
                            </strong>
                          </div>
                          <div className="summary-row">
                            <span>Principal loan</span>
                            <strong>{formatCurrency(activeLoan.principal)}</strong>
                          </div>
                          <div className="summary-row">
                            <span>APR</span>
                            <strong>{activeLoan.apr}%</strong>
                          </div>
                          <div className="summary-row">
                            <span>Status</span>
                            <strong>{activeLoan.status}</strong>
                          </div>
                          <div className="summary-row">
                            <span>Already paid</span>
                            <strong>{formatCurrency(paidAmount)}</strong>
                          </div>
                          <div className="summary-row">
                            <span>Remaining to pay</span>
                            <strong>{formatCurrency(outstandingAmount)}</strong>
                          </div>
                          <div className="summary-row">
                            <span>Collateral status</span>
                            <strong>
                              {activeLoan.collateralAmount > 0
                                ? `${formatNumber(activeLoan.collateralAmount)} LEND · ${activeLoan.collateralStatus}`
                                : 'No collateral locked'}
                            </strong>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="muted-copy">
                        No approved loan yet. Once the backend confirms approval, the repayment desk will populate from real chain-backed state.
                      </p>
                    )}
                  </Card>

                  <Card eyebrow="Checkout receipt" title="Where the funds go" className="impact-card">
                    <div className="summary">
                      <div className="summary-row">
                        <span>Merchant partner</span>
                        <strong>{checkoutMerchantTitle}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Merchant wallet</span>
                        <strong>{checkoutMerchantWalletLabel}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Checkout amount</span>
                        <strong>{formatCurrency(checkoutFundingAmount)}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Funding state</span>
                        <strong>{checkoutFundingState}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Borrower wallet</span>
                        <strong>{initiaAddress ? shortenAddress(initiaAddress) : 'Connected wallet'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Wallet balance now</span>
                        <strong>{walletNativeBalanceLabel}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Partner fee quote</span>
                        <strong>
                          {checkoutMerchant
                            ? `${(checkoutMerchant.partnerFeeBps / 100).toFixed(2)}% · ${formatCurrency(checkoutPartnerFeeAmount)}`
                            : 'No live quote'}
                        </strong>
                      </div>
                      <div className="summary-row">
                        <span>Next repayment due</span>
                        <strong>{checkoutDueLabel}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Collateral</span>
                        <strong>
                          {activeCollateralAmount > 0
                            ? `${formatNumber(activeCollateralAmount)} LEND · ${activeCollateralStatus}`
                            : 'No collateral locked on the latest borrower flow.'}
                        </strong>
                      </div>
                    </div>
                    <div className="card-action-row">
                      <Button variant="secondary" onClick={openWallet} wide>
                        Open wallet
                      </Button>
                    </div>
                    <div className="impact-card__foot">
                      LendPay does not pay the merchant for you inside this screen. Approval releases the checkout amount to your wallet, then you complete the purchase with the selected merchant and repay LendPay afterward. If the chosen profile is collateralized, locked LEND returns on full repayment and moves into seized collateral on default.
                    </div>
                  </Card>
                </div>

                <div className="double-grid">
                  <Card eyebrow="Fees" title="Outstanding protocol fees" className="story-card">
                    {activeLoan ? (
                      <>
                        <div className="summary">
                          <div className="summary-row">
                            <span>Origination fee due</span>
                            <strong>{loanFees ? formatNumber(loanFees.originationFeeDue) : 'Loading'}</strong>
                          </div>
                          <div className="summary-row">
                            <span>Late fee due</span>
                            <strong>{loanFees ? formatNumber(loanFees.lateFeeDue) : 'Loading'}</strong>
                          </div>
                          <div className="summary-row">
                            <span>Total fees paid</span>
                            <strong>{loanFees ? formatNumber(loanFees.totalFeesPaid) : 'Loading'}</strong>
                          </div>
                          <div className="summary-row">
                            <span>Paid in LEND</span>
                            <strong>{loanFees ? formatNumber(loanFees.totalFeesPaidInLend) : 'Loading'}</strong>
                          </div>
                        </div>
                        <div className="card-action-row">
                          <Button
                            onClick={handlePayFeesInLend}
                            variant="secondary"
                            wide
                            disabled={isProtocolActionPending('pay-fees') || totalFeesDue <= 0}
                          >
                            {isProtocolActionPending('pay-fees') ? 'Paying fees...' : 'Pay fees in LEND'}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="muted-copy">
                        Fee state appears once an active loan exists and the fee engine has assessed dues.
                      </p>
                    )}
                  </Card>

                  <Card eyebrow="Tier benefits" title="Current borrower discounts" className="story-card">
                    <div className="summary">
                      <div className="summary-row">
                        <span>Holder tier</span>
                        <strong>{rewards?.tier ?? 'Pending sync'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>APR discount unlocked</span>
                        <strong>{feeDiscountLabel}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Credit limit boost</span>
                        <strong>{limitBoostLabel}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Premium checks left</span>
                        <strong>{rewards?.premiumChecksAvailable ?? 0}</strong>
                      </div>
                    </div>
                    <div className="story-card__rail">
                      <span>Based on</span>
                      <strong>Points spent, LEND held, and repayment history</strong>
                    </div>
                  </Card>
                </div>

                <Card eyebrow="Schedule" title="Payment timeline" className="grid section-stack">
                  {activeLoan ? (
                    <LoanSchedule schedule={activeLoan.schedule} />
                  ) : (
                    <p className="muted-copy">Repayment schedule will appear after approval.</p>
                  )}
                </Card>
              </>
            ) : null}

            {activePage === 'rewards' ? (
              <>
                <div className="page__heading">
                  <div>
                    <h2 className="page__title">Rewards</h2>
                    <p className="page__subtitle">
                      Points, claimable LEND, staking, and fee discounts all sync from the protocol.
                    </p>
                  </div>
                  <Badge tone="success">{rewards?.tier ?? 'No tier yet'}</Badge>
                </div>

                <div className="grid--2">
                  <Card eyebrow="Rewards summary" title={rewards ? `${formatPoints(rewards.points)} total points` : 'No rewards synced yet'} className="rewards-card">
                    <div className="rewards-card__hero">
                      <span>Current tier</span>
                      <strong>{rewards?.tier ?? 'Pending sync'}</strong>
                      <small>
                        {rewards ? `${rewards.streak} payment streak · ${rewards.heldLend} total LEND` : 'Rewards appear after sync'}
                      </small>
                    </div>
                    <div className="summary">
                      <div className="summary-row">
                        <span>Liquid LEND</span>
                        <strong>{rewards ? formatNumber(rewards.liquidLend) : '0'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Claimable LEND</span>
                        <strong>{rewards ? formatNumber(rewards.claimableLend) : '0'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Staked LEND</span>
                        <strong>{rewards ? formatNumber(rewards.stakedLend) : '0'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Claimable staking rewards</span>
                        <strong>{rewards ? formatNumber(rewards.claimableStakingRewards) : '0'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Borrower badges</span>
                        <strong>{rewards ? rewards.badgeCount : 0}</strong>
                      </div>
                    </div>
                    <div className="card-action-row">
                      <Button
                        onClick={handleClaimLend}
                        disabled={!rewards?.claimableLend || isProtocolActionPending('claim-lend')}
                      >
                        {isProtocolActionPending('claim-lend') ? 'Claiming...' : 'Claim LEND'}
                      </Button>
                      <Button
                        onClick={handleClaimStakingRewards}
                        variant="secondary"
                        disabled={!rewards?.claimableStakingRewards || isProtocolActionPending('claim-staking')}
                      >
                        {isProtocolActionPending('claim-staking') ? 'Claiming...' : 'Claim staking rewards'}
                      </Button>
                    </div>
                  </Card>

                  <Card eyebrow="Borrower benefits" title="Current borrower perks" className="story-card">
                    <div className="summary">
                      <div className="summary-row">
                        <span>APR discount unlocked</span>
                        <strong>{feeDiscountLabel}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Credit limit boost</span>
                        <strong>{limitBoostLabel}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Premium checks available</span>
                        <strong>{rewards?.premiumChecksAvailable ?? 0}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Linked identity</span>
                        <strong>{username ?? 'Unverified'}</strong>
                      </div>
                    </div>
                    <div className="story-card__rail">
                      <span>Based on</span>
                      <strong>Points spent, holder tier, and repayment streak</strong>
                    </div>
                  </Card>
                </div>

                <div className="grid--2">
                  <Card eyebrow="Stake LEND" title="Earn staking rewards" className="story-card">
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
                  </Card>

                  <Card eyebrow="Points to LEND" title="Convert reputation into token utility" className="story-card">
                    <div className="summary">
                      <div className="summary-row">
                        <span>Conversion rule</span>
                        <strong>{REDEEM_POINTS_BASE} pts = {REDEEM_LEND_OUTPUT} LEND</strong>
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
                        {isProtocolActionPending('redeem-points') ? 'Redeeming...' : 'Convert to claimable LEND'}
                      </Button>
                    </div>
                  </Card>
                </div>

                <div className="grid--2">
                  <Card eyebrow="Point utility" title="Spend points for borrower advantages" className="story-card">
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
                        disabled={isProtocolActionPending('limit-boost') || (rewards?.points ?? 0) < LIMIT_BOOST_COST}
                      >
                        {isProtocolActionPending('limit-boost') ? 'Buying...' : 'Buy limit boost'}
                      </Button>
                      <Button
                        onClick={handleUnlockPremiumCheck}
                        variant="secondary"
                        disabled={isProtocolActionPending('premium-check') || (rewards?.points ?? 0) < PREMIUM_CHECK_COST}
                      >
                        {isProtocolActionPending('premium-check') ? 'Unlocking...' : 'Unlock premium check'}
                      </Button>
                    </div>
                    <div className="card-action-row">
                      <Button
                        onClick={handleRedeemBadge}
                        variant="secondary"
                        disabled={isProtocolActionPending('badge') || (rewards?.points ?? 0) < BADGE_COST}
                      >
                        {isProtocolActionPending('badge') ? 'Redeeming...' : 'Redeem badge'}
                      </Button>
                    </div>
                  </Card>

                  <Card eyebrow="APR discount" title="Spend points for lower borrowing cost" className="story-card">
                    <div className="summary">
                      <div className="summary-row">
                        <span>Live APR discount</span>
                        <strong>{feeDiscountLabel}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Discount points cost</span>
                        <strong>
                          {Number(interestDiscountPercent || 0) * INTEREST_DISCOUNT_COST_PER_PERCENT} points
                        </strong>
                      </div>
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
                    </div>
                  </Card>
                </div>

                <Card eyebrow="Campaigns" title="Airdrop and incentive windows" className="grid section-stack">
                  {campaigns.length ? (
                    <div className="request-list">
                      {campaigns.map((campaign) => (
                        <div className="request-row" key={campaign.id}>
                          <div>
                            <div className="request-row__title">Campaign #{campaign.id}</div>
                            <div className="muted-copy">
                              Phase {campaign.phase} · {campaign.status} · allocation {formatNumber(campaign.totalAllocation)} · claimed {formatNumber(campaign.totalClaimed)}
                            </div>
                            <div className="muted-copy">
                              {campaign.requiresUsername ? 'Requires .init username' : 'Username optional'} · minimum actions {campaign.minimumPlatformActions}
                            </div>
                          </div>
                          <div className="schedule__right">
                            <span className="request-row__amount">{formatNumber(campaign.claimableAmount)} claimable</span>
                            <Button
                              variant="secondary"
                              onClick={() => handleClaimCampaign(campaign.id)}
                              disabled={!campaign.canClaim || isProtocolActionPending(`campaign-${campaign.id}`)}
                            >
                              {isProtocolActionPending(`campaign-${campaign.id}`) ? 'Claiming...' : 'Claim'}
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => handleCloseCampaign(campaign.id)}
                              disabled={campaign.status !== 'open' || isProtocolActionPending(`campaign-close-${campaign.id}`)}
                            >
                              {isProtocolActionPending(`campaign-close-${campaign.id}`) ? 'Closing...' : 'Close'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted-copy">
                      Campaign inventory will appear here once incentive phases are created onchain.
                    </p>
                  )}
                </Card>
              </>
            ) : null}

            {activePage === 'admin' ? (
              <>
                <div className="page__heading">
                  <div>
                    <h2 className="page__title">Operations</h2>
                    <p className="page__subtitle">
                      Governance, merchant rails, and protocol inventory live here as the operator-facing view.
                    </p>
                  </div>
                  <Badge tone="warning">Protocol</Badge>
                </div>

                <div className="grid--2">
                  <Card eyebrow="Current mode" title="Operator controls" className="admin-card">
                    <div className="admin-card__banner">
                      This page now mirrors protocol state instead of acting like a placeholder console.
                    </div>
                    <div className="summary">
                      <div className="summary-row">
                        <span>Borrower automation</span>
                        <strong>{appEnv.enableDemoApproval ? 'Backend-assisted demo flow' : 'Manual approval only'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Governance proposals</span>
                        <strong>{governance.length}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Campaigns</span>
                        <strong>{campaigns.length}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Merchants</span>
                        <strong>{merchants.length}</strong>
                      </div>
                    </div>
                  </Card>

                  <Card eyebrow="Chain write" title="Move package status" className="admin-card">
                    <div className="summary">
                      <div className="summary-row">
                        <span>Package address</span>
                        <strong>{appEnv.packageAddress || 'Not set'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Loan module</span>
                        <strong>{appEnv.loanModuleName}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Transaction mode</span>
                        <strong>{isChainWriteReady ? 'Live transaction' : 'Chain target not configured'}</strong>
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="grid--2">
                  <Card eyebrow="Governance" title="Create a new proposal" className="story-card">
                    <div className="field">
                      <label htmlFor="proposalType">Proposal type</label>
                      <input
                        id="proposalType"
                        type="number"
                        min="1"
                        value={governanceDraft.proposalType}
                        onChange={(event) =>
                          setGovernanceDraft((current) => ({ ...current, proposalType: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="proposalTitle">Title</label>
                      <input
                        id="proposalTitle"
                        value={governanceDraft.title}
                        onChange={(event) =>
                          setGovernanceDraft((current) => ({ ...current, title: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="proposalBody">Body</label>
                      <input
                        id="proposalBody"
                        value={governanceDraft.body}
                        onChange={(event) =>
                          setGovernanceDraft((current) => ({ ...current, body: event.target.value }))
                        }
                      />
                    </div>
                    <div className="card-action-row">
                      <Button
                        onClick={handleProposeGovernance}
                        disabled={isProtocolActionPending('governance-propose')}
                      >
                        {isProtocolActionPending('governance-propose') ? 'Submitting...' : 'Submit proposal'}
                      </Button>
                    </div>
                  </Card>

                  <Card eyebrow="Campaign ops" title="Create and allocate campaign rewards" className="story-card">
                    <div className="field">
                      <label htmlFor="campaignPhase">Phase</label>
                      <input
                        id="campaignPhase"
                        type="number"
                        min="1"
                        value={campaignDraft.phase}
                        onChange={(event) =>
                          setCampaignDraft((current) => ({ ...current, phase: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="campaignAllocation">Total allocation</label>
                      <input
                        id="campaignAllocation"
                        type="number"
                        min="1"
                        value={campaignDraft.totalAllocation}
                        onChange={(event) =>
                          setCampaignDraft((current) => ({ ...current, totalAllocation: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="campaignMinimumActions">Minimum platform actions</label>
                      <input
                        id="campaignMinimumActions"
                        type="number"
                        min="0"
                        value={campaignDraft.minimumPlatformActions}
                        onChange={(event) =>
                          setCampaignDraft((current) => ({
                            ...current,
                            minimumPlatformActions: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="card-action-row">
                      <Button
                        onClick={handleCreateCampaign}
                        disabled={isProtocolActionPending('campaign-create')}
                      >
                        {isProtocolActionPending('campaign-create') ? 'Creating...' : 'Create campaign'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setCampaignDraft((current) => ({
                            ...current,
                            requiresUsername: !current.requiresUsername,
                          }))
                        }
                      >
                        {campaignDraft.requiresUsername ? 'Username required' : 'Username optional'}
                      </Button>
                    </div>
                    <div className="field">
                      <label htmlFor="allocationCampaignId">Campaign id</label>
                      <input
                        id="allocationCampaignId"
                        type="number"
                        min="1"
                        value={allocationDraft.campaignId}
                        onChange={(event) =>
                          setAllocationDraft((current) => ({ ...current, campaignId: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="allocationUserAddress">Recipient address</label>
                      <input
                        id="allocationUserAddress"
                        value={allocationDraft.userAddress}
                        onChange={(event) =>
                          setAllocationDraft((current) => ({ ...current, userAddress: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="allocationAmount">Allocation amount</label>
                      <input
                        id="allocationAmount"
                        type="number"
                        min="1"
                        value={allocationDraft.amount}
                        onChange={(event) =>
                          setAllocationDraft((current) => ({ ...current, amount: event.target.value }))
                        }
                      />
                    </div>
                    <div className="card-action-row">
                      <Button
                        onClick={handleAllocateCampaign}
                        disabled={isProtocolActionPending('campaign-allocate')}
                      >
                        {isProtocolActionPending('campaign-allocate') ? 'Allocating...' : 'Allocate claim'}
                      </Button>
                    </div>
                  </Card>
                </div>

                <div className="grid--2">
                  <Card eyebrow="Merchant rail" title="Registered merchant partners" className="story-card">
                    <div className="field">
                      <label htmlFor="merchantAddress">Merchant address</label>
                      <input
                        id="merchantAddress"
                        value={merchantDraft.merchantAddress}
                        onChange={(event) =>
                          setMerchantDraft((current) => ({ ...current, merchantAddress: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="merchantCategory">Category</label>
                      <input
                        id="merchantCategory"
                        value={merchantDraft.category}
                        onChange={(event) =>
                          setMerchantDraft((current) => ({ ...current, category: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="merchantListingFee">Listing fee bps</label>
                      <input
                        id="merchantListingFee"
                        type="number"
                        min="0"
                        value={merchantDraft.listingFeeBps}
                        onChange={(event) =>
                          setMerchantDraft((current) => ({ ...current, listingFeeBps: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="merchantPartnerFee">Partner fee bps</label>
                      <input
                        id="merchantPartnerFee"
                        type="number"
                        min="0"
                        value={merchantDraft.partnerFeeBps}
                        onChange={(event) =>
                          setMerchantDraft((current) => ({ ...current, partnerFeeBps: event.target.value }))
                        }
                      />
                    </div>
                    <div className="card-action-row">
                      <Button
                        onClick={handleRegisterMerchant}
                        disabled={isProtocolActionPending('merchant-create')}
                      >
                        {isProtocolActionPending('merchant-create') ? 'Registering...' : 'Register merchant'}
                      </Button>
                    </div>
                    {merchants.length ? (
                      <div className="merchant-partner-grid">
                        {merchants.map((merchant) => (
                          <div className="merchant-partner-card" key={merchant.id}>
                            <div className="merchant-partner-card__head">
                              <div>
                                <span className="merchant-partner-card__eyebrow">Merchant #{merchant.id}</span>
                                <div className="request-row__title">{formatMerchantCategory(merchant.category)}</div>
                              </div>
                              <Badge tone={merchant.active ? 'success' : 'warning'}>
                                {merchant.active ? 'active' : 'inactive'}
                              </Badge>
                            </div>
                            <div className="summary merchant-partner-card__summary">
                              <div className="summary-row">
                                <span>Wallet</span>
                                <strong>{shortenAddress(merchant.merchantAddress)}</strong>
                              </div>
                              <div className="summary-row">
                                <span>Partner fee</span>
                                <strong>{merchant.partnerFeeBps / 100}%</strong>
                              </div>
                              <div className="summary-row">
                                <span>Live quote</span>
                                <strong>{formatNumber(merchant.partnerFeeQuote)}</strong>
                              </div>
                              <div className="summary-row">
                                <span>Checkout role</span>
                                <strong>Destination for borrower wallet payouts</strong>
                              </div>
                            </div>
                            <div className="merchant-partner-card__foot">
                              <Button
                                variant="secondary"
                                onClick={() => handleSetMerchantActive(merchant.id, !merchant.active)}
                                disabled={isProtocolActionPending(`merchant-active-${merchant.id}-${merchant.active ? 'off' : 'on'}`)}
                              >
                                {isProtocolActionPending(`merchant-active-${merchant.id}-${merchant.active ? 'off' : 'on'}`)
                                  ? 'Updating...'
                                  : merchant.active
                                    ? 'Deactivate'
                                    : 'Activate'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted-copy">
                        No merchant partners are registered onchain yet.
                      </p>
                    )}
                  </Card>
                </div>

                <Card eyebrow="Governance ledger" title="Open and historical proposals" className="grid section-stack">
                  {governance.length ? (
                    <div className="request-list">
                      {governance.map((proposal) => (
                        <div className="request-row" key={proposal.id}>
                          <div>
                            <div className="request-row__title">{proposal.titleHash}</div>
                            <div className="muted-copy">
                              Type {proposal.proposalType} · yes {formatNumber(proposal.yesVotes)} · no {formatNumber(proposal.noVotes)}
                            </div>
                            <div className="muted-copy">
                              Ends {formatDate(proposal.endsAt)} · proposer {shortenAddress(proposal.proposer)}
                            </div>
                          </div>
                          <div className="schedule__right">
                            <Badge tone={proposal.status === 'passed' ? 'success' : proposal.status === 'rejected' ? 'danger' : 'info'}>
                              {proposal.status}
                            </Badge>
                            <div className="card-action-row">
                              <Button
                                variant="secondary"
                                onClick={() => handleVoteGovernance(proposal.id, true)}
                                disabled={proposal.status !== 'open' || proposal.hasVoted || isProtocolActionPending(`vote-${proposal.id}-yes`)}
                              >
                                {isProtocolActionPending(`vote-${proposal.id}-yes`) ? 'Voting...' : 'Vote yes'}
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => handleVoteGovernance(proposal.id, false)}
                                disabled={proposal.status !== 'open' || proposal.hasVoted || isProtocolActionPending(`vote-${proposal.id}-no`)}
                              >
                                {isProtocolActionPending(`vote-${proposal.id}-no`) ? 'Voting...' : 'Vote no'}
                              </Button>
                              <Button
                                onClick={() => handleFinalizeProposal(proposal.id)}
                                disabled={proposal.status !== 'open' || isProtocolActionPending(`finalize-${proposal.id}`)}
                              >
                                {isProtocolActionPending(`finalize-${proposal.id}`) ? 'Finalizing...' : 'Finalize'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted-copy">Governance proposals will appear here after the first submission.</p>
                  )}
                </Card>
              </>
            ) : null}
          </motion.section>
        </main>

        <MobileNav active={activePage} onChange={setActivePage} />

        {toast ? (
          <div className={`toast toast--${toast.tone}`}>
            <div className="toast__title">{toast.title}</div>
            <div className="toast__message">{toast.message}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default App
