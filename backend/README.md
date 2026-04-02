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
- [`src/modules/protocol`](./src/modules/protocol): campaigns, merchants, governance, and profile quotes
- [`src/modules/activity`](./src/modules/activity): activity timeline

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

## Notes

- Live operator actions require `ENABLE_LIVE_ROLLUP_WRITES=true` and a valid `ROLLUP_OPERATOR_MNEMONIC`.
- Without live writes, the backend still serves reads and preview flows.
- The easiest full-stack way to run the project is from the repo root with `make up`.
