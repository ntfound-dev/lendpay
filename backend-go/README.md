# LendPay Backend

Go backend for the LendPay Move rollup.

This service sits between the frontend and the rollup. It handles wallet auth, borrower hydration, normalized product reads, score generation, Postgres-backed mirrors, and operator-gated preview actions.

## What It Does

- issues wallet login challenges and verifies signed responses
- creates and validates signed session tokens
- hydrates borrower profile, username, referral, rewards, activity, and score state
- stores mirrored request, loan, activity, referral, and operator action data in PostgreSQL
- exposes protocol, liquidity, and admin preview routes used by the frontend
- normalizes pooled vs direct Postgres connections for providers such as PgCat-style poolers

## Current Runtime Shape

The backend is intentionally split into:

- live-ish borrower and product APIs backed by Postgres
- preview protocol/admin flows for actions that are not yet wired to a real chain writer

Practical meaning:

- borrower auth, reads, request creation, review-demo approval, repayment mirrors, and score paths are active in Go
- several operator and protocol write routes still return preview responses rather than broadcasting onchain writes

## Code Layout

Main entry points:

- `cmd/server/main.go`
  Starts the HTTP server and wires startup lifecycle.
- `internal/app/server.go`
  Router, handlers, borrower workflows, and most application behavior.
- `internal/app/config.go`
  Environment loading and normalization.
- `internal/app/db.go`
  `pgx` pool setup, schema bootstrap, pooled/direct URL handling, and schema-aware SQL helpers.
- `internal/app/bootstrap.sql`
  Embedded schema used for first-run bootstrap.

Supporting modules:

- `internal/app/auth.go`
  Challenge issuance, session token signing, and personal-sign verification.
- `internal/app/amino.go`
  Amino signature verification fallback.
- `internal/app/rate_limit.go`
  In-memory request throttling.
- `internal/app/oracle_client.go`
  Connect oracle feed normalization.
- `internal/app/minievm_client.go`
  MiniEVM metadata lookups.
- `internal/app/usernames_client.go`
  Initia username integration.
- `internal/app/ollama_client.go`
  AI provider status checks.
- `internal/app/models.go`
  Response shapes, row models, and helpers.
- `internal/app/errors.go`
  API error shape and write helpers.

## API Surface

Auth:

- `POST /api/v1/auth/challenge`
- `POST /api/v1/auth/verify`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

Borrower:

- `GET /api/v1/me`
- `GET /api/v1/me/username`
- `POST /api/v1/me/username/refresh`
- `GET /api/v1/me/points`
- `POST /api/v1/me/rewards/sync`
- `GET /api/v1/me/activity`
- `GET /api/v1/me/faucet`
- `POST /api/v1/me/faucet/claim`
- `GET /api/v1/me/referral`
- `POST /api/v1/me/referral/apply`
- `GET /api/v1/leaderboard`

Scores:

- `GET /api/v1/score`
- `POST /api/v1/score/analyze`
- `GET /api/v1/score/history`

Loans:

- `GET /api/v1/loan-requests`
- `POST /api/v1/loan-requests`
- `GET /api/v1/loan-requests/{id}`
- `POST /api/v1/loan-requests/{id}/approve`
- `POST /api/v1/loan-requests/{id}/review-demo`
- `GET /api/v1/loans`
- `GET /api/v1/loans/{id}`
- `GET /api/v1/loans/{id}/schedule`
- `GET /api/v1/loans/{id}/fees`
- `POST /api/v1/loans/{id}/repay`

Protocol and meta:

- `GET /api/v1/protocol/profiles`
- `GET /api/v1/protocol/campaigns`
- `GET /api/v1/protocol/governance`
- `GET /api/v1/protocol/merchants`
- `GET /api/v1/protocol/tx/{hash}`
- `GET /api/v1/protocol/viral-drop/items`
- `GET /api/v1/protocol/viral-drop/purchases`
- `GET /api/v1/protocol/liquidity/lend`
- `POST /api/v1/protocol/campaigns`
- `POST /api/v1/protocol/campaigns/{id}/allocations`
- `POST /api/v1/protocol/campaigns/{id}/close`
- `POST /api/v1/protocol/governance/proposals`
- `POST /api/v1/protocol/governance/{id}/vote`
- `POST /api/v1/protocol/governance/{id}/finalize`
- `POST /api/v1/protocol/merchants`
- `POST /api/v1/protocol/merchants/{id}/active`
- `GET /api/v1/meta/connect-feeds`
- `GET /api/v1/meta/treasury`
- `GET /api/v1/meta/ai`
- `GET /api/v1/meta/chains`
- `GET /api/v1/health`

Admin preview:

- `POST /api/v1/admin/vip/stages/{stage}/publish`
- `POST /api/v1/admin/vip/stages/{stage}/finalize`
- `POST /api/v1/admin/dex/simulate`
- `POST /api/v1/admin/dex/rebalance`

Compatibility routes:

- `GET /indexer/tx/v1/txs/by_account/{address}`
- `GET /indexer/nft/v1/tokens/by_account/{address}`

## Auth Model

Login flow:

1. frontend requests a challenge
2. backend stores it in memory for a short window
3. wallet signs the challenge using `personal_sign` or Amino
4. backend verifies the signature and hydrates the borrower
5. backend issues a signed session token
6. frontend reuses that bearer token for authenticated routes

Important notes:

- `personal_sign` is the default path
- Amino fallback is supported in Go
- `AUTH_ACCEPT_ANY_SIGNATURE=true` exists only as a development escape hatch
- operator-only routes require `X-Operator-Token`

## Database Model

The backend uses PostgreSQL through `pgxpool` and bootstraps schema from `internal/app/bootstrap.sql`.

Key tables:

- `User`
- `Challenge`
- `Session`
- `OracleSnapshot`
- `CreditScore`
- `LoanRequest`
- `Loan`
- `Activity`
- `OperatorAction`
- `ReferralLink`

Database behavior:

- the backend extracts `schema` from `DATABASE_URL`
- every connection sets `search_path` to that schema
- query execution uses simple protocol for pooler compatibility
- when `DATABASE_URL` looks pooled and `DIRECT_DATABASE_URL` exists, runtime and bootstrap switch to the direct URL automatically
- when only a pooled URL exists, bootstrap is skipped and runtime stays in compatibility mode

## Rate Limiting

Rate limiting is in-memory and enabled by default.

Buckets:

- auth routes use `RATE_LIMIT_AUTH_MAX_REQUESTS`
- AI and score-analysis routes use `RATE_LIMIT_AI_MAX_REQUESTS`
- GET requests use `RATE_LIMIT_GLOBAL_MAX_REQUESTS`
- mutations use `RATE_LIMIT_MUTATION_MAX_REQUESTS`

Headers returned:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` when limited

## Environment

Canonical env file:

```bash
backend-go/.env
backend-go/.env.example
```

Most important variables:

- `PORT`
- `APP_ENV`
- `CORS_ORIGIN`
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `JWT_SECRET`
- `JWT_TTL_SECONDS`
- `RATE_LIMIT_ENABLED`
- `PREVIEW_OPERATOR_TOKEN`
- `ROLLUP_CHAIN_ID`
- `ROLLUP_RPC_URL`
- `ROLLUP_REST_URL`
- `ROLLUP_NATIVE_DENOM`
- `ROLLUP_NATIVE_SYMBOL`
- `INITIA_L1_REST_URL`
- `ENABLE_LIVE_INITIA_READS`
- `CONNECT_REST_URL`
- `CONNECT_BASE_CURRENCY`
- `CONNECT_QUOTE_CURRENCY`
- `MINIEVM_REST_URL`
- `MINIEVM_CHAIN_ID`
- `MINIEVM_CHAIN_NAME`
- `MINIEVM_LOOKUP_DENOM`
- `AI_PROVIDER`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `PREVIEW_APPROVAL_ENABLED`

Copy the example file and adjust values as needed:

```bash
cp backend-go/.env.example backend-go/.env
```

## Local Development

Run directly:

```bash
cd backend-go
../scripts/go-bin.sh run ./cmd/server
```

Build:

```bash
cd backend-go
../scripts/go-bin.sh build ./...
```

Test:

```bash
cd backend-go
../scripts/go-bin.sh test ./...
```

Or keep using the repo-level stack helpers:

```bash
make up
make status
make down
```

## Railway

Primary backend deploy files:

- Fallback repo-root Dockerfile: [`/Dockerfile`](../Dockerfile)
- Fallback repo-root Railway config: [`/railway.json`](../railway.json)
- Dockerfile: [`backend-go/Dockerfile`](./Dockerfile)
- Railway config: [`backend-go/railway.json`](./railway.json)

Monorepo deploy note:

- this repository contains multiple app surfaces, so the Railway backend service must point at `backend-go/`
- if Railway still shows old Node or Prisma startup logs, that service is still deploying the retired backend and not this Go service
- zero-config fallback from the repo root now works if Railway simply detects the repo-root Dockerfile:
  Root Directory: leave empty
  Dockerfile Path: `Dockerfile`
  Config-as-code: `/railway.json`
- preferred Railway setup without relying on Root Directory:
  Root Directory: leave empty
  Builder: `Dockerfile`
  Dockerfile Path: `deploy/railway/backend/Dockerfile`
  Watch Paths: `/backend-go/**`
  Healthcheck Path: `/api/v1/health`
  Config-as-code: `/deploy/railway/backend/railway.json`
- Railway CLI note:
  when manually deploying this monorepo from the repo root, prefer `railway up`
  without an explicit path argument; some CLI environments fail with `prefix not found`
  when called as `railway up .`
- alternative setup if you want the service rooted inside `backend-go/`:
  Root Directory: `backend-go`
  Dockerfile Path: `Dockerfile`
  Config-as-code: `/backend-go/railway.json`
- do not use `backend/Dockerfile`
- do not leave Root Directory empty while pointing at `backend-go/Dockerfile`, because that Dockerfile expects the build context to already be `backend-go/`
- expected healthy Go startup logs include:
  `[startup] go backend listening on 0.0.0.0:8080`
  `/api/v1/health`

## Compatibility Notes

- `backend-go/` is the single active backend implementation
- local scripts and docs now treat `backend-go` as the canonical backend

## Known Limits

- several protocol and admin mutations still return preview responses
- faucet claim remains preview-only
- AI integration is currently used for provider/status behavior, while scoring remains policy-bounded and deterministic
- the main application logic still lives in `internal/app/server.go` and can be split further as the codebase grows
