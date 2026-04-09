# API Reference

This page documents the most important backend routes exposed by LendPay and explains how to use them in practice.

## Base URL

Local backend:

```bash
http://127.0.0.1:8080
```

Most application routes are prefixed with:

```bash
/api/v1
```

## Auth Model

There are three route classes:

- public routes
  No token required. Used for health, metadata, and the auth handshake.
- borrower-authenticated routes
  Require `Authorization: Bearer <session-token>`.
- operator-gated routes
  Require `x-operator-token: <operator-token>`.

## Quick Start

### 1. Ask for a login challenge

```bash
curl -X POST http://127.0.0.1:8080/api/v1/auth/challenge \
  -H 'content-type: application/json' \
  -d '{
    "address": "init1..."
  }'
```

Returns a challenge payload similar to:

```json
{
  "challengeId": "uuid",
  "message": "LendPay Login\n\nSign this message...",
  "expiresAt": "2026-04-09T12:00:00.000Z"
}
```

### 2. Sign the challenge with the wallet

In the app, the frontend does this automatically.

For manual integration, the payload depends on the wallet signing mode:

- `personal_sign`
- `amino`

### 3. Verify the signed challenge and get a session token

Personal-sign style example:

```bash
curl -X POST http://127.0.0.1:8080/api/v1/auth/verify \
  -H 'content-type: application/json' \
  -d '{
    "address": "init1...",
    "challengeId": "uuid",
    "mode": "personal_sign",
    "message": "LendPay Login\n\nSign this message...",
    "signature": "0x..."
  }'
```

The response includes:

- `token`
- `user`

That `token` is what you send in the `Authorization` header for borrower routes.

### 4. Use the bearer token on protected routes

```bash
curl http://127.0.0.1:8080/api/v1/me \
  -H 'Authorization: Bearer <session-token>'
```

## Route Notes

Important implementation behavior:

- `GET /api/v1/score` returns the latest cached score or creates one if none exists yet
- several borrower mutation routes accept `txHash`
  This is used to sync backend mirrors after a real onchain transaction
- some routes can return `preview` mode if the local runtime is not broadcasting live writes
- the backend may do more work than a thin API, especially during first login and first score generation

## Auth

### `POST /api/v1/auth/challenge`

Use this to start login.

Request body:

```json
{
  "address": "init1..."
}
```

What it does:

- stores a short-lived login challenge
- returns the challenge message for wallet signing

### `POST /api/v1/auth/verify`

Use this after the wallet signs the challenge.

Accepted body shape:

- `address`
- `challengeId`
- `mode`
- `signature`
- and optionally `message` or `signed` depending on signing mode

What it does:

- verifies the signed challenge
- hydrates the borrower if needed
- issues a backend session

### `POST /api/v1/auth/refresh`

Use this to replace an existing session with a fresh one.

Required header:

```bash
Authorization: Bearer <session-token>
```

### `POST /api/v1/auth/logout`

Use this to invalidate the current session.

Required header:

```bash
Authorization: Bearer <session-token>
```

## Borrower

All routes below require:

```bash
Authorization: Bearer <session-token>
```

### `GET /api/v1/me`

Returns the normalized borrower profile.

Use it when you want:

- wallet-linked user profile
- username status
- reward balances
- basic wallet and collateral info

Example:

```bash
curl http://127.0.0.1:8080/api/v1/me \
  -H 'Authorization: Bearer <session-token>'
```

### `GET /api/v1/me/username`

Returns a small identity payload:

- `address`
- `username`

Use it when you only need lightweight username status instead of the full profile.

### `POST /api/v1/me/username/refresh`

Forces a fresh username refresh from the configured identity sources.

Use it after:

- a new `.init` name was set
- identity looks stale in the UI

### `GET /api/v1/me/points`

Returns the rewards block from the user profile.

Use it for:

- points
- tier
- held and liquid `LEND`
- claimable rewards
- streak and discount counters

### `POST /api/v1/me/rewards/sync`

Request body:

```json
{
  "txHash": "optional-chain-tx-hash"
}
```

Use it after a reward-related onchain transaction if you want the backend mirror to refresh immediately.

### `GET /api/v1/me/activity`

Returns the borrower activity feed.

Use it for:

- score refresh events
- loan activity
- repayment updates
- identity-related events

### Additional borrower routes currently available

These are also present in the current backend:

- `GET /api/v1/me/faucet`
- `POST /api/v1/me/faucet/claim`
- `GET /api/v1/me/referral`
- `POST /api/v1/me/referral/apply`
- `GET /api/v1/leaderboard`

## Score

All routes below require:

```bash
Authorization: Bearer <session-token>
```

### `GET /api/v1/score`

Returns the latest score for the current borrower.

Important behavior:

- if a score already exists, backend returns the latest stored score
- if no score exists yet, backend generates one

Use it for regular app loads.

### `POST /api/v1/score/analyze`

Forces a fresh score analysis.

Use it when you want:

- a fresh underwriting pass
- refreshed signals after borrower activity changed
- a new oracle snapshot and updated score summary

Example:

```bash
curl -X POST http://127.0.0.1:8080/api/v1/score/analyze \
  -H 'Authorization: Bearer <session-token>'
```

### `GET /api/v1/score/history`

Returns recent historical scores.

Use it for:

- trend views
- score history charts
- operator or product diagnostics

Important caveat:

- the scoring engine is hybrid and policy-bounded
- AI can influence the draft score, but final values are still clamped by backend policy

## Requests And Loans

All routes below require:

```bash
Authorization: Bearer <session-token>
```

### `GET /api/v1/loan-requests`

Returns the current borrower request list.

### `POST /api/v1/loan-requests`

Request body:

```json
{
  "amount": 300,
  "tenorMonths": 3,
  "profileId": 1,
  "merchantId": "viral-drop",
  "collateralAmount": 0,
  "txHash": "optional-chain-tx-hash"
}
```

Field meaning:

- `amount`
  Requested principal.
- `tenorMonths`
  Requested tenor.
- `profileId`
  Credit product/profile to use.
- `merchantId`
  Partner app or merchant route.
- `collateralAmount`
  Only relevant for collateralized profiles.
- `txHash`
  Optional real chain transaction hash if the request was already broadcast from the wallet.

Important behavior:

- if `txHash` is provided and the rollup is readable, backend waits for the tx and syncs the real onchain request
- if no live tx is provided, backend still validates policy and creates or updates the mirrored request state

### `GET /api/v1/loan-requests/:id`

Returns one request from the current borrower set if it exists.

### `POST /api/v1/loan-requests/:id/approve`

This is operator-gated and is documented again below in the operator section.

### `POST /api/v1/loan-requests/:id/review-demo`

This additional route exists in the current backend for demo review flows.

Use it only when preview self-approval is enabled on the backend.

### `GET /api/v1/loans`

Returns the current borrower loans.

### `GET /api/v1/loans/:id`

Returns one loan by ID.

### `GET /api/v1/loans/:id/schedule`

Returns the installment schedule for a loan.

### `GET /api/v1/loans/:id/fees`

Returns fee state for a loan when it can be resolved from the current runtime.

### `POST /api/v1/loans/:id/repay`

Request body:

```json
{
  "txHash": "optional-chain-tx-hash"
}
```

Important behavior:

- if `txHash` is provided and the rollup is readable, backend waits for the live repayment tx and syncs the actual onchain loan state
- if not, backend can still update mirrored preview state depending on runtime mode

Use it after a repayment action when you want borrower state to refresh immediately.

## Protocol

All routes below require:

```bash
Authorization: Bearer <session-token>
```

### `GET /api/v1/protocol/profiles`

Returns profile quotes for the current borrower.

Use it to show:

- qualification state
- max principal
- tenor cap
- collateral requirements

### `GET /api/v1/protocol/campaigns`

Returns campaign state relevant to the current borrower.

### `GET /api/v1/protocol/governance`

Returns governance state and proposal summaries.

### `GET /api/v1/protocol/merchants`

Returns merchant and app route metadata.

### `GET /api/v1/protocol/tx/:hash`

Returns transaction details when the backend can resolve them from the rollup runtime.

### `GET /api/v1/protocol/viral-drop/items`

Returns available `viral_drop` items.

### `GET /api/v1/protocol/viral-drop/purchases`

Returns borrower purchases associated with the route.

### `GET /api/v1/protocol/liquidity/lend`

Returns the current `LEND` liquidity route state.

This is where the backend explains whether the route is:

- `live`
- `preview`
- or still waiting for mapping / bridge readiness

Important fields in the current response model:

- `routeRegistry`
  `onchain` when the backend resolved the route from `bridge.move`, otherwise `derived`
- `destinationDenom`
  the published destination denom such as `erc20/LEND`
- `liquidityVenue`
  destination venue metadata such as `InitiaDEX`
- `poolReference`
  sell venue pool metadata such as `LEND/INIT`
- `liquidityStatus`
  `unknown`, `coming_soon`, `live`, or `paused`
- `swapEnabled`
  whether the destination swap should be exposed to users yet
- `sellReady`
  true only when the route is live, the mapping exists, and the destination venue is marked ready

Current local example on `lendpay-4`:

- `routeRegistry: onchain`
- `destinationDenom: erc20/LEND`
- `liquidityVenue: InitiaDEX`
- `poolReference: LEND/INIT`
- `liquidityStatus: coming_soon`
- `swapEnabled: false`

That is why the route can already be proven onchain while the final user sell path still honestly reads as pending.

## Operator-Gated

All routes below require:

```bash
x-operator-token: <operator-token>
```

### `POST /api/v1/loan-requests/:id/approve`

Optional body:

```json
{
  "reason": "Policy check passed"
}
```

Use it to approve a pending request.

Important behavior:

- if the runtime can broadcast live approval, backend submits the approval to the rollup
- otherwise it can return preview-style approval state

### `POST /api/v1/protocol/campaigns`

Request body:

```json
{
  "phase": 1,
  "totalAllocation": 100000,
  "requiresUsername": false,
  "minimumPlatformActions": 0
}
```

Use it to create a new campaign.

### `POST /api/v1/protocol/campaigns/:id/allocations`

Request body:

```json
{
  "userAddress": "init1...",
  "amount": 1000
}
```

Use it to allocate campaign rewards to a borrower.

### `POST /api/v1/protocol/campaigns/:id/close`

Use it to close a campaign.

### `POST /api/v1/protocol/governance/proposals`

Request body:

```json
{
  "proposalType": 1,
  "title": "Example proposal",
  "body": "Detailed proposal body"
}
```

Use it to create a governance proposal.

### `POST /api/v1/protocol/governance/:id/vote`

Request body:

```json
{
  "support": true
}
```

Use it to cast a yes or no governance vote.

### `POST /api/v1/protocol/governance/:id/finalize`

Use it after the voting period has ended to finalize the proposal.

### `POST /api/v1/protocol/merchants`

Request body:

```json
{
  "merchantAddress": "init1...",
  "category": "marketplace",
  "listingFeeBps": 100,
  "partnerFeeBps": 500
}
```

Use it to register a new merchant route.

### `POST /api/v1/protocol/merchants/:id/active`

Request body:

```json
{
  "active": true
}
```

Use it to enable or disable a merchant route.

## Meta

These routes are public.

### `GET /api/v1/health`

Use it for health checks and local stack readiness.

### `GET /api/v1/meta/connect-feeds`

Returns supported Connect pricing feeds.

Use it when you want to inspect what oracle feed pairs the backend can read directly.

### `GET /api/v1/meta/treasury`

Returns current treasury state from the runtime integration.

### `GET /api/v1/meta/ai`

Returns AI provider status.

Use it to check whether the local Ollama-backed analysis path is reachable.

### `GET /api/v1/meta/chains`

Returns the configured chain endpoints:

- L1 REST URL
- rollup REST URL
- rollup RPC URL
- rollup chain ID

Example:

```bash
curl http://127.0.0.1:8080/api/v1/meta/chains
```

## Error Handling

Typical error classes:

- `400`
  Validation or business-rule error.
- `401`
  Missing or invalid auth.
- `403`
  Operator-only or preview-disabled route.
- `404`
  Missing borrower, request, loan, or protocol object.
- `409`
  Conflict such as existing pending request or active loan.
- `429`
  Rate-limited request.
- `500`
  Unexpected backend failure.

Validation errors return a `VALIDATION_ERROR` payload with issue details.
