import Fastify from 'fastify'
import cors from '@fastify/cors'
import { ZodError } from 'zod'
import { env } from './config/env.js'
import { AppError } from './lib/errors.js'
import { OllamaScoringClient } from './integrations/ai/ollama.js'
import { ConnectOracleClient } from './integrations/connect/oracle.js'
import { RollupClient } from './integrations/rollup/client.js'
import { UsernamesClient } from './integrations/l1/usernames.js'
import { ActivityService } from './modules/activity/service.js'
import { AuthService } from './modules/auth/service.js'
import { LoanService } from './modules/loans/service.js'
import { RepaymentService } from './modules/repayments/service.js'
import { ProtocolService } from './modules/protocol/service.js'
import { CreditScoringAgent } from './modules/scores/agent.js'
import { ScoreService } from './modules/scores/service.js'
import { UserService } from './modules/users/service.js'
import { registerAdminRoutes } from './modules/admin/routes.js'
import { registerAuthRoutes } from './modules/auth/routes.js'
import { registerLoanRoutes } from './modules/loans/routes.js'
import { registerProtocolRoutes } from './modules/protocol/routes.js'
import { registerScoreRoutes } from './modules/scores/routes.js'
import { registerUserRoutes } from './modules/users/routes.js'
import type { AppDeps } from './types/deps.js'

export const buildApp = async () => {
  const app = Fastify({
    logger: env.APP_ENV === 'development',
  })

  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
  })

  const oracleClient = new ConnectOracleClient()
  const ollamaClient = new OllamaScoringClient()
  const rollupClient = new RollupClient()
  const usernamesClient = new UsernamesClient()

  const activityService = new ActivityService()
  const userService = new UserService(usernamesClient, rollupClient)
  const authService = new AuthService(userService)
  const protocolService = new ProtocolService(rollupClient, userService)
  const scoringAgent = new CreditScoringAgent(ollamaClient)
  const scoreService = new ScoreService(oracleClient, userService, activityService, scoringAgent)
  const loanService = new LoanService(rollupClient, userService, activityService, scoreService)
  const repaymentService = new RepaymentService(
    rollupClient,
    userService,
    activityService,
    scoreService,
    loanService,
  )

  const deps: AppDeps = {
    activityService,
    authService,
    loanService,
    oracleClient,
    protocolService,
    repaymentService,
    rollupClient,
    scoreService,
    userService,
    usernamesClient,
  }

  app.get('/api/v1/health', async () => ({
    ok: true,
    env: env.APP_ENV,
    mode: rollupClient.mode(),
    chainId: env.ROLLUP_CHAIN_ID,
  }))

  app.get('/api/v1/meta/connect-feeds', async () => ({
    feeds: await oracleClient.getSupportedFeeds(),
  }))

  app.get('/api/v1/meta/treasury', async () => rollupClient.treasuryState())

  app.get('/api/v1/meta/ai', async () => scoreService.providerState())

  app.get('/api/v1/meta/chains', async () => ({
    l1RestUrl: env.INITIA_L1_REST_URL,
    rollupRestUrl: env.ROLLUP_REST_URL,
    rollupRpcUrl: env.ROLLUP_RPC_URL,
    rollupChainId: env.ROLLUP_CHAIN_ID,
  }))

  await registerAuthRoutes(app, deps)
  await registerUserRoutes(app, deps)
  await registerScoreRoutes(app, deps)
  await registerLoanRoutes(app, deps)
  await registerProtocolRoutes(app, deps)
  await registerAdminRoutes(app, deps)

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        issues: error.issues,
      })
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
      })
    }

    app.log.error(error)

    return reply.status(500).send({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected backend error.',
    })
  })

  return app
}
