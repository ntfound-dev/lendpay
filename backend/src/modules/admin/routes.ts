import type { FastifyInstance } from 'fastify'
import type { AppDeps } from '../../types/deps.js'

export const registerAdminRoutes = async (app: FastifyInstance, deps: AppDeps) => {
  app.post('/api/v1/admin/vip/stages/:stage/publish', async (request) => {
    deps.authService.requireOperator(request.headers['x-operator-token'])
    const stage = String((request.params as { stage: string }).stage)

    return {
      enabled: false,
      message: `VIP publish flow for stage ${stage} is not wired in the MVP scaffold yet.`,
    }
  })

  app.post('/api/v1/admin/vip/stages/:stage/finalize', async (request) => {
    deps.authService.requireOperator(request.headers['x-operator-token'])
    const stage = String((request.params as { stage: string }).stage)

    return {
      enabled: false,
      message: `VIP finalize flow for stage ${stage} is not wired in the MVP scaffold yet.`,
    }
  })

  app.post('/api/v1/admin/dex/simulate', async (request) => {
    deps.authService.requireOperator(request.headers['x-operator-token'])

    return {
      enabled: false,
      message: 'DEX treasury simulation is reserved for a later integration pass.',
    }
  })

  app.post('/api/v1/admin/dex/rebalance', async (request) => {
    deps.authService.requireOperator(request.headers['x-operator-token'])

    return {
      enabled: false,
      message: 'DEX treasury rebalancing is reserved for a later integration pass.',
    }
  })
}
