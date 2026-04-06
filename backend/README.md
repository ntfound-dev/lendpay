# LendPay Backend

The backend is a TypeScript service that bridges the frontend and the Move rollup.

It is responsible for:

- wallet-based authentication
- borrower profile reads
- AI-assisted underwriting
- request and loan mirrors
- protocol reads from the rollup
- operator-signed admin and approval actions

## Technical Architecture

Main entry points:

- [`src/server.ts`](./src/server.ts): process entry
- [`src/app.ts`](./src/app.ts): Fastify app composition
- [`src/config/env.ts`](./src/config/env.ts): runtime configuration
- [`src/db/prisma.ts`](./src/db/prisma.ts): Prisma client
- [`src/integrations/rollup/client.ts`](./src/integrations/rollup/client.ts): rollup read/write adapter
- [`src/integrations/ai/ollama.ts`](./src/integrations/ai/ollama.ts): local Ollama integration
- [`src/integrations/connect/oracle.ts`](./src/integrations/connect/oracle.ts): price normalization input
- [`src/integrations/l1/usernames.ts`](./src/integrations/l1/usernames.ts): Initia username lookups

Core modules:

- [`src/modules/auth`](./src/modules/auth): challenge-response wallet auth
- [`src/modules/users`](./src/modules/users): borrower profile and wallet state
- [`src/modules/scores`](./src/modules/scores): scoring agent and policy output
- [`src/modules/loans`](./src/modules/loans): request and loan orchestration
- [`src/modules/protocol`](./src/modules/protocol): campaigns, apps, viral drop reads, governance, and profile quotes
- [`src/modules/activity`](./src/modules/activity): activity timeline

## API Surface

Main routes:

- `POST /api/v1/auth/challenge`
- `POST /api/v1/auth/verify`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`
- `GET /api/v1/me/username`
- `POST /api/v1/me/username/refresh`
- `GET /api/v1/me/points`
- `POST /api/v1/me/rewards/sync`
- `GET /api/v1/me/activity`
- `GET /api/v1/score`
- `POST /api/v1/score/analyze`
- `GET /api/v1/score/history`
- `GET /api/v1/loan-requests`
- `POST /api/v1/loan-requests`
- `POST /api/v1/loan-requests/:id/approve`
- `GET /api/v1/loans`
- `GET /api/v1/loans/:id`
- `GET /api/v1/loans/:id/schedule`
- `GET /api/v1/loans/:id/fees`
- `POST /api/v1/loans/:id/repay`
- `GET /api/v1/protocol/profiles`
- `GET /api/v1/protocol/campaigns`
- `GET /api/v1/protocol/governance`
- `GET /api/v1/protocol/merchants`
- `GET /api/v1/protocol/viral-drop/items`
- `GET /api/v1/protocol/viral-drop/purchases`
- `POST /api/v1/protocol/campaigns`
- `POST /api/v1/protocol/campaigns/:id/allocations`
- `POST /api/v1/protocol/campaigns/:id/close`
- `POST /api/v1/protocol/governance/proposals`
- `POST /api/v1/protocol/governance/:id/vote`
- `POST /api/v1/protocol/governance/:id/finalize`
- `POST /api/v1/protocol/merchants`
- `POST /api/v1/protocol/merchants/:id/active`

Meta routes:

- `GET /api/v1/health`
- `GET /api/v1/meta/connect-feeds`
- `GET /api/v1/meta/treasury`
- `GET /api/v1/meta/ai`
- `GET /api/v1/meta/chains`

## Runtime Flow

1. The frontend asks for a challenge.
2. The backend generates a challenge and stores it.
3. The wallet signs the challenge.
4. The backend verifies the signature and creates a session.
5. Borrower state is loaded from:
   - Prisma for mirrored product data
   - rollup views for onchain state
   - username and pricing integrations for identity and normalization
6. When the borrower requests credit, the backend stores a mirrored request record and can optionally auto-approve through the operator flow.
7. After every important transaction, the backend resyncs from the rollup so the UI reflects chain state instead of local guesses.

## Operator Flow

Operator-gated actions use `x-operator-token` and can drive:

- request approval
- campaign creation, allocation, and close
- governance propose, vote, and finalize
- merchant registration and active state changes

Some admin endpoints are intentionally still scaffolds:

- VIP publish/finalize
- DEX simulate/rebalance

## AI Underwriting

The scoring path is hybrid:

- deterministic signal collection from wallet, identity, holdings, streak, and repayment behavior
- optional local Ollama analysis through [`src/integrations/ai/ollama.ts`](./src/integrations/ai/ollama.ts)
- a final policy layer that clamps score, APR, and credit limit into safe product bounds

This means the backend does not let the model make unchecked lending decisions.

## Data Layer

Prisma is used for:

- sessions
- activity history
- mirrored loan requests
- mirrored loans
- score snapshots
- fast product reads for the frontend

Onchain state remains the source of truth for protocol state.

## Scripts

- `npm run dev`: local backend with schema push
- `npm run db:push`: sync Prisma schema
- `npm run db:generate`: regenerate Prisma client
- `npm run smoke`: run backend smoke flow
- `npm run build`: compile backend
- `npm run check`: typecheck only

## Environment

Copy `.env.example` to `.env`.

Important envs include:

- `PORT`
- `DATABASE_URL`
- `ROLLUP_CHAIN_ID`
- `ROLLUP_RPC_URL`
- `ROLLUP_REST_URL`
- `ROLLUP_PACKAGE_ADDRESS`
- `ROLLUP_OPERATOR_MNEMONIC`
- `ENABLE_LIVE_ROLLUP_WRITES`
- `PREVIEW_OPERATOR_TOKEN`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

## Run Backend Only

```bash
npm install
npm run dev
```

## Database

Push schema locally:

```bash
npm run db:push
```

## Smoke Test

```bash
npm run smoke
```

## Build

```bash
npm run build
```

## Deploy To Railway

Recommended production split:

- frontend on Vercel
- backend on Railway

This backend is already prepared for Railway with:

- [Dockerfile](./Dockerfile)
- [railway.json](./railway.json)

Recommended Railway settings:

- Root Directory: `backend`
- Add a persistent volume mounted at `/data`
- Set `DATABASE_URL=file:/data/lendpay.db`
- Set `PORT=8080`
- Set real rollup envs for `ROLLUP_RPC_URL`, `ROLLUP_REST_URL`, and `ENABLE_LIVE_ROLLUP_WRITES`

The container start command runs:

```bash
npm run db:push && node dist/server.js
```

## Notes

- Live operator actions require `ENABLE_LIVE_ROLLUP_WRITES=true` and a valid `ROLLUP_OPERATOR_MNEMONIC`.
- Without live writes, the backend still serves reads and preview flows.
- The easiest full-stack way to run the project is from the repo root with `make up`.
