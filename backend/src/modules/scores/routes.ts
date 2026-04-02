import type { FastifyInstance } from 'fastify'
import type { AppDeps } from '../../types/deps.js'

export const registerScoreRoutes = async (app: FastifyInstance, deps: AppDeps) => {
  app.get('/api/v1/score', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.scoreService.getLatest(session.initiaAddress)
  })

  app.post('/api/v1/score/analyze', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.scoreService.analyze(session.initiaAddress)
  })

  app.get('/api/v1/score/history', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.scoreService.history(session.initiaAddress)
  })
}
