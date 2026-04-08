# Backend

The backend bridges the frontend and the Move rollup.

## Responsibilities

- wallet-based authentication
- borrower profile reads
- hybrid AI-assisted underwriting
- request and loan mirrors
- protocol reads from the rollup
- operator-signed admin and approval actions

## Main Entry Points

- `src/server.ts`
- `src/app.ts`
- `src/config/env.ts`
- `src/db/prisma.ts`
- `src/integrations/rollup/client.ts`
- `src/integrations/connect/oracle.ts`
- `src/integrations/l1/usernames.ts`

## Core Modules

- `auth`
- `users`
- `scores`
- `loans`
- `protocol`
- `activity`

## Runtime Flow

1. Frontend asks for a challenge.
2. Backend stores a challenge.
3. Wallet signs the challenge.
4. Backend verifies the signature and issues a session.
5. Borrower state is loaded from Prisma plus rollup views.
6. After important transactions, backend resyncs from the rollup.

## Underwriting Model

The scoring path is hybrid:

- deterministic wallet and reputation signals
- optional local Ollama analysis
- final policy clamping for score, APR, and limit

This keeps AI in an advisory role instead of giving it unchecked lending authority.
