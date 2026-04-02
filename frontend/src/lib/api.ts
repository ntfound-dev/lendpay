import { appEnv } from '../config/env'
import type { AminoSignResponse } from '@cosmjs/amino'
import type {
  ActivityItem,
  AuthResponse,
  CampaignState,
  CreditProfileQuote,
  CreditScoreState,
  GovernanceProposalState,
  LoanFeeState,
  LoanRequestState,
  LoanState,
  MerchantState,
  RewardsState,
  UserProfile,
} from '../types/domain'

type JsonBody = Record<string, unknown> | undefined

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

const request = async <T>(
  path: string,
  options: {
    body?: JsonBody
    headers?: Record<string, string>
    method?: 'GET' | 'POST'
    token?: string
  } = {},
): Promise<T> => {
  const response = await fetch(buildUrl(path), {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const text = await response.text()
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {}

  if (!response.ok) {
    throw new ApiError(
      typeof data.message === 'string' ? data.message : 'Backend request failed.',
      response.status,
      typeof data.code === 'string' ? data.code : undefined,
    )
  }

  return data as T
}

export const lendpayApi = {
  getChallenge(address: string) {
    return request<{ challengeId: string; message: string; expiresAt: string }>(
      '/api/v1/auth/challenge',
      {
        method: 'POST',
        body: { address },
      },
    )
  },

  verifySession(address: string, challengeId: string, signResponse: AminoSignResponse) {
    return request<AuthResponse>('/api/v1/auth/verify', {
      method: 'POST',
      body: {
        address,
        challengeId,
        signed: signResponse.signed,
        signature: signResponse.signature,
      },
    })
  },

  getMe(token: string) {
    return request<UserProfile>('/api/v1/me', { token })
  },

  syncRewards(token: string, txHash?: string) {
    return request<RewardsState>('/api/v1/me/rewards/sync', {
      method: 'POST',
      token,
      body: txHash ? { txHash } : {},
    })
  },

  getActivity(token: string) {
    return request<ActivityItem[]>('/api/v1/me/activity', { token })
  },

  getScore(token: string) {
    return request<CreditScoreState>('/api/v1/score', { token })
  },

  analyzeScore(token: string) {
    return request<CreditScoreState>('/api/v1/score/analyze', {
      method: 'POST',
      token,
      body: {},
    })
  },

  listLoanRequests(token: string) {
    return request<LoanRequestState[]>('/api/v1/loan-requests', { token })
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

  approveLoanRequest(
    requestId: string,
    payload: { operatorToken: string; reason?: string },
  ) {
    return request<{ mode: 'preview' | 'live'; txHash: string; loan: LoanState }>(
      `/api/v1/loan-requests/${requestId}/approve`,
      {
        method: 'POST',
        body: { reason: payload.reason },
        headers: { 'x-operator-token': payload.operatorToken },
      },
    )
  },

  listLoans(token: string) {
    return request<LoanState[]>('/api/v1/loans', { token })
  },

  getLoanFees(token: string, loanId: string) {
    return request<LoanFeeState | null>(`/api/v1/loans/${loanId}/fees`, { token })
  },

  listProtocolProfiles(token: string) {
    return request<CreditProfileQuote[]>('/api/v1/protocol/profiles', { token })
  },

  listCampaigns(token: string) {
    return request<CampaignState[]>('/api/v1/protocol/campaigns', { token })
  },

  listGovernance(token: string) {
    return request<GovernanceProposalState[]>('/api/v1/protocol/governance', { token })
  },

  listMerchants(token: string) {
    return request<MerchantState[]>('/api/v1/protocol/merchants', { token })
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
