import { appEnv } from '../config/env'
import type { AminoSignResponse } from '@cosmjs/amino'
import type { PersonalSignChallengeResponse } from './auth'
import type {
  ActivityItem,
  AuthResponse,
  CampaignState,
  CreditProfileQuote,
  CreditScoreState,
  FaucetState,
  GovernanceProposalState,
  LendLiquidityRouteState,
  LoanFeeState,
  LoanRequestState,
  LoanState,
  MerchantState,
  LeaderboardState,
  RewardsState,
  ReferralState,
  TxExplorerState,
  UserProfile,
  ViralDropItemState,
  ViralDropPurchaseState,
} from '../types/domain'

type JsonBody = Record<string, unknown> | undefined
const API_REQUEST_TIMEOUT_MS = 15_000
const API_GET_RETRY_COUNT = 2

export type DemoLoanReviewResponse = {
  mode: 'preview' | 'live'
  txHash: string
  loan: LoanState
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const buildUrl = (path: string) => `${appEnv.apiBaseUrl.replace(/\/$/, '')}${path}`

const parseJsonObject = (text: string) => {
  if (!text.trim()) {
    return {}
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

const isRetryableRequestError = (error: unknown) =>
  error instanceof Error && (error.name === 'AbortError' || error instanceof TypeError)

const request = async <T>(
  path: string,
  options: {
    body?: JsonBody
    headers?: Record<string, string>
    method?: 'GET' | 'POST'
    signal?: AbortSignal
    token?: string
  } = {},
): Promise<T> => {
  const method = options.method ?? 'GET'
  const retryBudget = method === 'GET' ? API_GET_RETRY_COUNT : 0

  for (let attempt = 0; attempt <= retryBudget; attempt += 1) {
    const controller = new AbortController()
    let didTimeout = false
    const timeoutId = setTimeout(() => {
      didTimeout = true
      controller.abort()
    }, API_REQUEST_TIMEOUT_MS)
    const abortFromUpstream = () => controller.abort()

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort()
      } else {
        options.signal.addEventListener('abort', abortFromUpstream, { once: true })
      }
    }

    try {
      const response = await fetch(buildUrl(path), {
        method,
        signal: controller.signal,
        headers: {
          ...(options.body ? { 'content-type': 'application/json' } : {}),
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      })

      const text = await response.text()
      const data = parseJsonObject(text)

      if (!response.ok) {
        throw new ApiError(
          typeof data.message === 'string' ? data.message : 'Backend request failed.',
          response.status,
          typeof data.code === 'string' ? data.code : undefined,
        )
      }

      return data as T
    } catch (error) {
      const abortedByUpstream = !didTimeout && Boolean(options.signal?.aborted)

      if (attempt < retryBudget && isRetryableRequestError(error) && !abortedByUpstream) {
        continue
      }

      if (error instanceof Error && error.name === 'AbortError') {
        if (abortedByUpstream) {
          throw error
        }

        throw new Error('Request timed out. Please retry.')
      }

      throw error
    } finally {
      options.signal?.removeEventListener('abort', abortFromUpstream)
      clearTimeout(timeoutId)
    }
  }

  throw new Error('Backend request failed.')
}

export const lendpayApi = {
  getChallenge(address: string, signal?: AbortSignal) {
    return request<{ challengeId: string; message: string; expiresAt: string }>(
      '/api/v1/auth/challenge',
      {
        method: 'POST',
        body: { address },
        signal,
      },
    )
  },

  verifySession(
    address: string,
    challengeId: string,
    signResponse: AminoSignResponse | PersonalSignChallengeResponse,
    signal?: AbortSignal,
  ) {
    const body =
      'signed' in signResponse
        ? {
            address,
            challengeId,
            mode: 'amino' as const,
            signed: signResponse.signed,
            signature: signResponse.signature,
          }
        : {
            address,
            challengeId,
            mode: signResponse.mode,
            message: signResponse.message,
            signature: signResponse.signature,
          }

    return request<AuthResponse>('/api/v1/auth/verify', {
      method: 'POST',
      body,
      signal,
    })
  },

  getMe(token: string, signal?: AbortSignal) {
    return request<UserProfile>('/api/v1/me', { signal, token })
  },

  refreshUsername(token: string) {
    return request<UserProfile>('/api/v1/me/username/refresh', {
      method: 'POST',
      token,
      body: {},
    })
  },

  syncRewards(token: string, txHash?: string) {
    return request<RewardsState>('/api/v1/me/rewards/sync', {
      method: 'POST',
      token,
      body: txHash ? { txHash } : {},
    })
  },

  getActivity(token: string, signal?: AbortSignal) {
    return request<ActivityItem[]>('/api/v1/me/activity', { signal, token })
  },

  getFaucet(token: string, signal?: AbortSignal) {
    return request<FaucetState>('/api/v1/me/faucet', { signal, token })
  },

  claimFaucet(token: string) {
    return request<FaucetState>('/api/v1/me/faucet/claim', {
      method: 'POST',
      token,
      body: {},
    })
  },

  getReferral(token: string, signal?: AbortSignal) {
    return request<ReferralState>('/api/v1/me/referral', { signal, token })
  },

  applyReferralCode(token: string, code: string) {
    return request<ReferralState>('/api/v1/me/referral/apply', {
      method: 'POST',
      token,
      body: { code },
    })
  },

  getLeaderboard(token: string, signal?: AbortSignal) {
    return request<LeaderboardState>('/api/v1/leaderboard', { signal, token })
  },

  getScore(token: string, signal?: AbortSignal) {
    return request<CreditScoreState>('/api/v1/score', { signal, token })
  },

  analyzeScore(token: string) {
    return request<CreditScoreState>('/api/v1/score/analyze', {
      method: 'POST',
      token,
      body: {},
    })
  },

  listLoanRequests(token: string, signal?: AbortSignal) {
    return request<LoanRequestState[]>('/api/v1/loan-requests', { signal, token })
  },

  createLoanRequest(
    token: string,
    payload: {
      amount: number
      collateralAmount?: number
      merchantId?: string
      tenorMonths: number
      profileId?: number
      txHash?: string
    },
  ) {
    return request<LoanRequestState>('/api/v1/loan-requests', {
      method: 'POST',
      token,
      body: payload,
    })
  },

  reviewLoanRequest(
    token: string,
    requestId: string,
    reason?: string,
  ): Promise<DemoLoanReviewResponse> {
    return request<DemoLoanReviewResponse>(`/api/v1/loan-requests/${requestId}/review-demo`, {
      method: 'POST',
      token,
      body: reason ? { reason } : {},
    })
  },

  listLoans(token: string, signal?: AbortSignal) {
    return request<LoanState[]>('/api/v1/loans', { signal, token })
  },

  getLoanFees(token: string, loanId: string, signal?: AbortSignal) {
    return request<LoanFeeState | null>(`/api/v1/loans/${loanId}/fees`, { signal, token })
  },

  listProtocolProfiles(token: string, signal?: AbortSignal) {
    return request<CreditProfileQuote[]>('/api/v1/protocol/profiles', { signal, token })
  },

  listCampaigns(token: string, signal?: AbortSignal) {
    return request<CampaignState[]>('/api/v1/protocol/campaigns', { signal, token })
  },

  listGovernance(token: string, signal?: AbortSignal) {
    return request<GovernanceProposalState[]>('/api/v1/protocol/governance', { signal, token })
  },

  listMerchants(token: string, signal?: AbortSignal) {
    return request<MerchantState[]>('/api/v1/protocol/merchants', { signal, token })
  },

  getProtocolTx(token: string, txHash: string) {
    return request<TxExplorerState | null>(`/api/v1/protocol/tx/${txHash}`, { token })
  },

  listViralDropItems(token: string, signal?: AbortSignal) {
    return request<ViralDropItemState[]>('/api/v1/protocol/viral-drop/items', { signal, token })
  },

  listViralDropPurchases(token: string, signal?: AbortSignal) {
    return request<ViralDropPurchaseState[]>('/api/v1/protocol/viral-drop/purchases', { signal, token })
  },

  getLendLiquidityRoute(token: string, signal?: AbortSignal) {
    return request<LendLiquidityRouteState>('/api/v1/protocol/liquidity/lend', { signal, token })
  },

  createCampaign(payload: {
    operatorToken: string
    phase: number
    totalAllocation: number
    requiresUsername: boolean
    minimumPlatformActions: number
  }) {
    return request<{ mode: 'preview' | 'live'; txHash: string }>('/api/v1/protocol/campaigns', {
      method: 'POST',
      body: {
        phase: payload.phase,
        totalAllocation: payload.totalAllocation,
        requiresUsername: payload.requiresUsername,
        minimumPlatformActions: payload.minimumPlatformActions,
      },
      headers: { 'x-operator-token': payload.operatorToken },
    })
  },

  allocateCampaign(payload: {
    operatorToken: string
    campaignId: string
    userAddress: string
    amount: number
  }) {
    return request<{ mode: 'preview' | 'live'; txHash: string }>(
      `/api/v1/protocol/campaigns/${payload.campaignId}/allocations`,
      {
        method: 'POST',
        body: { userAddress: payload.userAddress, amount: payload.amount },
        headers: { 'x-operator-token': payload.operatorToken },
      },
    )
  },

  closeCampaign(payload: { operatorToken: string; campaignId: string }) {
    return request<{ mode: 'preview' | 'live'; txHash: string }>(
      `/api/v1/protocol/campaigns/${payload.campaignId}/close`,
      {
        method: 'POST',
        body: {},
        headers: { 'x-operator-token': payload.operatorToken },
      },
    )
  },

  proposeGovernance(payload: {
    operatorToken: string
    proposalType: number
    title: string
    body: string
  }) {
    return request<{ mode: 'preview' | 'live'; txHash: string }>(
      '/api/v1/protocol/governance/proposals',
      {
        method: 'POST',
        body: { proposalType: payload.proposalType, title: payload.title, body: payload.body },
        headers: { 'x-operator-token': payload.operatorToken },
      },
    )
  },

  voteGovernance(payload: {
    operatorToken: string
    proposalId: string
    support: boolean
  }) {
    return request<{ mode: 'preview' | 'live'; txHash: string }>(
      `/api/v1/protocol/governance/${payload.proposalId}/vote`,
      {
        method: 'POST',
        body: { support: payload.support },
        headers: { 'x-operator-token': payload.operatorToken },
      },
    )
  },

  finalizeGovernance(payload: { operatorToken: string; proposalId: string }) {
    return request<{ mode: 'preview' | 'live'; txHash: string }>(
      `/api/v1/protocol/governance/${payload.proposalId}/finalize`,
      {
        method: 'POST',
        body: {},
        headers: { 'x-operator-token': payload.operatorToken },
      },
    )
  },

  registerMerchant(payload: {
    operatorToken: string
    merchantAddress: string
    category: string
    listingFeeBps: number
    partnerFeeBps: number
  }) {
    return request<{ mode: 'preview' | 'live'; txHash: string }>('/api/v1/protocol/merchants', {
      method: 'POST',
      body: {
        merchantAddress: payload.merchantAddress,
        category: payload.category,
        listingFeeBps: payload.listingFeeBps,
        partnerFeeBps: payload.partnerFeeBps,
      },
      headers: { 'x-operator-token': payload.operatorToken },
    })
  },

  setMerchantActive(payload: { operatorToken: string; merchantId: string; active: boolean }) {
    return request<{ mode: 'preview' | 'live'; txHash: string }>(
      `/api/v1/protocol/merchants/${payload.merchantId}/active`,
      {
        method: 'POST',
        body: { active: payload.active },
        headers: { 'x-operator-token': payload.operatorToken },
      },
    )
  },

  repayLoan(token: string, loanId: string, txHash?: string) {
    return request<{ loan: LoanState; txHash: string; mode: 'preview' | 'live' }>(
      `/api/v1/loans/${loanId}/repay`,
      {
        method: 'POST',
        token,
        body: txHash ? { txHash } : {},
      },
    )
  },
}
