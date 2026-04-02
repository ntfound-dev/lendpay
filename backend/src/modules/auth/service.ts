import { randomUUID } from 'node:crypto'
import { prisma } from '../../db/prisma.js'
import { AppError } from '../../lib/errors.js'
import {
  normalizeAminoSignResponse,
  verifyAminoChallengeSignature,
  verifyChallengeSignDocShape,
} from '../../lib/auth.js'
import type { AuthResponse, SessionRecord } from '../../types/domain.js'
import type { UserService } from '../users/service.js'
import { env } from '../../config/env.js'

export class AuthService {
  constructor(private userService: UserService) {}

  async createChallenge(initiaAddress: string) {
    const id = randomUUID()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    const message = `LendPay login\nAddress: ${initiaAddress}\nNonce: ${id}\nExpires: ${expiresAt}`

    await prisma.challenge.create({
      data: {
        id,
        initiaAddress,
        message,
        expiresAt: new Date(expiresAt),
      },
    })

    return {
      challengeId: id,
      message,
      expiresAt,
    }
  }

  async verify(initiaAddress: string, challengeId: string, signaturePayload: unknown): Promise<AuthResponse> {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
    })

    if (!challenge || challenge.initiaAddress !== initiaAddress) {
      throw new AppError(400, 'INVALID_CHALLENGE', 'Challenge is missing or does not match the address.')
    }

    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      throw new AppError(400, 'EXPIRED_CHALLENGE', 'Challenge has expired.')
    }

    const signResponse = normalizeAminoSignResponse(signaturePayload)

    if (!signResponse) {
      throw new AppError(400, 'MISSING_SIGNATURE', 'A signed challenge payload is required.')
    }

    if (!env.AUTH_ACCEPT_ANY_SIGNATURE) {
      if (!verifyChallengeSignDocShape(initiaAddress, challenge.message, signResponse.signed)) {
        throw new AppError(401, 'INVALID_SIGN_DOC', 'Signed challenge document does not match the issued challenge.')
      }

      const valid = await verifyAminoChallengeSignature(initiaAddress, signResponse)

      if (!valid) {
        throw new AppError(401, 'INVALID_SIGNATURE', 'Signature verification failed.')
      }
    }

    await prisma.challenge.delete({
      where: { id: challengeId },
    })

    const user = await this.userService.ensureUser(initiaAddress)
    const session = await this.createSession(initiaAddress)

    return {
      token: session.token,
      user,
    }
  }

  async requireSession(authorizationHeader?: string) {
    const token = authorizationHeader?.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing bearer token.')
    }

    const session = await prisma.session.findUnique({
      where: { token },
    })

    if (!session) {
      throw new AppError(401, 'SESSION_NOT_FOUND', 'Session not found.')
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await prisma.session.delete({
        where: { token },
      })
      throw new AppError(401, 'SESSION_EXPIRED', 'Session expired.')
    }

    return {
      expiresAt: session.expiresAt.toISOString(),
      initiaAddress: session.initiaAddress,
      token: session.token,
    }
  }

  async refresh(authorizationHeader?: string) {
    const session = await this.requireSession(authorizationHeader)
    const next = await this.createSession(session.initiaAddress)
    await prisma.session.delete({
      where: { token: session.token },
    })

    return next
  }

  async logout(authorizationHeader?: string) {
    const session = await this.requireSession(authorizationHeader)
    await prisma.session.delete({
      where: { token: session.token },
    })
    return { success: true }
  }

  requireOperator(operatorToken?: string | string[]) {
    const normalized = Array.isArray(operatorToken) ? operatorToken[0] : operatorToken

    if (!normalized || normalized !== env.PREVIEW_OPERATOR_TOKEN) {
      throw new AppError(401, 'OPERATOR_UNAUTHORIZED', 'Missing or invalid operator token.')
    }

    return {
      actorAddress: 'preview-operator',
    }
  }

  private async createSession(initiaAddress: string): Promise<SessionRecord> {
    const session: SessionRecord = {
      token: randomUUID(),
      initiaAddress,
      expiresAt: new Date(Date.now() + env.JWT_TTL_SECONDS * 1000).toISOString(),
    }

    await prisma.session.create({
      data: {
        token: session.token,
        initiaAddress,
        expiresAt: new Date(session.expiresAt),
      },
    })

    return session
  }
}
