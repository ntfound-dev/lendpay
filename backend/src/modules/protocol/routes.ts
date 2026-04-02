import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDeps } from '../../types/deps.js'

const campaignSchema = z.object({
  phase: z.coerce.number().int().nonnegative(),
  totalAllocation: z.coerce.number().int().positive(),
  requiresUsername: z.coerce.boolean().default(false),
  minimumPlatformActions: z.coerce.number().int().nonnegative().default(0),
})

const campaignAllocationSchema = z.object({
  userAddress: z.string().min(8),
  amount: z.coerce.number().int().positive(),
})

const governanceProposalSchema = z.object({
  proposalType: z.coerce.number().int().positive(),
  title: z.string().min(3),
  body: z.string().min(5),
})

const governanceVoteSchema = z.object({
  support: z.coerce.boolean(),
})

const merchantSchema = z.object({
  merchantAddress: z.string().min(8),
  category: z.string().min(2),
  listingFeeBps: z.coerce.number().int().nonnegative(),
  partnerFeeBps: z.coerce.number().int().nonnegative(),
})

const merchantActiveSchema = z.object({
  active: z.coerce.boolean(),
})

export const registerProtocolRoutes = async (app: FastifyInstance, deps: AppDeps) => {
  app.get('/api/v1/protocol/profiles', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.protocolService.listProfiles(session.initiaAddress)
  })

  app.get('/api/v1/protocol/campaigns', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.protocolService.listCampaigns(session.initiaAddress)
  })

  app.get('/api/v1/protocol/governance', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.protocolService.listGovernance(session.initiaAddress)
  })

  app.get('/api/v1/protocol/merchants', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.protocolService.listMerchants(session.initiaAddress)
  })

  app.post('/api/v1/protocol/campaigns', async (request) => {
    deps.authService.requireOperator(request.headers['x-operator-token'])
    const payload = campaignSchema.parse(request.body)
    return deps.protocolService.createCampaign(payload)
  })

  app.post('/api/v1/protocol/campaigns/:id/allocations', async (request) => {
    deps.authService.requireOperator(request.headers['x-operator-token'])
    const payload = campaignAllocationSchema.parse(request.body)
    const campaignId = Number((request.params as { id: string }).id)
    return deps.protocolService.allocateCampaign({ ...payload, campaignId })
  })

  app.post('/api/v1/protocol/campaigns/:id/close', async (request) => {
    deps.authService.requireOperator(request.headers['x-operator-token'])
    const campaignId = Number((request.params as { id: string }).id)
    return deps.protocolService.closeCampaign({ campaignId })
  })

  app.post('/api/v1/protocol/governance/proposals', async (request) => {
    deps.authService.requireOperator(request.headers['x-operator-token'])
    const payload = governanceProposalSchema.parse(request.body)
    return deps.protocolService.proposeGovernance(payload)
  })

  app.post('/api/v1/protocol/governance/:id/vote', async (request) => {
    deps.authService.requireOperator(request.headers['x-operator-token'])
    const payload = governanceVoteSchema.parse(request.body)
    const proposalId = Number((request.params as { id: string }).id)
    return deps.protocolService.voteGovernance({ proposalId, support: payload.support })
  })

  app.post('/api/v1/protocol/governance/:id/finalize', async (request) => {
    deps.authService.requireOperator(request.headers['x-operator-token'])
    const proposalId = Number((request.params as { id: string }).id)
    return deps.protocolService.finalizeGovernance({ proposalId })
  })

  app.post('/api/v1/protocol/merchants', async (request) => {
    deps.authService.requireOperator(request.headers['x-operator-token'])
    const payload = merchantSchema.parse(request.body)
    return deps.protocolService.registerMerchant(payload)
  })

  app.post('/api/v1/protocol/merchants/:id/active', async (request) => {
    deps.authService.requireOperator(request.headers['x-operator-token'])
    const payload = merchantActiveSchema.parse(request.body)
    const merchantId = Number((request.params as { id: string }).id)
    return deps.protocolService.setMerchantActive({ merchantId, active: payload.active })
  })
}
