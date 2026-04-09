# Architecture

LendPay is split into four practical layers.

## Visual Overview

<figure class="docs-diagram docs-diagram--wide">
  <ArchitectureStackMermaid />
  <figcaption>
    The stack has one user-facing layer, one normalization and policy layer, one runtime layer, and one protocol-logic layer.
  </figcaption>
</figure>

## Borrower Flow

<figure class="docs-diagram docs-diagram--wide">
  <BorrowerFlowMermaid />
  <figcaption>
    The product should stay legible as one clean borrower path first: connect, authenticate, refresh profile, request credit, use it in an app, then repay and earn stronger access.
  </figcaption>
</figure>

## Frontend

The frontend is a React + Vite borrower console.

It handles:

- wallet connection through InterwovenKit
- signed backend session creation
- borrower state loading
- Move transaction submission
- product flows like request, repay, rewards, loyalty, ecosystem views, and the bridge-status surface

See [Frontend](/app/frontend) for details.

## Backend

The backend is a TypeScript service built with Fastify.

It handles:

- challenge-response wallet auth
- borrower profile reads
- AI-assisted underwriting
- mirrored request and loan state
- protocol reads
- bridge-route, liquidity, and MiniEVM mapping normalization
- operator-signed write flows

See [Backend](/app/backend) for details.

## Rollup

The rollup is the running MiniMove chain environment.

It handles:

- onchain execution of the published package
- RPC and REST endpoints
- persistent chain state
- block production and event history
- built-in oracle state on the rollup side
- onchain bridge-route and bridge-intent registry state

See [Rollup](/app/rollup) for details.

## Move Contract

The Move contract executes the actual credit protocol logic inside the rollup runtime.

It handles:

- requests and approvals
- repayments and fee settlement
- rewards and campaigns
- staking and governance
- app-linked purchase rails
- bridge metadata and user bridge intents for `LEND` exit routing

See [Move Contract](/app/smartcontract) and [Onchain Modules](/protocol/move-package) for details.

## Runtime Flow

1. The frontend connects the wallet and authenticates against the backend.
2. The backend loads mirrored and onchain borrower state.
3. The frontend signs and submits Move transactions.
4. The rollup executes the Move contract and updates chain state.
5. The backend resyncs the borrower state after chain updates.
6. The backend also merges onchain bridge-route metadata with MiniEVM lookup state and oracle references.
7. The UI reflects chain-backed product state instead of frontend-only guesses.
