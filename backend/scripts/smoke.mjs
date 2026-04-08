import { MnemonicKey } from '@initia/initia.js'
import { serializeSignDoc } from '@cosmjs/amino'
import { toBase64 } from '@cosmjs/encoding'
import { pushPrismaSchema } from './db.mjs'

process.env.APP_ENV = process.env.APP_ENV || 'test'
process.env.AUTH_ACCEPT_ANY_SIGNATURE = 'false'
process.env.PREVIEW_OPERATOR_TOKEN = process.env.PREVIEW_OPERATOR_TOKEN || 'preview-operator'
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://postgres:postgres@127.0.0.1:55432/lendpay_dev?schema=smoke_${Date.now()}`

await pushPrismaSchema(process.env.DATABASE_URL)

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
  const profilesResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/protocol/profiles',
    headers: { authorization: authHeader },
  })
  expectOk(profilesResponse.statusCode, profilesResponse.body, 'list profiles')

  const profiles = parseJson(profilesResponse.body)
  const selectedProfile =
    profiles.find((profile) => profile.qualified && !profile.requiresCollateral) ||
    profiles.find((profile) => profile.qualified)

  const meResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/me',
    headers: { authorization: authHeader },
  })
  expectOk(meResponse.statusCode, meResponse.body, 'fetch me')

  const profile = parseJson(meResponse.body)
  let requestId = null
  let loanId = null
  let repaidInstallment = null
  let skippedReason = null

  if (selectedProfile) {
    const requestAmount = Math.max(1, Math.min(400, score.limitUsd, selectedProfile.maxPrincipal))
    const tenorMonths = Math.max(1, Math.min(3, selectedProfile.maxTenorMonths))
    const collateralAmount = selectedProfile.requiresCollateral
      ? Math.ceil((requestAmount * selectedProfile.collateralRatioBps) / 10_000)
      : undefined

    const requestResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/loan-requests',
      headers: { authorization: authHeader },
      payload: {
        amount: requestAmount,
        tenorMonths,
        profileId: selectedProfile.profileId,
        collateralAmount,
      },
    })
    expectOk(requestResponse.statusCode, requestResponse.body, 'create request')

    const request = parseJson(requestResponse.body)
    requestId = request.id

    const approveResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/loan-requests/${request.id}/approve`,
      headers: { 'x-operator-token': process.env.PREVIEW_OPERATOR_TOKEN },
      payload: { reason: 'Smoke approval' },
    })
    expectOk(approveResponse.statusCode, approveResponse.body, 'approve request')

    const approval = parseJson(approveResponse.body)
    loanId = approval.loan.id

    const repayResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/loans/${approval.loan.id}/repay`,
      headers: { authorization: authHeader },
      payload: {},
    })
    expectOk(repayResponse.statusCode, repayResponse.body, 'repay loan')

    const repay = parseJson(repayResponse.body)
    repaidInstallment = repay.repaidInstallment
  } else {
    skippedReason = 'no_qualified_profile'
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        address: profile.initiaAddress,
        score: score.score,
        qualifiedProfiles: profiles.filter((entry) => entry.qualified).length,
        requestId,
        loanId,
        repaidInstallment,
        requestFlowSkipped: skippedReason !== null,
        skippedReason,
        points: profile.rewards.points,
      },
      null,
      2,
    ),
  )
} finally {
  await app.close()
}
