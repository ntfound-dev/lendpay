import { AccAddress, MnemonicKey, MsgExecute, RESTClient, bcs, isTxError } from '@initia/initia.js'
import { execFile } from 'node:child_process'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import { env } from '../../config/env.js'
import type {
  CampaignState,
  CreditProfileQuote,
  GovernanceProposalState,
  LoanFeeState,
  MerchantState,
  OnchainLoanSnapshot,
  OnchainRequestSnapshot,
  OnchainRewardsSnapshot,
  RewardTier,
  TreasuryState,
} from '../../types/domain.js'

const REQUEST_SEARCH_DEPTH = 20
const LOAN_SEARCH_DEPTH = 20
const execFileAsync = promisify(execFile)

type RewardAccountView = {
  points: string
  points_spent: string
  lifetime_points: string
  claimable_lend: string
  claimed_lend: string
  current_streak: string
  credit_limit_boost_bps: string
  interest_discount_bps: string
  premium_checks_available: string
  badge_count: string
  last_rewarded_at: string
}

type ReputationEntryView = {
  username_hash: string
  username_verified: boolean
}

type LoanRequestView = {
  id: string
  profile_id: number
  borrower: string
  amount: string
  collateral_amount: string
  tenor_months: number
  created_at: string
  status: number
}

type LoanView = {
  id: string
  request_id: string
  profile_id: number
  borrower: string
  amount: string
  collateral_amount: string
  collateral_state: number
  apr_bps: string
  tenor_months: number
  installment_amount: string
  installments_total: string
  installments_paid: string
  issued_at: string
  next_due_at: string
  grace_period_seconds: string
  total_repaid: string
  status: number
}

type FeeStateView = {
  loan_id: string
  borrower: string
  origination_fee_due: string
  late_fee_due: string
  total_fees_paid: string
  total_fees_paid_in_lend: string
}

type ProfileView = {
  profile_id: number
  label_hash: string | number[]
  max_principal_hint: string
  max_tenor_months: number
  min_lend_holdings: string
  requires_collateral: boolean
  revolving: boolean
  collateral_ratio_bps: string
}

type ProfileQuoteView = {
  profile_id: number
  qualified: boolean
  max_principal: string
  max_tenor_months: number
  requires_collateral: boolean
  revolving: boolean
  collateral_ratio_bps: string
  min_lend_holdings: string
  current_lend_holdings: string
  tier_limit_multiplier_bps: string
  credit_limit_boost_bps: string
}

type CampaignView = {
  id: string
  phase: number
  total_allocation: string
  total_claimed: string
  requires_username: boolean
  minimum_platform_actions: string
  status: number
}

type ProposalView = {
  id: string
  proposer: string
  proposal_type: number
  title_hash: string | number[]
  body_hash: string | number[]
  created_at: string
  ends_at: string
  yes_votes: string
  no_votes: string
  status: number
}

type MerchantView = {
  id: string
  merchant_address: string
  category_hash: string | number[]
  listing_fee_bps: string
  partner_fee_bps: string
  active: boolean
}

const toNumber = (value: string | number) => Number(value)
const CAMPAIGN_OPEN = 0
const PROPOSAL_OPEN = 0
const PROPOSAL_PASSED = 1
const PROPOSAL_REJECTED = 2
const tierFromCode = (tierCode: number): RewardTier => {
  if (tierCode >= 4) return 'Diamond'
  if (tierCode >= 3) return 'Gold'
  if (tierCode >= 2) return 'Silver'
  return 'Bronze'
}

const decodeBytesToUtf8 = (value: string | number[] | undefined | null): string | undefined => {
  if (!value) return undefined

  try {
    if (Array.isArray(value)) {
      return Buffer.from(value).toString('utf8')
    }

    const normalized = value.startsWith('0x') ? value.slice(2) : value
    return Buffer.from(normalized, 'hex').toString('utf8')
  } catch {
    return undefined
  }
}

export class RollupClient {
  private rest = new RESTClient(env.ROLLUP_REST_URL, {
    chainId: env.ROLLUP_CHAIN_ID,
    gasAdjustment: String(env.ROLLUP_GAS_ADJUSTMENT),
    gasPrices: env.ROLLUP_GAS_PRICES,
  })

  mode(): 'preview' | 'live' {
    return this.canBroadcast() ? 'live' : 'preview'
  }

  canRead(): boolean {
    return Boolean(env.LENDPAY_PACKAGE_ADDRESS)
  }

  canBroadcast(): boolean {
    return Boolean(
      env.ENABLE_LIVE_ROLLUP_WRITES &&
        env.LENDPAY_PACKAGE_ADDRESS &&
        (env.ROLLUP_OPERATOR_MNEMONIC?.trim() || this.canCliBroadcast()),
    )
  }

  private canCliBroadcast(): boolean {
    return Boolean(
      env.MINITIAD_BIN?.trim() &&
        env.ROLLUP_HOME?.trim() &&
        env.ROLLUP_KEY_NAME?.trim() &&
        env.LENDPAY_PACKAGE_ADDRESS,
    )
  }

  treasuryState(): TreasuryState {
    return {
      mode: this.mode(),
      packageAddress: env.LENDPAY_PACKAGE_ADDRESS,
      canBroadcast: this.canBroadcast(),
      nativeDenom: env.ROLLUP_NATIVE_DENOM,
      nativeSymbol: env.ROLLUP_NATIVE_SYMBOL,
    }
  }

  previewTxHash(prefix: string) {
    return `0x${prefix}${Date.now().toString(16)}`
  }

  addressToHex(address: string) {
    return AccAddress.toHex(address)
  }

  private encodeBytes(value: string) {
    const bytes = Array.from(new TextEncoder().encode(value))
    return bcs.vector(bcs.u8()).serialize(bytes).toBase64()
  }

  private encodeVectorU8Arg(value: string) {
    const bytes = Array.from(new TextEncoder().encode(value))
    return `vector<u8>:${bytes.join(',')}`
  }

  private encodeAddress(value: string) {
    return bcs.address().serialize(this.addressToHex(value)).toBase64()
  }

  async syncRewards(initiaAddress: string): Promise<OnchainRewardsSnapshot | null> {
    if (!this.canRead() || !env.LENDPAY_PACKAGE_ADDRESS) {
      return null
    }

    const addressHex = this.addressToHex(initiaAddress)
    const [rewardAccount, heldLend, liquidLend, stakedLend, claimableStakingRewards, reputationEntry] = await Promise.all([
      this.viewJson<RewardAccountView>('rewards', 'get_account', [
        bcs.address().serialize(addressHex).toBase64(),
      ]),
      this.viewScalarNumber('lend_token', 'total_balance_of', [
        bcs.address().serialize(addressHex).toBase64(),
      ]),
      this.viewScalarNumber('lend_token', 'balance_of', [
        bcs.address().serialize(addressHex).toBase64(),
      ]).catch(() => 0),
      this.viewScalarNumber('lend_token', 'staked_balance_of', [
        bcs.address().serialize(addressHex).toBase64(),
      ]).catch(() => 0),
      this.viewScalarNumber('staking', 'quote_claimable', [
        bcs.address().serialize(addressHex).toBase64(),
      ]).catch(() => 0),
      this.viewJson<ReputationEntryView>('reputation', 'get_entry', [
        bcs.address().serialize(addressHex).toBase64(),
      ]).catch(() => null),
    ])
    const tierCode = await this.viewScalarNumber('tokenomics', 'tier_for_lend_balance', [
      bcs.u64().serialize(heldLend).toBase64(),
    ]).catch(() => 0)

    const derivedTierCode =
      heldLend >= 10000 ? 4 : heldLend >= 2000 ? 3 : heldLend >= 500 ? 2 : heldLend >= 100 ? 1 : 0

    return {
      points: toNumber(rewardAccount.points),
      streak: toNumber(rewardAccount.current_streak),
      heldLend,
      liquidLend,
      stakedLend,
      claimableLend: toNumber(rewardAccount.claimable_lend),
      claimableStakingRewards,
      creditLimitBoostBps: toNumber(rewardAccount.credit_limit_boost_bps),
      interestDiscountBps: toNumber(rewardAccount.interest_discount_bps),
      premiumChecksAvailable: toNumber(rewardAccount.premium_checks_available),
      badgeCount: toNumber(rewardAccount.badge_count),
      tier: tierFromCode(tierCode || derivedTierCode),
      username:
        reputationEntry?.username_verified && reputationEntry.username_hash
          ? decodeBytesToUtf8(reputationEntry.username_hash)
          : undefined,
    }
  }

  async getFeeState(loanId: number): Promise<LoanFeeState | null> {
    if (!this.canRead()) return null

    const feeState = await this.viewJson<FeeStateView>('fee_engine', 'get_fee_state', [
      bcs.u64().serialize(loanId).toBase64(),
    ]).catch(() => null)

    if (!feeState) {
      return null
    }

    return {
      loanId: String(toNumber(feeState.loan_id)),
      borrower: feeState.borrower,
      originationFeeDue: toNumber(feeState.origination_fee_due),
      lateFeeDue: toNumber(feeState.late_fee_due),
      totalFeesPaid: toNumber(feeState.total_fees_paid),
      totalFeesPaidInLend: toNumber(feeState.total_fees_paid_in_lend),
    }
  }

  async listProfileQuotes(initiaAddress: string): Promise<CreditProfileQuote[]> {
    if (!this.canRead()) return []

    const addressHex = this.addressToHex(initiaAddress)
    const profileCount = await this.viewScalarNumber('profiles', 'profile_count').catch(() => 0)
    const profiles = await Promise.all(
      Array.from({ length: profileCount }, (_, index) => index + 1).map(async (profileId) => {
        const [profile, quote] = await Promise.all([
          this.viewJson<ProfileView>('profiles', 'get_profile', [
            bcs.u8().serialize(profileId).toBase64(),
          ]),
          this.viewJson<ProfileQuoteView>('profiles', 'quote_profile', [
            bcs.address().serialize(addressHex).toBase64(),
            bcs.u8().serialize(profileId).toBase64(),
          ]),
        ])

        return {
          profileId: profile.profile_id,
          label: decodeBytesToUtf8(profile.label_hash) ?? `profile_${profile.profile_id}`,
          qualified: quote.qualified,
          maxPrincipal: toNumber(quote.max_principal),
          maxTenorMonths: quote.max_tenor_months,
          requiresCollateral: quote.requires_collateral,
          revolving: quote.revolving,
          collateralRatioBps: toNumber(quote.collateral_ratio_bps),
          minLendHoldings: toNumber(quote.min_lend_holdings),
          currentLendHoldings: toNumber(quote.current_lend_holdings),
          tierLimitMultiplierBps: toNumber(quote.tier_limit_multiplier_bps),
          creditLimitBoostBps: toNumber(quote.credit_limit_boost_bps),
        } satisfies CreditProfileQuote
      }),
    )

    return profiles.sort((left, right) => left.profileId - right.profileId)
  }

  async listCampaigns(initiaAddress: string): Promise<CampaignState[]> {
    if (!this.canRead()) return []

    const addressHex = this.addressToHex(initiaAddress)
    const nextCampaignId = await this.viewScalarNumber('campaigns', 'next_campaign_id').catch(() => 1)
    const campaignIds = Array.from({ length: Math.max(0, nextCampaignId - 1) }, (_, index) => index + 1)

    const campaigns = await Promise.all(
      campaignIds.map(async (campaignId) => {
        const [campaign, claimableAmount, canClaim] = await Promise.all([
          this.viewJson<CampaignView>('campaigns', 'get_campaign', [
            bcs.u64().serialize(campaignId).toBase64(),
          ]),
          this.viewScalarNumber('campaigns', 'claimable_amount', [
            bcs.u64().serialize(campaignId).toBase64(),
            bcs.address().serialize(addressHex).toBase64(),
          ]).catch(() => 0),
          this.viewBoolean('campaigns', 'can_claim', [
            bcs.address().serialize(addressHex).toBase64(),
            bcs.u64().serialize(campaignId).toBase64(),
          ]).catch(() => false),
        ])

        return {
          id: String(toNumber(campaign.id)),
          phase: campaign.phase,
          totalAllocation: toNumber(campaign.total_allocation),
          totalClaimed: toNumber(campaign.total_claimed),
          requiresUsername: campaign.requires_username,
          minimumPlatformActions: toNumber(campaign.minimum_platform_actions),
          status: campaign.status === CAMPAIGN_OPEN ? 'open' : 'closed',
          claimableAmount,
          canClaim,
        } satisfies CampaignState
      }),
    )

    return campaigns.sort((left, right) => Number(right.id) - Number(left.id))
  }

  async listGovernanceProposals(initiaAddress: string): Promise<GovernanceProposalState[]> {
    if (!this.canRead()) return []

    const addressHex = this.addressToHex(initiaAddress)
    const nextProposalId = await this.viewScalarNumber('governance', 'next_proposal_id').catch(() => 1)
    const proposalIds = Array.from({ length: Math.max(0, nextProposalId - 1) }, (_, index) => index + 1)

    const proposals = await Promise.all(
      proposalIds.map(async (proposalId) => {
        const [proposal, hasVoted] = await Promise.all([
          this.viewJson<ProposalView>('governance', 'get_proposal', [
            bcs.u64().serialize(proposalId).toBase64(),
          ]),
          this.viewBoolean('governance', 'has_user_voted', [
            bcs.address().serialize(addressHex).toBase64(),
            bcs.u64().serialize(proposalId).toBase64(),
          ]).catch(() => false),
        ])

        return {
          id: String(toNumber(proposal.id)),
          proposer: proposal.proposer,
          proposalType: proposal.proposal_type,
          titleHash: decodeBytesToUtf8(proposal.title_hash) ?? String(proposal.title_hash),
          bodyHash: decodeBytesToUtf8(proposal.body_hash) ?? String(proposal.body_hash),
          createdAt: new Date(toNumber(proposal.created_at) * 1000).toISOString(),
          endsAt: new Date(toNumber(proposal.ends_at) * 1000).toISOString(),
          yesVotes: toNumber(proposal.yes_votes),
          noVotes: toNumber(proposal.no_votes),
          status:
            proposal.status === PROPOSAL_PASSED
              ? 'passed'
              : proposal.status === PROPOSAL_REJECTED
                ? 'rejected'
                : 'open',
          hasVoted,
        } satisfies GovernanceProposalState
      }),
    )

    return proposals.sort((left, right) => Number(right.id) - Number(left.id))
  }

  async listMerchants(orderAmountHint = 1_000): Promise<MerchantState[]> {
    if (!this.canRead()) return []

    const nextMerchantId = await this.viewScalarNumber('merchant_registry', 'next_merchant_id').catch(() => 1)
    const merchantIds = Array.from({ length: Math.max(0, nextMerchantId - 1) }, (_, index) => index + 1)

    const merchants = await Promise.all(
      merchantIds.map(async (merchantId) => {
        const [merchant, partnerFeeQuote] = await Promise.all([
          this.viewJson<MerchantView>('merchant_registry', 'get_merchant', [
            bcs.u64().serialize(merchantId).toBase64(),
          ]),
          this.viewScalarNumber('merchant_registry', 'quote_partner_fee', [
            bcs.u64().serialize(merchantId).toBase64(),
            bcs.u64().serialize(orderAmountHint).toBase64(),
          ]).catch(() => 0),
        ])

        return {
          id: String(toNumber(merchant.id)),
          merchantAddress: merchant.merchant_address,
          category: decodeBytesToUtf8(merchant.category_hash) ?? String(merchant.category_hash),
          listingFeeBps: toNumber(merchant.listing_fee_bps),
          partnerFeeBps: toNumber(merchant.partner_fee_bps),
          active: merchant.active,
          partnerFeeQuote,
        } satisfies MerchantState
      }),
    )

    return merchants.sort((left, right) => Number(right.id) - Number(left.id))
  }

  async findLatestMatchingRequest(input: {
    borrowerAddress: string
    amount: number
    collateralAmount?: number
    tenorMonths: number
    profileId?: number
  }): Promise<OnchainRequestSnapshot | null> {
    if (!this.canRead()) return null

    const borrowerHex = this.addressToHex(input.borrowerAddress).toLowerCase()
    const nextRequestId = await this.viewScalarNumber('loan_book', 'next_request_id')
    const minRequestId = Math.max(1, nextRequestId - REQUEST_SEARCH_DEPTH)

    for (let requestId = nextRequestId - 1; requestId >= minRequestId; requestId -= 1) {
      const request = await this.getRequestById(requestId).catch(() => null)

      if (!request) continue
      if (request.borrowerHex.toLowerCase() !== borrowerHex) continue
      if (request.amount !== input.amount) continue
      if ((input.collateralAmount ?? 0) !== request.collateralAmount) continue
      if (request.tenorMonths !== input.tenorMonths) continue
      if (typeof input.profileId === 'number' && request.profileId !== input.profileId) continue

      return request
    }

    return null
  }

  async getRequestById(requestId: number): Promise<OnchainRequestSnapshot> {
    const request = await this.viewJson<LoanRequestView>('loan_book', 'get_request', [
      bcs.u64().serialize(requestId).toBase64(),
    ])

    return {
      id: toNumber(request.id),
      profileId: request.profile_id,
      borrowerHex: request.borrower,
      amount: toNumber(request.amount),
      collateralAmount: toNumber(request.collateral_amount),
      tenorMonths: request.tenor_months,
      createdAtSeconds: toNumber(request.created_at),
      status: request.status,
    }
  }

  async findLatestLoanByRequestId(requestId: number): Promise<OnchainLoanSnapshot | null> {
    if (!this.canRead()) return null

    const nextLoanId = await this.viewScalarNumber('loan_book', 'next_loan_id')
    const minLoanId = Math.max(1, nextLoanId - LOAN_SEARCH_DEPTH)

    for (let loanId = nextLoanId - 1; loanId >= minLoanId; loanId -= 1) {
      const loan = await this.getLoanById(loanId).catch(() => null)
      if (loan?.requestId === requestId) {
        return loan
      }
    }

    return null
  }

  async getLoanById(loanId: number): Promise<OnchainLoanSnapshot> {
    const loan = await this.viewJson<LoanView>('loan_book', 'get_loan', [
      bcs.u64().serialize(loanId).toBase64(),
    ])

    return {
      id: toNumber(loan.id),
      requestId: toNumber(loan.request_id),
      profileId: loan.profile_id,
      borrowerHex: loan.borrower,
      amount: toNumber(loan.amount),
      collateralAmount: toNumber(loan.collateral_amount),
      collateralState: loan.collateral_state,
      aprBps: toNumber(loan.apr_bps),
      tenorMonths: loan.tenor_months,
      installmentAmount: toNumber(loan.installment_amount),
      installmentsTotal: toNumber(loan.installments_total),
      installmentsPaid: toNumber(loan.installments_paid),
      issuedAtSeconds: toNumber(loan.issued_at),
      nextDueAtSeconds: toNumber(loan.next_due_at),
      gracePeriodSeconds: toNumber(loan.grace_period_seconds),
      totalRepaid: toNumber(loan.total_repaid),
      status: loan.status,
    }
  }

  async getWalletSnapshot(initiaAddress: string) {
    const nativeBalance = await this.getNativeBalance(initiaAddress).catch(() => 0)
    const lockedCollateralLend = this.canRead()
      ? await this.viewScalarNumber('loan_book', 'locked_collateral_of', [
          bcs.address().serialize(this.addressToHex(initiaAddress)).toBase64(),
        ]).catch(() => 0)
      : 0

    return {
      nativeBalance,
      lockedCollateralLend,
    }
  }

  async getProfileQuote(initiaAddress: string, profileId: number): Promise<CreditProfileQuote | null> {
    if (!this.canRead()) return null

    const addressHex = this.addressToHex(initiaAddress)
    const [profile, quote] = await Promise.all([
      this.viewJson<ProfileView>('profiles', 'get_profile', [
        bcs.u8().serialize(profileId).toBase64(),
      ]),
      this.viewJson<ProfileQuoteView>('profiles', 'quote_profile', [
        bcs.address().serialize(addressHex).toBase64(),
        bcs.u8().serialize(profileId).toBase64(),
      ]),
    ]).catch(() => [null, null] as const)

    if (!profile || !quote) {
      return null
    }

    return {
      profileId: profile.profile_id,
      label: decodeBytesToUtf8(profile.label_hash) ?? `profile_${profile.profile_id}`,
      qualified: quote.qualified,
      maxPrincipal: toNumber(quote.max_principal),
      maxTenorMonths: quote.max_tenor_months,
      requiresCollateral: quote.requires_collateral,
      revolving: quote.revolving,
      collateralRatioBps: toNumber(quote.collateral_ratio_bps),
      minLendHoldings: toNumber(quote.min_lend_holdings),
      currentLendHoldings: toNumber(quote.current_lend_holdings),
      tierLimitMultiplierBps: toNumber(quote.tier_limit_multiplier_bps),
      creditLimitBoostBps: toNumber(quote.credit_limit_boost_bps),
    }
  }

  async waitForTx(txHash: string, timeoutMs = 20_000) {
    const start = Date.now()

    while (Date.now() - start < timeoutMs) {
      try {
        await this.rest.tx.txInfo(txHash)
        return
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    throw new Error(`Timed out waiting for tx ${txHash}.`)
  }

  private async getNativeBalance(initiaAddress: string) {
    const url = new URL(
      `/cosmos/bank/v1beta1/balances/${initiaAddress}/by_denom`,
      env.ROLLUP_REST_URL,
    )
    url.searchParams.set('denom', env.ROLLUP_NATIVE_DENOM)

    const response = await fetch(url.toString())
    if (!response.ok) {
      if (response.status === 404) return 0
      throw new Error(`Balance query failed with ${response.status}`)
    }

    const payload = (await response.json()) as { balance?: { amount?: string } }
    return Number(payload.balance?.amount ?? 0)
  }

  async approveRequest(input: {
    requestId: number
    aprBps: number
    installmentAmount: number
    installmentsTotal: number
    gracePeriodSeconds: number
  }) {
    if (!this.canBroadcast() || !env.LENDPAY_PACKAGE_ADDRESS) {
      return {
        live: false,
        txHash: this.previewTxHash('approve'),
      }
    }

    if (!env.ROLLUP_OPERATOR_MNEMONIC && this.canCliBroadcast()) {
      const txHash = await this.executeCliTx({
        moduleName: env.LOAN_MODULE_NAME,
        functionName: env.APPROVE_FUNCTION_NAME,
        typedArgs: [
          `u64:${input.requestId}`,
          `u64:${input.aprBps}`,
          `u64:${input.installmentAmount}`,
          `u64:${input.installmentsTotal}`,
          `u64:${input.gracePeriodSeconds}`,
        ],
        memo: `Approve request ${input.requestId}`,
      })

      return {
        live: true,
        txHash,
      }
    }

    const key = new MnemonicKey({ mnemonic: env.ROLLUP_OPERATOR_MNEMONIC })
    const wallet = this.rest.wallet(key)

    const msg = new MsgExecute(
      key.accAddress,
      env.LENDPAY_PACKAGE_ADDRESS,
      env.LOAN_MODULE_NAME,
      env.APPROVE_FUNCTION_NAME,
      [],
      [
        bcs.u64().serialize(input.requestId).toBase64(),
        bcs.u64().serialize(input.aprBps).toBase64(),
        bcs.u64().serialize(input.installmentAmount).toBase64(),
        bcs.u64().serialize(input.installmentsTotal).toBase64(),
        bcs.u64().serialize(input.gracePeriodSeconds).toBase64(),
      ],
    )

    const tx = await wallet.createAndSignTx({
      msgs: [msg],
      memo: `Approve request ${input.requestId}`,
      feeDenoms: [env.ROLLUP_NATIVE_DENOM],
      gasAdjustment: env.ROLLUP_GAS_ADJUSTMENT,
    })

    const broadcast = await this.rest.tx.broadcastSync(tx)
    if (isTxError(broadcast)) {
      throw new Error(
        `Rollup approval failed with code ${String(broadcast.code)}: ${broadcast.raw_log || 'unknown error'}`,
      )
    }
    await this.waitForTx(broadcast.txhash)

    return {
      live: true,
      txHash: broadcast.txhash,
    }
  }

  async createCampaign(input: {
    phase: number
    totalAllocation: number
    requiresUsername: boolean
    minimumPlatformActions: number
  }) {
    return this.executeOperatorTx({
      prefix: 'campaign-create',
      moduleName: 'campaigns',
      functionName: 'create_campaign',
      args: [
        bcs.u8().serialize(input.phase).toBase64(),
        bcs.u64().serialize(input.totalAllocation).toBase64(),
        bcs.bool().serialize(input.requiresUsername).toBase64(),
        bcs.u64().serialize(input.minimumPlatformActions).toBase64(),
      ],
      cliArgs: [
        `u8:${input.phase}`,
        `u64:${input.totalAllocation}`,
        `bool:${input.requiresUsername ? 'true' : 'false'}`,
        `u64:${input.minimumPlatformActions}`,
      ],
      memo: `Create campaign phase ${input.phase}`,
    })
  }

  async allocateCampaign(input: { campaignId: number; userAddress: string; amount: number }) {
    return this.executeOperatorTx({
      prefix: 'campaign-alloc',
      moduleName: 'campaigns',
      functionName: 'allocate_claim',
      args: [
        bcs.u64().serialize(input.campaignId).toBase64(),
        this.encodeAddress(input.userAddress),
        bcs.u64().serialize(input.amount).toBase64(),
      ],
      cliArgs: [
        `u64:${input.campaignId}`,
        `address:${this.addressToHex(input.userAddress)}`,
        `u64:${input.amount}`,
      ],
      memo: `Allocate campaign ${input.campaignId}`,
    })
  }

  async closeCampaign(input: { campaignId: number }) {
    return this.executeOperatorTx({
      prefix: 'campaign-close',
      moduleName: 'campaigns',
      functionName: 'close_campaign',
      args: [bcs.u64().serialize(input.campaignId).toBase64()],
      cliArgs: [`u64:${input.campaignId}`],
      memo: `Close campaign ${input.campaignId}`,
    })
  }

  async registerMerchant(input: {
    merchantAddress: string
    category: string
    listingFeeBps: number
    partnerFeeBps: number
  }) {
    return this.executeOperatorTx({
      prefix: 'merchant-create',
      moduleName: 'merchant_registry',
      functionName: 'register_merchant',
      args: [
        this.encodeAddress(input.merchantAddress),
        this.encodeBytes(input.category),
        bcs.u64().serialize(input.listingFeeBps).toBase64(),
        bcs.u64().serialize(input.partnerFeeBps).toBase64(),
      ],
      cliArgs: [
        `address:${this.addressToHex(input.merchantAddress)}`,
        this.encodeVectorU8Arg(input.category),
        `u64:${input.listingFeeBps}`,
        `u64:${input.partnerFeeBps}`,
      ],
      memo: `Register merchant ${input.merchantAddress}`,
    })
  }

  async setMerchantActive(input: { merchantId: number; active: boolean }) {
    return this.executeOperatorTx({
      prefix: 'merchant-active',
      moduleName: 'merchant_registry',
      functionName: 'set_active',
      args: [
        bcs.u64().serialize(input.merchantId).toBase64(),
        bcs.bool().serialize(input.active).toBase64(),
      ],
      cliArgs: [
        `u64:${input.merchantId}`,
        `bool:${input.active ? 'true' : 'false'}`,
      ],
      memo: `Merchant ${input.merchantId} active=${input.active ? 'true' : 'false'}`,
    })
  }

  async proposeGovernance(input: { proposalType: number; title: string; body: string }) {
    return this.executeOperatorTx({
      prefix: 'governance-propose',
      moduleName: 'governance',
      functionName: 'propose',
      args: [
        bcs.u8().serialize(input.proposalType).toBase64(),
        this.encodeBytes(input.title),
        this.encodeBytes(input.body),
      ],
      cliArgs: [
        `u8:${input.proposalType}`,
        this.encodeVectorU8Arg(input.title),
        this.encodeVectorU8Arg(input.body),
      ],
      memo: `Governance propose ${input.proposalType}`,
    })
  }

  async voteGovernance(input: { proposalId: number; support: boolean }) {
    return this.executeOperatorTx({
      prefix: 'governance-vote',
      moduleName: 'governance',
      functionName: 'vote',
      args: [
        bcs.u64().serialize(input.proposalId).toBase64(),
        bcs.bool().serialize(input.support).toBase64(),
      ],
      cliArgs: [
        `u64:${input.proposalId}`,
        `bool:${input.support ? 'true' : 'false'}`,
      ],
      memo: `Governance vote ${input.proposalId}`,
    })
  }

  async finalizeGovernance(input: { proposalId: number }) {
    return this.executeOperatorTx({
      prefix: 'governance-finalize',
      moduleName: 'governance',
      functionName: 'finalize',
      args: [bcs.u64().serialize(input.proposalId).toBase64()],
      cliArgs: [`u64:${input.proposalId}`],
      memo: `Governance finalize ${input.proposalId}`,
    })
  }

  private async executeOperatorTx(input: {
    prefix: string
    moduleName: string
    functionName: string
    args: string[]
    cliArgs?: string[]
    memo?: string
  }) {
    if (!this.canBroadcast() || !env.LENDPAY_PACKAGE_ADDRESS) {
      return {
        live: false,
        txHash: this.previewTxHash(input.prefix),
      }
    }

    if (!env.ROLLUP_OPERATOR_MNEMONIC && this.canCliBroadcast() && input.cliArgs?.length) {
      const txHash = await this.executeCliTx({
        moduleName: input.moduleName,
        functionName: input.functionName,
        typedArgs: input.cliArgs,
        memo: input.memo,
      })

      return {
        live: true,
        txHash,
      }
    }

    if (!env.ROLLUP_OPERATOR_MNEMONIC) {
      return {
        live: false,
        txHash: this.previewTxHash(input.prefix),
      }
    }

    const key = new MnemonicKey({ mnemonic: env.ROLLUP_OPERATOR_MNEMONIC })
    const wallet = this.rest.wallet(key)

    const msg = new MsgExecute(
      key.accAddress,
      env.LENDPAY_PACKAGE_ADDRESS,
      input.moduleName,
      input.functionName,
      [],
      input.args,
    )

    const tx = await wallet.createAndSignTx({
      msgs: [msg],
      memo: input.memo ?? `${input.moduleName}.${input.functionName}`,
      feeDenoms: [env.ROLLUP_NATIVE_DENOM],
      gasAdjustment: env.ROLLUP_GAS_ADJUSTMENT,
    })

    const broadcast = await this.rest.tx.broadcastSync(tx)
    if (isTxError(broadcast)) {
      throw new Error(
        `Rollup tx failed with code ${String(broadcast.code)}: ${broadcast.raw_log || 'unknown error'}`,
      )
    }
    await this.waitForTx(broadcast.txhash)

    return {
      live: true,
      txHash: broadcast.txhash,
    }
  }

  private async executeCliTx(input: {
    moduleName: string
    functionName: string
    typedArgs: string[]
    memo?: string
  }) {
    if (!env.MINITIAD_BIN || !env.ROLLUP_HOME || !env.LENDPAY_PACKAGE_ADDRESS) {
      throw new Error('CLI signer is not configured for live rollup writes.')
    }

    const binDir = dirname(env.MINITIAD_BIN)
    const childEnv = {
      ...process.env,
      LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH
        ? `${binDir}:${process.env.LD_LIBRARY_PATH}`
        : binDir,
    }

    const args = [
      '--home',
      env.ROLLUP_HOME,
      'tx',
      'move',
      'execute',
      env.LENDPAY_PACKAGE_ADDRESS,
      input.moduleName,
      input.functionName,
      '--args',
      JSON.stringify(input.typedArgs),
      '--from',
      env.ROLLUP_KEY_NAME,
      '--keyring-backend',
      env.ROLLUP_KEYRING_BACKEND,
      '--node',
      env.ROLLUP_RPC_URL,
      '--chain-id',
      env.ROLLUP_CHAIN_ID,
      '--gas',
      'auto',
      '--gas-adjustment',
      String(env.ROLLUP_GAS_ADJUSTMENT),
      '--gas-prices',
      env.ROLLUP_GAS_PRICES,
      '--yes',
      '--output',
      'json',
    ]

    if (input.memo) {
      args.push('--note', input.memo)
    }

    const { stdout, stderr } = await execFileAsync(env.MINITIAD_BIN, args, {
      env: childEnv,
      maxBuffer: 1024 * 1024 * 8,
    })

    const payloadText = stdout.trim() || stderr.trim()
    const payload = JSON.parse(payloadText) as {
      code?: number
      raw_log?: string
      txhash?: string
    }

    if ((payload.code ?? 0) !== 0 || !payload.txhash) {
      throw new Error(
        `Rollup CLI tx failed with code ${String(payload.code ?? 'unknown')}: ${payload.raw_log || 'unknown error'}`,
      )
    }

    await this.waitForTx(payload.txhash)
    return payload.txhash
  }

  private async viewJson<T>(moduleName: string, functionName: string, args: string[] = []) {
    if (!env.LENDPAY_PACKAGE_ADDRESS) {
      throw new Error('LENDPAY package address is not configured.')
    }

    const response = await this.rest.move.view(
      env.LENDPAY_PACKAGE_ADDRESS,
      moduleName,
      functionName,
      [],
      args,
    )

    return JSON.parse(response.data) as T
  }

  private async viewScalarNumber(moduleName: string, functionName: string, args: string[] = []) {
    if (!env.LENDPAY_PACKAGE_ADDRESS) {
      throw new Error('LENDPAY package address is not configured.')
    }

    const response = await this.rest.move.view(
      env.LENDPAY_PACKAGE_ADDRESS,
      moduleName,
      functionName,
      [],
      args,
    )

    return toNumber(JSON.parse(response.data))
  }

  private async viewBoolean(moduleName: string, functionName: string, args: string[] = []) {
    if (!env.LENDPAY_PACKAGE_ADDRESS) {
      throw new Error('LENDPAY package address is not configured.')
    }

    const response = await this.rest.move.view(
      env.LENDPAY_PACKAGE_ADDRESS,
      moduleName,
      functionName,
      [],
      args,
    )

    return Boolean(JSON.parse(response.data))
  }
}
