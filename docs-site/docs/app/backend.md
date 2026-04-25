# Backend

The Go backend lives in `backend-go/` and acts as the normalization and policy layer between the frontend, PostgreSQL, and the Move rollup.

## What It Does

- issues and verifies wallet login challenges
- signs and validates session tokens
- hydrates borrower profile, username, referral, rewards, activity, and score state
- mirrors request, loan, activity, referral, and operator action data into PostgreSQL
- normalizes oracle, MiniEVM, username, and chain data into one borrower-facing API
- syncs onchain state after confirmed transactions
- gates operator and treasury-sensitive actions behind controlled auth

In short: the backend is session authority, product API, chain mirror, and policy gate in one service.

## Runtime Shape

The backend splits into two areas:

**Backed by PostgreSQL and live chain reads:**
- auth and session management
- borrower hydration (profile, score, rewards, referral)
- request creation and mirroring
- preview approval and live repayment confirmation
- protocol preview reads

**Preview-only (not yet wired to a live chain writer):**
- faucet claim
- several protocol and admin mutation routes

Live repayments work differently from preview:
- a wallet `txHash` is required
- the backend waits for rollup confirmation before marking the installment paid
- if the rollup has not yet updated, the backend returns a pending state so the UI shows "submitted" not "confirmed"

## Entry Points

**Startup:**
- `backend-go/cmd/server/main.go` — HTTP server lifecycle
- `backend-go/internal/app/server.go` — route registration and application workflows
- `backend-go/internal/app/config.go` — environment variable loading
- `backend-go/internal/app/db.go` — pgx pool, pooled vs direct URL resolution, schema bootstrap
- `backend-go/internal/app/bootstrap.sql` — embedded schema

**Supporting modules:**
- `auth.go` — challenge issuance, session signing, `personal_sign` verification
- `amino.go` — Amino signature fallback
- `rate_limit.go` — in-memory request throttling
- `oracle_client.go` — Connect oracle feed normalization
- `minievm_client.go` — MiniEVM metadata lookups
- `usernames_client.go` — Initia username resolution and rollup attestation
- `ollama_client.go` — AI provider integration
- `rollup_client.go` — rollup view and write helpers
- `models.go` — response and row types
- `errors.go` — consistent API error output

## API Surface

| Group | Routes |
| --- | --- |
| auth | challenge, verify, refresh, logout |
| borrower | `/me`, username, points, rewards sync, activity, faucet, referral |
| season | `/season` — public, returns season allocation and platform points |
| scores | current score, analyze, history |
| loans | requests, approvals, schedules, fees, repayment |
| leaderboard | top borrowers, repayers, referrers |
| protocol | profiles, campaigns, governance, merchants, liquidity route, tx lookup, viral-drop |
| admin | VIP publish/finalize, DEX preview actions |
| meta | health, chains, AI status, treasury preview, oracle feeds |

The frontend never rebuilds borrower state from raw chain calls. It talks to one backend surface that merges chain state, product state, and policy decisions into a single normalized response.

## Auth And Session Flow

1. Frontend requests a challenge.
2. Backend stores the challenge in memory for a short window.
3. Wallet signs using `personal_sign` (primary) or Amino (fallback).
4. Backend verifies the signed payload and runs `ensureUser`.
5. Backend issues a signed session token.
6. Frontend reuses that bearer token for all authenticated reads and actions.

Operator-only routes require `X-Operator-Token` instead.

First-load login can be heavier than a minimal stateless auth API because it may trigger borrower hydration and onchain sync.

## Borrower Data Model

PostgreSQL stores mirrored product state so the frontend reads one normalized borrower model.

Tables:
- `User` — profile, points, tier, LEND balances, referral info
- `Challenge` and `Session` — auth lifecycle
- `OracleSnapshot` — price snapshots
- `CreditScore` — score history with breakdown JSON
- `LoanRequest` and `Loan` — mirrored from onchain state
- `Activity` — feed items
- `OperatorAction` — audit trail
- `ReferralLink` — referral relationships

The mirror layer combines rollup views, product history, oracle snapshots, username identity state, and operator audit trails into one borrower model.

## Database And Pooling

The backend uses PostgreSQL through `pgxpool`.

- `schema` is extracted from `DATABASE_URL` and applied as `search_path` on every connection
- query execution uses simple protocol for pooler compatibility
- when `DATABASE_URL` looks pooled and `DIRECT_DATABASE_URL` exists, bootstrap and runtime switch to the direct URL automatically
- when only a pooled URL exists, schema bootstrap is skipped and the runtime stays in compatibility mode

This matters on hosts using PgCat-style poolers where prepared statement behavior causes hard-to-debug failures.

## Underwriting Model

The scoring path is policy-bounded:

- wallet and borrower signals shape the baseline
- AI provider health can be surfaced for diagnostics
- final score, APR, and limit are still constrained by backend policy

The backend produces a controlled credit estimate, not an unchecked model verdict.

## Operator Role

Borrowers request credit through the app. The backend prepares and mirrors request context. Treasury-sensitive actions stay behind controlled backend and onchain authority.

This keeps underwriting assistance, treasury control, and final approval separated rather than collapsed into one opaque automated step.

## Season Endpoint

`GET /api/v1/season` is a public route (no auth required) that returns:

- `seasonId` — current season number
- `seasonLendAllocation` — total LEND allocated for this season
- `totalPlatformPoints` — sum of all user points in the DB
- `pointsToLendRate` — `allocation / totalPoints`
- `seasonEndAt` — optional end date

Configured via `SEASON_ID`, `SEASON_LEND_ALLOCATION`, `SEASON_END_AT` env vars.

## Rate Limiting

In-memory, enabled by default.

| Bucket | Routes |
| --- | --- |
| auth | auth challenge and verify |
| AI | score analysis, agent guide |
| global | all GET routes |
| mutation | all non-GET routes |

Rate-limit headers are returned so the frontend can react gracefully.

## Environment

Canonical files:
```bash
backend-go/.env
backend-go/.env.example
```

Key variables: `DATABASE_URL`, `DIRECT_DATABASE_URL`, `JWT_SECRET`, `ROLLUP_REST_URL`, `ROLLUP_RPC_URL`, `ROLLUP_CHAIN_ID`, `LENDPAY_PACKAGE_ADDRESS`, `ENABLE_LIVE_ROLLUP_WRITES`, `SEASON_LEND_ALLOCATION`.

For the full list, see [Environment Reference](/reference/env).

## Local Development

```bash
cd backend-go
../scripts/go-bin.sh run ./cmd/server
```

Build and test:

```bash
cd backend-go
../scripts/go-bin.sh build ./...
../scripts/go-bin.sh test ./...
```

From repo root:

```bash
make up
make status
make down
```

## Railway Deploy

Key deploy files:
- `backend-go/Dockerfile`
- `backend-go/railway.json`

Recommended Railway setup without relying on Root Directory:

- Builder: `Dockerfile`
- Dockerfile Path: `deploy/railway/backend/Dockerfile`
- Watch Paths: `/backend-go/**`
- Healthcheck Path: `/api/v1/health`

Expected startup log: `[startup] go backend listening on 0.0.0.0:8080`

If Railway logs still mention `prisma.user.findUnique()` or `node_modules/@prisma/client`, the service is still attached to the old Node backend.

## Known Limits

- several protocol and admin mutation routes still return preview responses
- faucet claim is preview-only
- AI scoring is policy-bounded; model output is sanitized before becoming a stored score record
- most application logic lives in `server.go` and can be split further as the codebase grows
