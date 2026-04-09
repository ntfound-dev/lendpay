# LendPay Backend

TypeScript Fastify service for the LendPay Move rollup.

The backend sits between the frontend and the chain. It handles wallet auth, borrower state aggregation, score generation, mirrored request and loan state, operator-only protocol actions, and rollup-facing reads and writes.

## What It Does

- issues wallet login challenges and verifies signed responses
- returns borrower profile, rewards, username, faucet, referral, leaderboard, score, and activity data
- mirrors request and loan state into PostgreSQL for fast product reads
- pulls live protocol state from the rollup, Initia L1 usernames, Connect oracle feeds, and MiniEVM metadata
- runs deterministic underwriting with optional Ollama assistance
- accepts onchain tx hashes from the frontend and resyncs local product state after those actions land

## Stack

- Node.js 20+
- Fastify
- Prisma
- PostgreSQL
- `@initia/initia.js`
- Zod
- optional Ollama integration for local AI scoring

## Main Files

Entry and composition:

- [`src/server.ts`](./src/server.ts): starts the HTTP server
- [`src/app.ts`](./src/app.ts): composes Fastify, services, routes, CORS, rate limiting, and error handling
- [`src/config/env.ts`](./src/config/env.ts): runtime config and production safety checks
- [`src/db/prisma.ts`](./src/db/prisma.ts): Prisma client bootstrap

Integrations:

- [`src/integrations/rollup/client.ts`](./src/integrations/rollup/client.ts): Move rollup reads and operator tx writes
- [`src/integrations/connect/oracle.ts`](./src/integrations/connect/oracle.ts): price feed normalization
- [`src/integrations/l1/usernames.ts`](./src/integrations/l1/usernames.ts): `.init` username resolution
- [`src/integrations/minievm/client.ts`](./src/integrations/minievm/client.ts): MiniEVM asset and routing lookups
- [`src/integrations/ai/ollama.ts`](./src/integrations/ai/ollama.ts): local model adapter

Modules:

- [`src/modules/auth`](./src/modules/auth): challenge-response auth and operator checks
- [`src/modules/users`](./src/modules/users): borrower profile, rewards, faucet, referral, leaderboard, username sync
- [`src/modules/scores`](./src/modules/scores): policy and score generation
- [`src/modules/loans`](./src/modules/loans): request creation, approval, mirror sync, schedules, fees
- [`src/modules/repayments`](./src/modules/repayments): repayment sync and idempotent repay handling
- [`src/modules/protocol`](./src/modules/protocol): profiles, campaigns, governance, merchants, viral drop, liquidity, tx details
- [`src/modules/activity`](./src/modules/activity): timeline feed
- [`src/modules/admin`](./src/modules/admin): scaffolded admin endpoints

Utilities:

- [`src/lib/session-token.ts`](./src/lib/session-token.ts): signed stateless session tokens
- [`src/lib/rate-limit.ts`](./src/lib/rate-limit.ts): in-memory request throttling rules
- [`src/lib/ids.ts`](./src/lib/ids.ts): prefixed UUIDs and preview tx hash generation

## Auth Model

Current auth flow:

1. `POST /api/v1/auth/challenge` issues a short-lived challenge.
2. The frontend signs it, preferring plain-text signing and falling back to Amino when needed.
3. `POST /api/v1/auth/verify` validates the signature and returns a signed session token.
4. Authenticated routes call `requireSession()` to verify the bearer token.

Important details:

- new sessions are stateless signed tokens, so normal authenticated requests do not need a database lookup just to authorize the user
- legacy DB-backed session tokens are still accepted as a compatibility fallback
- operator-only actions still use `x-operator-token`

## Request and Sync Model

- PostgreSQL stores mirrored product state for fast reads
- the rollup remains the source of truth for protocol state
- after request, approval, repayment, reward sync, or wallet-triggered activity, the backend resyncs from chain-facing integrations so the UI does not rely on optimistic guesses
- borrower mirror syncs are deduped and cached briefly to reduce duplicate work during dashboard bursts

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
- `GET /api/v1/loan-requests/:id`
- `POST /api/v1/loan-requests/:id/approve`
- `POST /api/v1/loan-requests/:id/review-demo`
- `GET /api/v1/loans`
- `GET /api/v1/loans/:id`
- `GET /api/v1/loans/:id/schedule`
- `GET /api/v1/loans/:id/fees`
- `POST /api/v1/loans/:id/repay`

Protocol:

- `GET /api/v1/protocol/profiles`
- `GET /api/v1/protocol/campaigns`
- `GET /api/v1/protocol/governance`
- `GET /api/v1/protocol/merchants`
- `GET /api/v1/protocol/tx/:hash`
- `GET /api/v1/protocol/viral-drop/items`
- `GET /api/v1/protocol/viral-drop/purchases`
- `GET /api/v1/protocol/liquidity/lend`
- `POST /api/v1/protocol/campaigns`
- `POST /api/v1/protocol/campaigns/:id/allocations`
- `POST /api/v1/protocol/campaigns/:id/close`
- `POST /api/v1/protocol/governance/proposals`
- `POST /api/v1/protocol/governance/:id/vote`
- `POST /api/v1/protocol/governance/:id/finalize`
- `POST /api/v1/protocol/merchants`
- `POST /api/v1/protocol/merchants/:id/active`

Admin scaffolds:

- `POST /api/v1/admin/vip/stages/:stage/publish`
- `POST /api/v1/admin/vip/stages/:stage/finalize`
- `POST /api/v1/admin/dex/simulate`
- `POST /api/v1/admin/dex/rebalance`

Meta and compatibility:

- `GET /api/v1/health`
- `GET /api/v1/meta/connect-feeds`
- `GET /api/v1/meta/treasury`
- `GET /api/v1/meta/ai`
- `GET /api/v1/meta/chains`
- `GET /indexer/tx/v1/txs/by_account/:address`
- `GET /indexer/nft/v1/tokens/by_account/:address`

## Safety and Production Notes

- production boot now fails fast if `DATABASE_URL` still points to SQLite
- request throttling is enabled by default for auth, AI scoring, writes, and general reads
- ID generation for mirrored records and preview tx hashes no longer relies on `Date.now()` alone
- public admin actions are intentionally gated behind `x-operator-token`

## Scripts

- `npm run dev`: watches `src/server.ts` and auto-pushes schema first
- `npm run db:generate`: regenerates Prisma client
- `npm run db:push`: syncs Prisma schema to the configured database
- `npm run db:migrate`: Prisma dev migration command
- `npm run check`: TypeScript check only
- `npm run build`: compiles to `dist`
- `npm run start`: runs the compiled server
- `npm run smoke`: end-to-end backend smoke flow

## Environment

Copy `.env.example` to `.env`.

Core:

- `PORT`
- `APP_ENV`
- `CORS_ORIGIN`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_TTL_SECONDS`

Rate limiting:

- `RATE_LIMIT_ENABLED`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_GLOBAL_MAX_REQUESTS`
- `RATE_LIMIT_MUTATION_MAX_REQUESTS`
- `RATE_LIMIT_AUTH_MAX_REQUESTS`
- `RATE_LIMIT_AI_MAX_REQUESTS`

Rollup and protocol:

- `ROLLUP_CHAIN_ID`
- `ROLLUP_RPC_URL`
- `ROLLUP_REST_URL`
- `ROLLUP_GAS_PRICES`
- `ROLLUP_GAS_ADJUSTMENT`
- `MINITIAD_BIN`
- `ROLLUP_HOME`
- `ROLLUP_KEY_NAME`
- `ROLLUP_KEYRING_BACKEND`
- `ROLLUP_OPERATOR_MNEMONIC`
- `ROLLUP_NATIVE_DENOM`
- `ROLLUP_NATIVE_SYMBOL`
- `LENDPAY_PACKAGE_ADDRESS`
- `LOAN_MODULE_NAME`
- `REQUEST_FUNCTION_NAME`
- `APPROVE_FUNCTION_NAME`
- `REPAY_FUNCTION_NAME`

Identity, oracle, and MiniEVM:

- `INITIA_L1_REST_URL`
- `INITIA_L1_RPC_URL`
- `ENABLE_LIVE_INITIA_READS`
- `CONNECT_REST_URL`
- `CONNECT_BASE_CURRENCY`
- `CONNECT_QUOTE_CURRENCY`
- `MINIEVM_REST_URL`
- `MINIEVM_CHAIN_ID`
- `MINIEVM_CHAIN_NAME`
- `MINIEVM_LOOKUP_DENOM`
- `USERNAMES_MODULE_ADDRESS`
- `USERNAMES_MODULE_NAME`

AI and preview controls:

- `AI_PROVIDER`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `OLLAMA_TIMEOUT_MS`
- `OLLAMA_TEMPERATURE`
- `AUTH_ACCEPT_ANY_SIGNATURE`
- `PREVIEW_OPERATOR_TOKEN`
- `PREVIEW_APPROVAL_ENABLED`

## Local Development

The easiest full-stack path is from the repo root:

```bash
make up
```

That starts:

- PostgreSQL on `127.0.0.1:55432`
- rollup RPC and REST
- backend on `127.0.0.1:8080`
- frontend on `127.0.0.1:5173`
- docs on `127.0.0.1:4173`

It does not start the Rapid relayer or OPinit bots. Having `LEND` on the rollup is not enough by itself for the built-in oracle path, because the bridge also depends on funded system keys and running services on the L1 side. Backend reads can still succeed from Connect REST while Move calls that depend on the rollup built-in oracle may fail or return empty local oracle state until those services are configured separately.

If you only want the backend:

```bash
cd ..
docker compose -f docker-compose.local-stack.yml up -d postgres
cd backend
npm install
npm run db:generate
npm run db:push
npm run dev
```

Default local database URL:

```bash
postgresql://postgres:postgres@127.0.0.1:55432/lendpay_dev?schema=public
```

## Smoke Test

Run:

```bash
npm run smoke
```

The smoke test now uses a dedicated PostgreSQL schema inside `lendpay_dev`, so it does not overwrite the main local schema. If the live rollup does not return any qualified profile for the temporary wallet, the script still verifies auth, scoring, and borrower read paths and marks request flow as skipped instead of failing the whole run for a false-negative product condition.

## Deployment

Recommended split:

- frontend on Vercel
- backend on Railway

Files already included:

- [Dockerfile](./Dockerfile)
- [railway.json](./railway.json)

Recommended Railway setup:

- Root Directory: `backend`
- Managed PostgreSQL attached to the service
- `DATABASE_URL=postgresql://...`
- `PORT=8080`
- real rollup URLs and operator secrets

Container start command:

```bash
npm run db:push && node dist/server.js
```
