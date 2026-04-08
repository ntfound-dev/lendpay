import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'
import type { SessionRecord } from '../types/domain.js'

type SessionTokenHeader = {
  alg: 'HS256'
  typ: 'JWT'
}

type SessionTokenPayload = {
  exp: number
  iat: number
  jti: string
  sub: string
  typ: 'lendpay_session'
  v: 1
}

type ParsedSessionToken = {
  expiresAt: number
  initiaAddress: string
  issuedAt: number
  token: string
}

const SESSION_TOKEN_PARTS = 3

const encodeBase64UrlJson = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

const decodeBase64UrlJson = (value: string): unknown | null => {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
  } catch {
    return null
  }
}

const isSessionTokenHeader = (value: unknown): value is SessionTokenHeader => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.alg === 'HS256' && record.typ === 'JWT'
}

const isSessionTokenPayload = (value: unknown): value is SessionTokenPayload => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.sub === 'string' &&
    typeof record.exp === 'number' &&
    typeof record.iat === 'number' &&
    typeof record.jti === 'string' &&
    record.typ === 'lendpay_session' &&
    record.v === 1
  )
}

const createSignature = (headerPart: string, payloadPart: string) =>
  createHmac('sha256', env.JWT_SECRET).update(`${headerPart}.${payloadPart}`).digest('base64url')

const safeEqualText = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export const isSignedSessionToken = (token: string) => token.split('.').length === SESSION_TOKEN_PARTS

export const createSessionToken = (initiaAddress: string): SessionRecord => {
  const issuedAtSeconds = Math.floor(Date.now() / 1000)
  const expiresAtSeconds = issuedAtSeconds + env.JWT_TTL_SECONDS

  const headerPart = encodeBase64UrlJson({
    alg: 'HS256',
    typ: 'JWT',
  } satisfies SessionTokenHeader)
  const payloadPart = encodeBase64UrlJson({
    sub: initiaAddress,
    exp: expiresAtSeconds,
    iat: issuedAtSeconds,
    jti: randomUUID(),
    typ: 'lendpay_session',
    v: 1,
  } satisfies SessionTokenPayload)
  const signaturePart = createSignature(headerPart, payloadPart)

  return {
    token: `${headerPart}.${payloadPart}.${signaturePart}`,
    initiaAddress,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  }
}

export const parseSessionToken = (token: string): ParsedSessionToken | null => {
  const [headerPart, payloadPart, signaturePart] = token.split('.')

  if (!headerPart || !payloadPart || !signaturePart) {
    return null
  }

  const expectedSignature = createSignature(headerPart, payloadPart)
  if (!safeEqualText(signaturePart, expectedSignature)) {
    return null
  }

  const header = decodeBase64UrlJson(headerPart)
  const payload = decodeBase64UrlJson(payloadPart)

  if (!isSessionTokenHeader(header) || !isSessionTokenPayload(payload)) {
    return null
  }

  return {
    token,
    initiaAddress: payload.sub,
    issuedAt: payload.iat * 1000,
    expiresAt: payload.exp * 1000,
  }
}

export const isExpiredSessionToken = (token: ParsedSessionToken) => token.expiresAt <= Date.now()
