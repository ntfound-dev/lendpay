import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDeps } from '../../types/deps.js'

const requestSchema = z.object({
  amount: z.coerce.number().positive(),
  collateralAmount: z.coerce.number().nonnegative().optional(),
  merchantId: z.string().min(1).optional(),
  tenorMonths: z.coerce.number().int().positive(),
  profileId: z.coerce.number().int().positive().optional(),
  txHash: z.string().optional(),
})

const repaySchema = z.object({
  txHash: z.string().optional(),
})

const approveSchema = z.object({
  reason: z.string().min(3).optional(),
})

export const registerLoanRoutes = async (app: FastifyInstance, deps: AppDeps) => {
  app.get('/api/v1/loan-requests', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.loanService.listRequests(session.initiaAddress)
  })

  app.post('/api/v1/loan-requests', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    const body = requestSchema.parse(request.body)

    return deps.loanService.createRequest(session.initiaAddress, body)
  })

  app.get('/api/v1/loan-requests/:id', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    const requests = await deps.loanService.listRequests(session.initiaAddress)
    return requests.find((entry) => entry.id === String((request.params as { id: string }).id)) ?? null
  })

  app.post('/api/v1/loan-requests/:id/approve', async (request) => {
    const operator = deps.authService.requireOperator(request.headers['x-operator-token'])
    const body = approveSchema.parse(request.body)
    const id = String((request.params as { id: string }).id)

    return deps.loanService.approveRequest(id, operator.actorAddress, body.reason)
  })

  app.get('/api/v1/loans', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.loanService.listLoans(session.initiaAddress)
  })

  app.get('/api/v1/loans/:id', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.loanService.getLoan(session.initiaAddress, String((request.params as { id: string }).id))
  })

  app.get('/api/v1/loans/:id/schedule', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.loanService.getSchedule(
      session.initiaAddress,
      String((request.params as { id: string }).id),
    )
  })

  app.get('/api/v1/loans/:id/fees', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    return deps.loanService.getFeeState(
      session.initiaAddress,
      String((request.params as { id: string }).id),
    )
  })

  app.post('/api/v1/loans/:id/repay', async (request) => {
    const session = await deps.authService.requireSession(request.headers.authorization)
    const body = repaySchema.parse(request.body)

    return deps.repaymentService.repay(
      session.initiaAddress,
      String((request.params as { id: string }).id),
      body.txHash,
    )
  })
}
