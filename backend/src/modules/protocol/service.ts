import type { RollupClient } from '../../integrations/rollup/client.js'
import type {
  CampaignState,
  CreditProfileQuote,
  GovernanceProposalState,
  MerchantState,
} from '../../types/domain.js'
import type { UserService } from '../users/service.js'

export class ProtocolService {
  constructor(
    private rollupClient: RollupClient,
    private userService: UserService,
  ) {}

  async listProfiles(initiaAddress: string): Promise<CreditProfileQuote[]> {
    await this.userService.ensureUser(initiaAddress)
    return this.rollupClient.listProfileQuotes(initiaAddress)
  }

  async listCampaigns(initiaAddress: string): Promise<CampaignState[]> {
    await this.userService.ensureUser(initiaAddress)
    return this.rollupClient.listCampaigns(initiaAddress)
  }

  async listGovernance(initiaAddress: string): Promise<GovernanceProposalState[]> {
    await this.userService.ensureUser(initiaAddress)
    return this.rollupClient.listGovernanceProposals(initiaAddress)
  }

  async listMerchants(initiaAddress: string): Promise<MerchantState[]> {
    await this.userService.ensureUser(initiaAddress)
    return this.rollupClient.listMerchants()
  }

  async createCampaign(input: {
    phase: number
    totalAllocation: number
    requiresUsername: boolean
    minimumPlatformActions: number
  }) {
    return this.rollupClient.createCampaign(input)
  }

  async allocateCampaign(input: { campaignId: number; userAddress: string; amount: number }) {
    return this.rollupClient.allocateCampaign(input)
  }

  async closeCampaign(input: { campaignId: number }) {
    return this.rollupClient.closeCampaign(input)
  }

  async proposeGovernance(input: { proposalType: number; title: string; body: string }) {
    return this.rollupClient.proposeGovernance(input)
  }

  async voteGovernance(input: { proposalId: number; support: boolean }) {
    return this.rollupClient.voteGovernance(input)
  }

  async finalizeGovernance(input: { proposalId: number }) {
    return this.rollupClient.finalizeGovernance(input)
  }

  async registerMerchant(input: {
    merchantAddress: string
    category: string
    listingFeeBps: number
    partnerFeeBps: number
  }) {
    return this.rollupClient.registerMerchant(input)
  }

  async setMerchantActive(input: { merchantId: number; active: boolean }) {
    return this.rollupClient.setMerchantActive(input)
  }
}
