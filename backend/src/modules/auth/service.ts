import { randomUUID } from 'node:crypto'
import { store } from '../../data/store.js'
import { AppError } from '../../lib/errors.js'
import {
  createSessionToken,
  isExpiredSessionToken,
  isSignedSessionToken,
  parseSessionToken,
} from '../../lib/session-token.js'
import {
  normalizeAminoSignResponse,
  normalizePersonalSignResponse,
  verifyAminoChallengeSignature,
  verifyChallengeSignDocShape,
  verifyPersonalMessageSignature,
} from '../../lib/auth.js'
import type { AuthResponse, SessionRecord } from '../../types/domain.js'
import type { UserService } from '../users/service.js'
import { env } from '../../config/env.js'

export class AuthService {
  constructor(private userService: UserService) {}

  async createChallenge(initiaAddress: string) {
    const id = randomUUID()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    const message = [
      'LendPay Login',
      '',
      'Sign this message to verify your wallet and start a secure session.',
      'No gas fee or blockchain transaction will occur.',
      '',
      `Address: ${initiaAddress}`,
      `Nonce: ${id}`,
      `Expires: ${expiresAt}`,
    ].join('\n')

    store.challenges.set(id, {
      id,
      initiaAddress,
      message,
      expiresAt,
    })

    return {
      challengeId: id,
      message,
      expiresAt,
    }
  }

  async verify(initiaAddress: string, challengeId: string, signaturePayload: unknown): Promise<AuthResponse> {
    const challenge = store.challenges.get(challengeId)

    if (!challenge || challenge.initiaAddress !== initiaAddress) {
      throw new AppError(400, 'INVALID_CHALLENGE', 'Challenge is missing or does not match the address.')
    }

    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      store.challenges.delete(challengeId)
      throw new AppError(400, 'EXPIRED_CHALLENGE', 'Challenge has expired.')
    }

    const personalSignResponse = normalizePersonalSignResponse(signaturePayload)
    const signResponse = personalSignResponse ? null : normalizeAminoSignResponse(signaturePayload)

    if (!personalSignResponse && !signResponse) {
      throw new AppError(400, 'MISSING_SIGNATURE', 'A signed challenge payload is required.')
    }

    if (!env.AUTH_ACCEPT_ANY_SIGNATURE) {
      if (personalSignResponse) {
        if (personalSignResponse.message !== challenge.message) {
          throw new AppError(
            401,
            'INVALID_SIGN_DOC',
            'Signed challenge document does not match the issued challenge.',
          )
        }

        const valid = await verifyPersonalMessageSignature(
          initiaAddress,
          personalSignResponse.message,
          personalSignResponse.signature,
        )

        if (!valid) {
          throw new AppError(401, 'INVALID_SIGNATURE', 'Signature verification failed.')
        }
      } else if (signResponse) {
        if (!verifyChallengeSignDocShape(initiaAddress, challenge.message, signResponse.signed)) {
          throw new AppError(
            401,
            'INVALID_SIGN_DOC',
            'Signed challenge document does not match the issued challenge.',
          )
        }

        const valid = await verifyAminoChallengeSignature(initiaAddress, signResponse)

        if (!valid) {
          throw new AppError(401, 'INVALID_SIGNATURE', 'Signature verification failed.')
        }
      }
    }

    store.challenges.delete(challengeId)

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

    if (isSignedSessionToken(token)) {
      const parsed = parseSessionToken(token)

      if (!parsed) {
        throw new AppError(401, 'INVALID_SESSION_TOKEN', 'Session token is invalid.')
      }

      if (isExpiredSessionToken(parsed)) {
        throw new AppError(401, 'SESSION_EXPIRED', 'Session expired.')
      }

      return {
        expiresAt: new Date(parsed.expiresAt).toISOString(),
        initiaAddress: parsed.initiaAddress,
        token: parsed.token,
      }
    }

    const session = store.sessions.get(token)

    if (!session) {
      throw new AppError(401, 'SESSION_NOT_FOUND', 'Session not found.')
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      store.sessions.delete(token)
      throw new AppError(401, 'SESSION_EXPIRED', 'Session expired.')
    }

    return {
      expiresAt: session.expiresAt,
      initiaAddress: session.initiaAddress,
      token: session.token,
    }
  }

  async refresh(authorizationHeader?: string) {
    const session = await this.requireSession(authorizationHeader)
    const next = await this.createSession(session.initiaAddress)

    if (!isSignedSessionToken(session.token)) {
      store.sessions.delete(session.token)
    }

    return next
  }

  async logout(authorizationHeader?: string) {
    const session = await this.requireSession(authorizationHeader)

    if (!isSignedSessionToken(session.token)) {
      store.sessions.delete(session.token)
    }

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
    return createSessionToken(initiaAddress)
  }
}
