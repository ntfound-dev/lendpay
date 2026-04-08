import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDeps } from '../../types/deps.js'

const challengeSchema = z.object({
  address: z.string().min(10),
})

const verifySchema = z.object({
  address: z.string().min(10),
  challengeId: z.string().uuid(),
  mode: z.enum(['amino', 'personal_sign']).optional(),
  message: z.string().optional(),
  signed: z.unknown().optional(),
  signature: z.unknown(),
})

export const registerAuthRoutes = async (app: FastifyInstance, deps: AppDeps) => {
  app.post('/api/v1/auth/challenge', async (request) => {
    const body = challengeSchema.parse(request.body)
    return deps.authService.createChallenge(body.address)
  })

  app.post('/api/v1/auth/verify', async (request) => {
    const body = verifySchema.parse(request.body)
    return deps.authService.verify(body.address, body.challengeId, body)
  })

  app.post('/api/v1/auth/refresh', async (request) => {
    return deps.authService.refresh(request.headers.authorization)
  })

  app.post('/api/v1/auth/logout', async (request) => {
    return deps.authService.logout(request.headers.authorization)
  })
}
