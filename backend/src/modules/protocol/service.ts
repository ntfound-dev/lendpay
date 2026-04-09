import type { ConnectOracleClient } from '../../integrations/connect/oracle.js'
import type { MiniEvmClient } from '../../integrations/minievm/client.js'
import type { RollupClient } from '../../integrations/rollup/client.js'
import type {
  CampaignState,
  CreditProfileQuote,
  GovernanceProposalState,
  LendLiquidityRouteState,
  MerchantState,
  TxExplorerState,
  ViralDropItemState,
  ViralDropPurchaseState,
} from '../../types/domain.js'
import type { UserService } from '../users/service.js'
import { env } from '../../config/env.js'
import { createViralDropApps, dedupeApps, enrichOnchainMerchant } from './apps.js'
import { loadMerchantProofMap } from './proofs.js'

export class ProtocolService {
  constructor(
    private rollupClient: RollupClient,
    private userService: UserService,
    private oracleClient: ConnectOracleClient,
    private miniEvmClient: MiniEvmClient,
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

  async getTxDetails(initiaAddress: string, txHash: string): Promise<TxExplorerState | null> {
    await this.userService.ensureUser(initiaAddress)
    return this.rollupClient.getTxDetails(txHash)
  }

  async listMerchants(initiaAddress: string): Promise<MerchantState[]> {
    await this.userService.ensureUser(initiaAddress)
    const [onchainMerchants, viralDropItems, knownAppRoutes, proofMap] = await Promise.all([
      this.rollupClient.listMerchants(),
      this.rollupClient.listViralDropItems().catch(() => []),
      this.rollupClient.listKnownAppRoutes().catch(() => []),
      loadMerchantProofMap(env.ROLLUP_CHAIN_ID),
    ])
    const knownRoutesByAddress = new Map(
      knownAppRoutes.map((route) => [route.merchantAddress.trim().toLowerCase(), route]),
    )
    const onchainApps = onchainMerchants.map((merchant) =>
      enrichOnchainMerchant(
        merchant,
        knownRoutesByAddress.get(merchant.merchantAddress.trim().toLowerCase()) ?? null,
      ),
    )
    const viralDropApps = createViralDropApps(viralDropItems)
    return dedupeApps([...onchainApps, ...viralDropApps]).map((merchant) => ({
      ...merchant,
      proof: proofMap.get(merchant.id) ?? proofMap.get(merchant.contract ?? ''),
    }))
  }

  async listViralDropItems(initiaAddress: string): Promise<ViralDropItemState[]> {
    await this.userService.ensureUser(initiaAddress)
    return this.rollupClient.listViralDropItems()
  }

  async listViralDropPurchases(initiaAddress: string): Promise<ViralDropPurchaseState[]> {
    await this.userService.ensureUser(initiaAddress)
    return this.rollupClient.listViralDropPurchases(initiaAddress)
  }

  async getLendLiquidityRoute(initiaAddress: string): Promise<LendLiquidityRouteState> {
    await this.userService.ensureUser(initiaAddress)

    const lookupDenom = env.MINIEVM_LOOKUP_DENOM?.trim() || env.ROLLUP_NATIVE_DENOM
    const requestedPair = `${env.ROLLUP_NATIVE_SYMBOL}/${env.CONNECT_QUOTE_CURRENCY}`
    const supportedFeeds = await this.oracleClient.getSupportedFeeds()
    const pairSupported = supportedFeeds.includes(requestedPair)
    const resolvedBase = pairSupported ? env.ROLLUP_NATIVE_SYMBOL : env.CONNECT_BASE_CURRENCY
    const resolvedQuote = env.CONNECT_QUOTE_CURRENCY
    const resolvedPair = `${resolvedBase}/${resolvedQuote}`
    const [onchainBridgeRoute, erc20FactoryAddress, erc20Address, oracleQuote] = await Promise.all([
      this.rollupClient.getPreferredLendBridgeRoute({
        sourceChainId: env.ROLLUP_CHAIN_ID,
        destinationChainId: env.MINIEVM_CHAIN_ID,
        sourceDenom: env.ROLLUP_NATIVE_DENOM,
      }),
      this.miniEvmClient.getErc20FactoryAddress(),
      this.miniEvmClient.getContractByDenom(lookupDenom),
      this.oracleClient.getPrice(resolvedBase, resolvedQuote),
    ])
    const mappingPublished = Boolean(erc20Address)
    const routeActive = onchainBridgeRoute?.active ?? true
    const routeMode = routeActive && mappingPublished ? 'live' : 'preview'
    const liquidityStatus =
      onchainBridgeRoute?.liquidityStatus ?? (mappingPublished ? 'unknown' : 'coming_soon')
    const swapEnabled = onchainBridgeRoute?.swapEnabled ?? false
    const sellReady =
      routeMode === 'live' && swapEnabled && liquidityStatus === 'live'
    const liquidityVenue = onchainBridgeRoute?.liquidityVenue
    const poolReference = onchainBridgeRoute?.poolReference
    const routeNotes = onchainBridgeRoute?.notes
    const swapSummary = sellReady
      ? `LEND can bridge into ${env.MINIEVM_CHAIN_NAME} and use ${liquidityVenue || 'the published destination venue'}${poolReference ? ` via ${poolReference}` : ''} for the sell step.`
      : routeMode === 'live'
        ? liquidityVenue
          ? `${liquidityVenue} is published as the destination liquidity venue, but the sell path is not marked fully ready yet.`
          : 'LEND already has a MiniEVM ERC20 mapping, so the bridge step is live even though a destination sell venue is not published onchain yet.'
        : routeActive
          ? 'LEND does not have a live MiniEVM ERC20 mapping yet, so the swap route stays in preview until denom conversion is published.'
          : 'The bridge route is registered onchain but still marked inactive, so users should not use it yet.'

    return {
      routeMode,
      routeStatus: mappingPublished ? 'mapped' : 'mapping_required',
      routeRegistry: onchainBridgeRoute ? 'onchain' : 'derived',
      routeId: onchainBridgeRoute?.id,
      walletHandler: 'interwovenkit',
      transferMethod: 'ibc_hooks',
      sourceChainId: onchainBridgeRoute?.sourceChainId ?? env.ROLLUP_CHAIN_ID,
      sourceChainName: 'LendPay Move Rollup',
      destinationChainId: onchainBridgeRoute?.destinationChainId ?? env.MINIEVM_CHAIN_ID,
      destinationChainName: env.MINIEVM_CHAIN_NAME,
      destinationRestUrl: env.MINIEVM_REST_URL,
      assetSymbol: env.ROLLUP_NATIVE_SYMBOL,
      assetDenom: onchainBridgeRoute?.sourceDenom ?? env.ROLLUP_NATIVE_DENOM,
      destinationDenom: onchainBridgeRoute?.destinationDenom || undefined,
      erc20FactoryAddress: erc20FactoryAddress ?? undefined,
      erc20Address: erc20Address ?? undefined,
      destinationAssetReference:
        onchainBridgeRoute?.destinationAssetReference ?? erc20Address ?? undefined,
      liquidityVenue,
      poolReference,
      liquidityStatus,
      swapEnabled,
      sellReady,
      routeNotes,
      swapSummary,
      oracleQuote: {
        requestedPair,
        resolvedPair,
        pairMode: pairSupported ? 'direct' : 'reference',
        pairSupported,
        pairReason: pairSupported
          ? undefined
          : `Connect does not currently expose ${requestedPair}, so this route uses ${resolvedPair} as the official reference quote.`,
        price: oracleQuote.price,
        sourcePath: oracleQuote.sourcePath,
        fetchedAt: oracleQuote.fetchedAt,
        rawPrice: oracleQuote.rawPrice,
        decimals: oracleQuote.decimals,
        blockTimestamp: oracleQuote.blockTimestamp,
        blockHeight: oracleQuote.blockHeight,
      },
    }
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
