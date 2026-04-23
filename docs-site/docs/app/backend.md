# Backend

The backend bridges the frontend and the Move rollup.

It is now implemented in Go and lives in `backend-go/`.

Its job is not only to authenticate wallets. It is the normalization and policy layer between wallet UX, chain state, mirrored product state, and controlled operator flows.

## What The Backend Does

- issues wallet login challenges and verifies signed responses
- creates and validates signed session tokens
- hydrates borrower profile, username, referral, rewards, activity, and score state
- stores mirrored request, loan, activity, referral, and operator action data in PostgreSQL
- normalizes oracle, MiniEVM, and username data into one borrower-facing API
- exposes preview protocol and admin routes used by the frontend

So the backend is simultaneously:

- session authority
- product API
- chain mirror
- policy gate
- operator action boundary

## Current Runtime Shape

The Go backend is intentionally split into two broad areas:

- borrower and product APIs backed by PostgreSQL
- preview protocol and admin flows that are not yet wired to a full live chain writer

That means the current implementation is already useful for:

- auth
- borrower hydration
- score generation
- request creation
- review-demo approval
- repayment mirrors
- protocol preview reads

Live repayment confirmation now behaves differently from preview:

- live repayments require a wallet `txHash` and the backend waits for rollup confirmation before marking an installment as paid
- if the rollup state has not updated yet, the backend returns a pending response so the frontend can show “submitted” instead of “confirmed”
- preview repayments still update the mirrored schedule immediately

But some write paths still respond in preview mode rather than broadcasting real transactions.

## Main Entry Points

Core startup and runtime:

- `backend-go/cmd/server/main.go`
  Starts the HTTP server and lifecycle.
- `backend-go/internal/app/server.go`
  Registers routes and contains the main application workflows.
- `backend-go/internal/app/config.go`
  Loads and normalizes environment variables.
- `backend-go/internal/app/db.go`
  Creates the `pgx` pool, resolves pooled vs direct URLs, and bootstraps schema.
- `backend-go/internal/app/bootstrap.sql`
  Embedded SQL schema used on startup.

Supporting modules:

- `backend-go/internal/app/auth.go`
  Challenge issuance, session token signing, and `personal_sign` verification.
- `backend-go/internal/app/amino.go`
  Amino signature fallback verification.
- `backend-go/internal/app/rate_limit.go`
  In-memory request throttling.
- `backend-go/internal/app/oracle_client.go`
  Connect oracle feed normalization.
- `backend-go/internal/app/minievm_client.go`
  MiniEVM metadata lookups.
- `backend-go/internal/app/usernames_client.go`
  Initia username integration and refresh-time rollup attestation when live operator writes are enabled.
- `backend-go/internal/app/ollama_client.go`
  AI provider status integration.
- `backend-go/internal/app/models.go`
  Response and row shapes.
- `backend-go/internal/app/errors.go`
  Consistent API error output.

## API Surface

The backend exposes these route groups:

- auth
  Challenge, verify, refresh, logout.
- borrower
  `/me`, username refresh, points, rewards sync, activity, faucet, referral, leaderboard.
- scores
  Current score, analyze, history.
- loans
  Requests, approvals, schedules, fees, repayment.
- protocol
  Profiles, campaigns, governance, merchants, liquidity route, tx lookup, viral-drop previews.
- admin
  VIP publish/finalize and DEX preview actions.
- meta
  Health, chains, AI/provider status, treasury preview, connect feeds.

The exact route list is documented in the API reference, but the important architectural point is this:

- the frontend does not rebuild borrower state from raw chain calls
- it talks to one backend surface that merges chain state, product state, and policy decisions

## Auth And Session Flow

The session flow is:

1. frontend asks for a challenge
2. backend stores that challenge in memory for a short time
3. wallet signs the challenge using `personal_sign` or Amino
4. backend verifies the signed payload
5. backend hydrates or refreshes the borrower through `ensureUser`
6. backend issues a signed session token
7. frontend reuses that bearer token for authenticated reads and actions

Important details:

- login is not only a signature check
- it can trigger borrower hydration work
- `personal_sign` is the default path
- Amino fallback is supported in Go
- operator-only routes require `X-Operator-Token`

This is why first-load login can feel heavier than a minimal stateless auth API.

## Borrower Data Model

The backend keeps mirrored product state in PostgreSQL so the frontend can read one normalized borrower model instead of stitching together many sources.

Key mirrored tables:

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

This mirror layer lets the backend combine:

- rollup views
- product history
- oracle snapshots
- username identity state
- activity feed state
- operator audit trails

The result is one borrower model that is easier for the UI to consume and easier for the team to reason about.

## Database Bootstrap And Pooling

The backend uses PostgreSQL through `pgxpool`.

Important behavior:

- it extracts `schema` from `DATABASE_URL`
- every connection sets `search_path` to that schema
- query execution uses simple protocol for pooler compatibility
- when `DATABASE_URL` looks pooled and `DIRECT_DATABASE_URL` exists, runtime and bootstrap automatically switch to the direct URL
- when only a pooled URL exists, schema bootstrap is skipped and runtime stays in compatibility mode

This matters for hosts that use PgCat-style or similar poolers, where prepared statement behavior can otherwise cause hard-to-debug failures.

## Underwriting Model

The backend scoring path is policy-bounded.

In practical terms:

- wallet and borrower signals shape the baseline
- AI/provider health can be surfaced for diagnostics
- final score, APR, and limit are still constrained by backend policy

So the backend provides a controlled credit estimate, not an unchecked model verdict.

## Operator Role

The current prototype does not let the AI layer directly control disbursement.

Instead:

- borrowers request credit through the app
- backend prepares and mirrors the request context
- operator-style approval and admin rails still exist
- treasury-sensitive actions stay behind controlled backend and onchain authority

That separation is intentional.

It prevents underwriting assistance, treasury control, and final approval from collapsing into one opaque automated step.

## Rate Limiting

Rate limiting is in-memory and enabled by default.

Broad buckets:

- auth routes use the auth-specific limit
- score-analysis and AI-status routes use the AI bucket
- GET routes use the global read bucket
- non-GET routes use the mutation bucket

The backend returns standard rate-limit headers so the frontend can react gracefully when limits are hit.

## Environment And Configuration

Canonical backend env files:

```bash
backend-go/.env
backend-go/.env.example
```

Most important variables:

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `JWT_SECRET`
- `PREVIEW_OPERATOR_TOKEN`
- `ROLLUP_CHAIN_ID`
- `ROLLUP_RPC_URL`
- `ROLLUP_REST_URL`
- `ROLLUP_NATIVE_DENOM`
- `ROLLUP_NATIVE_SYMBOL`
- `INITIA_L1_REST_URL`
- `CONNECT_REST_URL`
- `MINIEVM_REST_URL`
- `AI_PROVIDER`
- `OLLAMA_BASE_URL`
- `PREVIEW_APPROVAL_ENABLED`

For the full env list, use the Environment Reference page.

## Local Development

Direct run:

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

Repo-level helpers still work:

```bash
make up
make status
make down
```

## Railway Deploy

Primary backend deploy files:

- `backend-go/Dockerfile`
- `backend-go/railway.json`

Monorepo deploy note:

- Railway must deploy the `backend-go/` service, not a retired Node or Prisma backend
- preferred Railway setup without relying on Root Directory:
  Root Directory: leave empty
  Builder: `Dockerfile`
  Dockerfile Path: `deploy/railway/backend/Dockerfile`
  Watch Paths: `/backend-go/**`
  Healthcheck Path: `/api/v1/health`
  Config-as-code: `/deploy/railway/backend/railway.json`
- alternative setup if the service is rooted inside `backend-go/`:
  Root Directory: `backend-go`
  Dockerfile Path: `Dockerfile`
  Config-as-code: `/backend-go/railway.json`
- do not use `backend/Dockerfile`
- do not leave Root Directory empty while pointing at `backend-go/Dockerfile`, because that Dockerfile expects the build context to already be `backend-go/`
- if Railway logs still mention Prisma, `prisma.user.findUnique()`, or `node_modules/@prisma/client`, the service is still attached to the old backend
- expected Go startup log:
  `[startup] go backend listening on 0.0.0.0:8080`

## Known Limits

- several protocol and admin mutation routes still return preview responses
- faucet claim remains preview-only
- AI integration is mainly used for provider/status behavior, while score calculation stays policy-bounded
- a large amount of application logic still lives in `internal/app/server.go` and can be split further as the codebase grows
