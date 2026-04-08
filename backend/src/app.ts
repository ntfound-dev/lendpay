import Fastify from 'fastify'
import cors from '@fastify/cors'
import { ZodError } from 'zod'
import { env } from './config/env.js'
import { AppError } from './lib/errors.js'
import { OllamaScoringClient } from './integrations/ai/ollama.js'
import { ConnectOracleClient } from './integrations/connect/oracle.js'
import { MiniEvmClient } from './integrations/minievm/client.js'
import { RollupClient } from './integrations/rollup/client.js'
import { InMemoryRateLimiter, resolveRateLimitRule } from './lib/rate-limit.js'
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
  const rateLimiter = new InMemoryRateLimiter()

  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
  })

  if (env.RATE_LIMIT_ENABLED) {
    app.addHook('onRequest', async (request, reply) => {
      if (request.method === 'OPTIONS') {
        return
      }

      const rule = resolveRateLimitRule(request.method, request.url, {
        aiMaxRequests: env.RATE_LIMIT_AI_MAX_REQUESTS,
        authMaxRequests: env.RATE_LIMIT_AUTH_MAX_REQUESTS,
        globalMaxRequests: env.RATE_LIMIT_GLOBAL_MAX_REQUESTS,
        mutationMaxRequests: env.RATE_LIMIT_MUTATION_MAX_REQUESTS,
        windowMs: env.RATE_LIMIT_WINDOW_MS,
      })
      const result = rateLimiter.check(request.ip, rule)
      const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))

      reply.header('x-ratelimit-limit', String(result.limit))
      reply.header('x-ratelimit-remaining', String(result.remaining))
      reply.header('x-ratelimit-reset', String(result.resetAt))

      if (!result.allowed) {
        reply.header('retry-after', String(retryAfterSeconds))
        throw new AppError(
          429,
          'RATE_LIMITED',
          `Too many ${rule.label.toLowerCase()} requests from this client. Please retry shortly.`,
        )
      }
    })
  }

  const oracleClient = new ConnectOracleClient()
  const ollamaClient = new OllamaScoringClient()
  const miniEvmClient = new MiniEvmClient()
  const rollupClient = new RollupClient()
  const usernamesClient = new UsernamesClient()

  const activityService = new ActivityService()
  const userService = new UserService(usernamesClient, rollupClient)
  const authService = new AuthService(userService)
  const protocolService = new ProtocolService(
    rollupClient,
    userService,
    oracleClient,
    miniEvmClient,
  )
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

  // InterwovenKit treats `customChain.apis.indexer[0].address` as a full indexer surface.
  // For local rollups we only need empty, well-formed responses so the wallet drawer
  // does not hang when the chain has no tx/NFT indexer yet.
  app.get('/indexer/tx/v1/txs/by_account/:address', async () => ({
    txs: [],
    pagination: {
      next_key: null,
      total: '0',
    },
  }))

  app.get('/indexer/nft/v1/tokens/by_account/:address', async () => ({
    tokens: [],
    pagination: {
      next_key: null,
      total: '0',
    },
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
