# API Reference

Backend routes exposed by LendPay.

## Base URL

```
http://localhost:8080
```

All app routes are prefixed with `/api/v1`.

## Auth Model

| Class | Requirement |
| --- | --- |
| Public | No token required. Health, metadata, auth handshake, season. |
| Borrower | `Authorization: Bearer <session-token>` |
| Operator | `x-operator-token: <operator-token>` |

## Quick Start

### 1. Get a login challenge

```bash
curl -X POST http://localhost:8080/api/v1/auth/challenge \
  -H 'content-type: application/json' \
  -d '{ "address": "init1..." }'
```

Response:
```json
{
  "challengeId": "uuid",
  "message": "LendPay Login\n\nSign this message...",
  "expiresAt": "2026-04-09T12:00:00.000Z"
}
```

### 2. Sign and verify

```bash
curl -X POST http://localhost:8080/api/v1/auth/verify \
  -H 'content-type: application/json' \
  -d '{
    "address": "init1...",
    "challengeId": "uuid",
    "mode": "personal_sign",
    "message": "LendPay Login\n\nSign this message...",
    "signature": "0x..."
  }'
```

Returns `token` and `user`. Use `token` as the bearer token.

### 3. Call protected routes

```bash
curl http://localhost:8080/api/v1/me \
  -H 'Authorization: Bearer <session-token>'
```

## Behavior Notes

- `GET /api/v1/score` returns the latest cached score or generates one if none exists yet.
- Mutation routes that accept `txHash` wait for rollup confirmation before returning. If confirmation is not yet available, they return `TX_CONFIRMATION_PENDING`.
- Routes can return `preview` mode responses if the runtime is not broadcasting live chain writes.
- `POST /api/v1/agent/guide` accepts optional request/repay context in the body for richer guidance.

---

## Auth

### `POST /api/v1/auth/challenge`

Starts login. Stores a short-lived challenge and returns the message for wallet signing.

### `POST /api/v1/auth/verify`

Verifies the signed challenge, hydrates the borrower if needed, and issues a session token.

Body fields: `address`, `challengeId`, `mode`, `signature`, and optionally `message` or `signed` depending on signing mode.

### `POST /api/v1/auth/refresh`

Replaces an existing session with a fresh one. Requires `Authorization: Bearer`.

### `POST /api/v1/auth/logout`

Invalidates the current session. Requires `Authorization: Bearer`.

---

## Season (Public)

### `GET /api/v1/season`

Returns current season allocation data. No auth required.

```bash
curl http://localhost:8080/api/v1/season
```

Response:
```json
{
  "seasonId": 1,
  "seasonLendAllocation": 100000,
  "totalPlatformPoints": 291830,
  "pointsToLendRate": 0.3427,
  "seasonEndAt": "2026-06-30"
}
```

Used by the Loyalty Hub to show each user's estimated airdrop: `(user_points / totalPlatformPoints) × seasonLendAllocation`.

---

## Borrower

All routes require `Authorization: Bearer <session-token>`.

### `GET /api/v1/agent/guide`

Returns agent guidance for a given UI surface.

Query param: `surface` — `overview`, `analyze`, `request`, `loan`, `rewards`, `admin`

```bash
curl "http://localhost:8080/api/v1/agent/guide?surface=overview" \
  -H 'Authorization: Bearer <session-token>'
```

Response includes: `panelTitle`, `panelBody`, `recommendation`, `actionLabel`, `actionKey`, `confidence`, `checklist`.

### `POST /api/v1/agent/guide`

Use when the frontend has richer context (selected app, checkout state, etc).

```bash
curl -X POST http://localhost:8080/api/v1/agent/guide \
  -H 'content-type: application/json' \
  -H 'Authorization: Bearer <session-token>' \
  -d '{
    "surface": "request",
    "request": {
      "hasSelectedApp": true,
      "selectedAppLabel": "Initia Arcade",
      "checkoutReady": true,
      "monthlyPaymentUsd": 38.5
    }
  }'
```

### `GET /api/v1/me`

Returns the normalized borrower profile: username, identity flags, rewards, wallet, and collateral state.

### `GET /api/v1/me/username`

Lightweight identity payload: `address`, `username`.

### `POST /api/v1/me/username/refresh`

Forces a fresh username lookup from Initia L1 and rollup. When live writes are enabled and the wallet has a `.init` name on L1, this also attests the username into the LendPay rollup reputation state.

### `GET /api/v1/me/points`

Returns the rewards block: points, tier, LEND balances, streak, discount and boost counters.

### `POST /api/v1/me/rewards/sync`

Refreshes reward state after a reward-related onchain transaction.

```json
{ "txHash": "optional-chain-tx-hash" }
```

If `txHash` is supplied, the backend waits for rollup confirmation before returning. Returns `TX_CONFIRMATION_PENDING` if not yet confirmed.

### `GET /api/v1/me/activity`

Returns the borrower activity feed: score refreshes, loan activity, repayment updates, identity events.

### `GET /api/v1/me/faucet`

Returns faucet state: `canClaim`, `claimAmount`, `nextClaimAt`.

### `POST /api/v1/me/faucet/claim`

Claims the faucet. Preview-only in current runtime.

### `GET /api/v1/me/referral`

Returns referral state: code, referral list, points earned.

### `POST /api/v1/me/referral/apply`

```json
{ "code": "REFERRAL_CODE" }
```

Applies a referral code to the current borrower.

### `GET /api/v1/leaderboard`

Returns leaderboard: top borrowers, repayers, referrers, and rising stars. Includes `myRank` for each category.

---

## Score

All routes require `Authorization: Bearer <session-token>`.

### `GET /api/v1/score`

Returns the latest score. Generates one if none exists. Use for regular app loads.

### `POST /api/v1/score/analyze`

Forces a fresh underwriting pass with new oracle snapshot and updated summary.

```bash
curl -X POST http://localhost:8080/api/v1/score/analyze \
  -H 'Authorization: Bearer <session-token>'
```

The scoring engine is policy-bounded. AI can influence the draft, but final values are clamped by backend policy.

### `GET /api/v1/score/history`

Returns recent historical scores for trend views.

---

## Requests And Loans

All routes require `Authorization: Bearer <session-token>`.

### `GET /api/v1/loan-requests`

Returns the current borrower request list.

### `POST /api/v1/loan-requests`

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

If `txHash` is provided, the backend confirms the onchain request and syncs real chain state. Returns `TX_CONFIRMATION_PENDING` if the rollup cannot confirm yet.

### `GET /api/v1/loan-requests/:id`

Returns one request from the current borrower.

### `POST /api/v1/loan-requests/:id/review-demo`

Demo self-review flow. Only usable when `PREVIEW_APPROVAL_ENABLED=true`.

### `GET /api/v1/loans`

Returns current borrower loans.

### `GET /api/v1/loans/:id`

Returns one loan by ID.

### `GET /api/v1/loans/:id/schedule`

Returns the installment schedule.

### `GET /api/v1/loans/:id/fees`

Returns fee state. Returns `LOAN_FEES_UNAVAILABLE` if rollup data is unreachable.

### `POST /api/v1/loans/:id/repay`

```json
{ "txHash": "optional-chain-tx-hash" }
```

Live repayments require `txHash`. Backend waits for rollup confirmation. Returns `TX_CONFIRMATION_PENDING` or `REPAYMENT_TX_PENDING` if not yet confirmed.

---

## Protocol

All routes require `Authorization: Bearer <session-token>`.

### `GET /api/v1/protocol/profiles`

Returns credit profile quotes for the current borrower: qualification, max principal, tenor cap, collateral requirements.

### `GET /api/v1/protocol/campaigns`

Returns campaign state.

### `GET /api/v1/protocol/governance`

Returns governance proposals and voting state.

### `GET /api/v1/protocol/merchants`

Returns merchant and app route metadata.

### `GET /api/v1/protocol/tx/:hash`

Returns transaction details from the rollup when resolvable.

### `GET /api/v1/protocol/viral-drop/items`

Returns available viral drop items.

### `GET /api/v1/protocol/viral-drop/purchases`

Returns borrower viral drop purchases.

### `GET /api/v1/protocol/liquidity/lend`

Returns the `LEND` liquidity route state.

Key fields:
- `routeRegistry` — `onchain` if resolved from `bridge.move`, otherwise `derived`
- `destinationDenom` — e.g. `erc20/LEND`
- `liquidityVenue` — e.g. `InitiaDEX`
- `poolReference` — e.g. `LEND/INIT`
- `liquidityStatus` — `unknown` | `coming_soon` | `live` | `paused`
- `swapEnabled` — whether the destination swap should be shown to users
- `sellReady` — `true` only when live, mapped, and destination venue is ready

Current `lendpay-4` state: `routeRegistry: onchain`, `liquidityStatus: coming_soon`, `swapEnabled: false`.

---

## Operator-Gated

All routes require `x-operator-token: <operator-token>`.

### `POST /api/v1/loan-requests/:id/approve`

```json
{ "reason": "Policy check passed" }
```

Approves a pending request. Broadcasts to the rollup when live writes are enabled.

### `POST /api/v1/protocol/campaigns`

```json
{
  "phase": 1,
  "totalAllocation": 100000,
  "requiresUsername": false,
  "minimumPlatformActions": 0
}
```

Creates a new campaign.

### `POST /api/v1/protocol/campaigns/:id/allocations`

```json
{ "userAddress": "init1...", "amount": 1000 }
```

Allocates campaign rewards to a borrower.

### `POST /api/v1/protocol/campaigns/:id/close`

Closes a campaign.

### `POST /api/v1/protocol/governance/proposals`

```json
{
  "proposalType": 1,
  "title": "Example proposal",
  "body": "Detailed proposal body"
}
```

### `POST /api/v1/protocol/governance/:id/vote`

```json
{ "support": true }
```

### `POST /api/v1/protocol/governance/:id/finalize`

Finalizes a proposal after the voting period.

### `POST /api/v1/protocol/merchants`

```json
{
  "merchantAddress": "init1...",
  "category": "marketplace",
  "listingFeeBps": 100,
  "partnerFeeBps": 500
}
```

### `POST /api/v1/protocol/merchants/:id/active`

```json
{ "active": true }
```

Enables or disables a merchant route.

---

## Meta (Public)

### `GET /api/v1/health`

Health check and local stack readiness.

### `GET /api/v1/meta/chains`

Returns configured chain endpoints: L1 REST, rollup REST, rollup RPC, rollup chain ID.

### `GET /api/v1/meta/connect-feeds`

Returns supported Connect oracle feed pairs.

### `GET /api/v1/meta/treasury`

Returns treasury state from the runtime integration.

### `GET /api/v1/meta/ai`

Returns AI provider status. Use to check whether the Ollama-backed analysis path is reachable.

### `GET /api/v1/meta/metrics`

Returns expvar JSON metrics. Repay counters appear under `repay`: `confirmed_total`, `pending_total`.

---

## Error Codes

| Status | Meaning |
| --- | --- |
| `400` | Validation or business-rule error |
| `401` | Missing or invalid auth |
| `403` | Operator-only or preview-disabled route |
| `404` | Missing borrower, request, loan, or object |
| `409` | Conflict — existing pending request or active loan |
| `429` | Rate limited |
| `500` | Unexpected backend failure |

Validation errors return a `VALIDATION_ERROR` payload with issue details.
