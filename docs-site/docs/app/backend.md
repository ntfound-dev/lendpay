# Backend

The backend bridges the frontend and the Move rollup.

It is the normalization and policy layer between wallet UX, onchain state, stored mirrors, and underwriting logic.

## Responsibilities

- wallet-based authentication
- borrower profile reads and hydration
- hybrid AI-assisted underwriting
- request and loan mirrors
- protocol reads from the rollup
- bridge-route and liquidity-route normalization
- identity, oracle, and activity normalization
- operator-signed admin and approval actions

## Main Entry Points

- `src/server.ts`: HTTP server bootstrap
- `src/app.ts`: dependency wiring and route registration
- `src/config/env.ts`: runtime configuration
- `src/db/prisma.ts`: Prisma client
- `src/modules/auth/service.ts`: challenge issuance, signature verification, and session lifecycle
- `src/modules/users/service.ts`: borrower hydration and normalized user profile reads
- `src/modules/scores/service.ts`: score retrieval, score generation, and provider status
- `src/integrations/rollup/client.ts`: rollup read and write integration layer
- `src/integrations/connect/oracle.ts`: official pricing reference integration
- `src/integrations/l1/usernames.ts`: Initia L1 username lookup

## Core Modules

- `auth`
- `users`
- `scores`
- `loans`
- `protocol`
- `activity`

## Auth And Session Flow

The backend session flow is:

1. frontend asks for a challenge
2. backend stores that challenge
3. wallet signs the challenge
4. backend verifies the payload and signature
5. backend hydrates or refreshes the borrower through `ensureUser`
6. backend issues a session token
7. frontend reuses that session for borrower reads and live actions

Important detail:

- backend login is not only a signature check
- it can also trigger borrower hydration work
- that is why first-load login can feel heavier than a simple stateless API auth flow

## Runtime Role

The backend exists so the frontend does not need to independently merge many sources of truth.

It combines:

- rollup views
- Prisma mirrors
- pricing snapshots
- username identity state
- bridge-route metadata and MiniEVM mapping state
- activity feed state
- operator-only action rails

The result is one borrower model that is easier for the UI to consume and easier for the team to reason about.

## Borrower Data Flow

Typical borrower load looks like this:

1. ensure the backend session exists
2. load the normalized user profile
3. load the latest score
4. load requests, loans, rewards, and ecosystem state
5. after an important transaction, trigger a backend resync

So the backend acts as:

- session authority
- chain mirror
- product API
- policy gate

## Bridge And Liquidity Route Model

The backend does not pretend the bridge is fully self-contained inside Move.

Instead it merges:

- the onchain `bridge` registry on the rollup
- MiniEVM denom-to-ERC20 lookup state
- official oracle or reference pricing

That is why the API can honestly distinguish between:

- route metadata already published onchain
- destination venue metadata already published onchain
- and the final sell route still waiting on the official MiniEVM mapping

## Operator Role

The current prototype does not let the AI model directly control disbursement.

In the current shape:

- borrowers request credit through the app
- backend prepares and mirrors the request context
- operator-style approval and admin rails still exist
- treasury-sensitive actions still rely on controlled backend and onchain authority

That separation is intentional.

It keeps underwriting assistance, treasury control, and final approval from collapsing into one opaque AI-driven step.

## Underwriting Model

The scoring path is hybrid:

- deterministic wallet and reputation signals
- optional local Ollama analysis
- final policy clamping for score, APR, and limit

## Why AI Is Not The Final Authority

The AI layer is useful, but it is not perfect and should not be treated as the final lender.

What the backend actually does:

- build a deterministic baseline from wallet, rewards, holdings, identity, and oracle context
- ask Ollama for a suggested score package when available
- fall back safely if Ollama is unavailable or returns incomplete output
- apply policy checks and exposure caps after the model output

Practical meaning:

- AI can shape the draft score
- AI does not get unchecked control over the final stored score
- the backend still applies hard policy boundaries before persisting the result

## Scoring Caveats

The current underwriting engine should be read as evolving, not final.

Important caveats:

- first-time score generation can be heavier because it depends on live borrower hydration
- held `LEND`, rewards, wallet signals, and identity still influence the score path in the current implementation
- repayment-led growth is a strategic direction, but the code is still transitional
- model quality depends on the available borrower data and local AI runtime health

So the right interpretation is:

- the backend provides a policy-bounded credit estimate
- not a perfect prediction
- and not a reason to remove operator or treasury controls
