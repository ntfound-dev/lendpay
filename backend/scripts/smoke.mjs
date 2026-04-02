import { MnemonicKey } from '@initia/initia.js'
import { serializeSignDoc } from '@cosmjs/amino'
import { toBase64 } from '@cosmjs/encoding'
import { pushPrismaSchema } from './db.mjs'

process.env.APP_ENV = process.env.APP_ENV || 'test'
process.env.AUTH_ACCEPT_ANY_SIGNATURE = 'false'
process.env.PREVIEW_OPERATOR_TOKEN = process.env.PREVIEW_OPERATOR_TOKEN || 'preview-operator'
process.env.DATABASE_URL = process.env.DATABASE_URL || `file:/tmp/lendpay-smoke-${Date.now()}.db`

pushPrismaSchema(process.env.DATABASE_URL)

const [{ buildApp }, { buildChallengeSignDoc }] = await Promise.all([
  import('../dist/app.js'),
  import('../dist/lib/auth.js'),
])

const app = await buildApp()

const parseJson = (body) => JSON.parse(body)

const expectOk = (statusCode, body, label) => {
  if (statusCode >= 400) {
    throw new Error(`${label} failed with ${statusCode}: ${body}`)
  }
}

try {
  const wallet = new MnemonicKey()

  const challengeResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/challenge',
    payload: { address: wallet.accAddress },
  })
  expectOk(challengeResponse.statusCode, challengeResponse.body, 'challenge')

  const challenge = parseJson(challengeResponse.body)
  const signed = buildChallengeSignDoc(wallet.accAddress, challenge.message)
  const signatureBytes = await wallet.sign(Buffer.from(serializeSignDoc(signed)))

  const verifyResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify',
    payload: {
      address: wallet.accAddress,
      challengeId: challenge.challengeId,
      signed,
      signature: {
        pub_key: wallet.publicKey?.toAmino(),
        signature: toBase64(signatureBytes),
      },
    },
  })
  expectOk(verifyResponse.statusCode, verifyResponse.body, 'verify')

  const auth = parseJson(verifyResponse.body)
  const authHeader = `Bearer ${auth.token}`

  const analyzeResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/score/analyze',
    headers: { authorization: authHeader },
    payload: {},
  })
  expectOk(analyzeResponse.statusCode, analyzeResponse.body, 'analyze')

  const score = parseJson(analyzeResponse.body)
  const requestAmount = Math.min(400, score.limitUsd)

  const requestResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/loan-requests',
    headers: { authorization: authHeader },
    payload: {
      amount: requestAmount,
      tenorMonths: 3,
    },
  })
  expectOk(requestResponse.statusCode, requestResponse.body, 'create request')

  const request = parseJson(requestResponse.body)

  const approveResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/loan-requests/${request.id}/approve`,
    headers: { 'x-operator-token': process.env.PREVIEW_OPERATOR_TOKEN },
    payload: { reason: 'Smoke approval' },
  })
  expectOk(approveResponse.statusCode, approveResponse.body, 'approve request')

  const approval = parseJson(approveResponse.body)

  const repayResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/loans/${approval.loan.id}/repay`,
    headers: { authorization: authHeader },
    payload: {},
  })
  expectOk(repayResponse.statusCode, repayResponse.body, 'repay loan')

  const repay = parseJson(repayResponse.body)

  const meResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/me',
    headers: { authorization: authHeader },
  })
  expectOk(meResponse.statusCode, meResponse.body, 'fetch me')

  const profile = parseJson(meResponse.body)

  console.log(
    JSON.stringify(
      {
        ok: true,
        address: profile.initiaAddress,
        score: score.score,
        requestId: request.id,
        loanId: approval.loan.id,
        repayInstallment: repay.repaidInstallment,
        points: profile.rewards.points,
      },
      null,
      2,
    ),
  )
} finally {
  await app.close()
}
