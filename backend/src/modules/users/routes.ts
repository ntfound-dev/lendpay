import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDeps } from '../../types/deps.js'

const syncRewardsSchema = z.object({
  txHash: z.string().optional(),
})

export const registerUserRoutes = async (app: FastifyInstance, deps: AppDeps) => {
  app.get('/api/v1/me', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.userService.getProfile(session.initiaAddress)
  })

  app.get('/api/v1/me/username', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    const profile = await deps.userService.getProfile(session.initiaAddress)

    return {
      address: profile.initiaAddress,
      username: profile.username,
    }
  })

  app.post('/api/v1/me/username/refresh', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.userService.refreshUsername(session.initiaAddress)
  })

  app.get('/api/v1/me/points', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    const profile = await deps.userService.getProfile(session.initiaAddress)
    return profile.rewards
  })

  app.post('/api/v1/me/rewards/sync', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    const body = syncRewardsSchema.parse(request.body)
    const profile = await deps.userService.syncProtocolState(session.initiaAddress, body.txHash)
    return profile.rewards
  })

  app.get('/api/v1/me/activity', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.activityService.list(session.initiaAddress)
  })
}
