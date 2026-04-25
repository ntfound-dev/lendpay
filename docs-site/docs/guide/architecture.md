# Architecture

LendPay is split into four layers.

## Visual Overview

<figure class="docs-diagram">
  <ArchitectureStackMermaid />
  <figcaption>
    One user-facing layer, one normalization and policy layer, one chain runtime layer, one protocol-logic layer.
  </figcaption>
</figure>

## Borrower Flow

<figure class="docs-diagram">
  <BorrowerFlowMermaid />
  <figcaption>
    Connect → authenticate → refresh profile → request credit → use in an app → repay → earn stronger access.
  </figcaption>
</figure>

## Frontend

React + Vite borrower console.

Handles:
- wallet connection via InterwovenKit
- signed backend session
- borrower state loading and display
- Move transaction submission
- product flows: request, repay, rewards, loyalty hub, ecosystem, bridge status

See [Frontend](/app/frontend).

## Backend

Go service in `backend-go/`.

Handles:
- challenge-response wallet auth
- borrower profile hydration
- AI-assisted underwriting (policy-bounded)
- mirrored request and loan state in PostgreSQL
- protocol and bridge-route state normalization
- operator write flows
- season allocation data (`GET /api/v1/season`)

See [Backend](/app/backend).

## Rollup

Running MiniMove chain environment (`lendpay-4`).

Handles:
- onchain execution of the deployed package
- RPC and REST endpoints
- persistent chain state (loans, rewards, treasury, merchant routes)
- block production and event history
- built-in oracle state
- onchain bridge-route registry

See [Rollup](/app/rollup).

## Move Contract

Protocol logic inside the rollup runtime.

Handles:
- requests, approvals, repayments, fee settlement
- rewards, campaigns, staking, governance
- app-linked purchase rails (viral drop)
- bridge route metadata and user bridge intents

See [Move Contract](/app/smartcontract) and [Onchain Modules](/protocol/move-package).

## Runtime Flow

1. Frontend connects the wallet and authenticates against the backend.
2. Backend loads mirrored and onchain borrower state.
3. Frontend signs and submits Move transactions.
4. Rollup executes the Move contract and updates chain state.
5. Backend resyncs borrower state after the transaction confirms.
6. Backend merges onchain bridge-route metadata with MiniEVM and oracle state.
7. UI reflects chain-backed product state.
