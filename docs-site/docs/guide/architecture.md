# Architecture

LendPay is split into three layers.

## Frontend

The frontend is a React + Vite borrower console.

It handles:

- wallet connection through InterwovenKit
- signed backend session creation
- borrower state loading
- Move transaction submission
- product flows like request, repay, rewards, loyalty, and ecosystem views

See [Frontend](/app/frontend) for details.

## Backend

The backend is a TypeScript service built with Fastify.

It handles:

- challenge-response wallet auth
- borrower profile reads
- AI-assisted underwriting
- mirrored request and loan state
- protocol reads
- operator-signed write flows

See [Backend](/app/backend) for details.

## Move Package

The Move package executes the actual credit protocol logic.

It handles:

- requests and approvals
- repayments and fee settlement
- rewards and campaigns
- staking and governance
- app-linked purchase rails

See [Move Package](/protocol/move-package) for details.

## Runtime Flow

1. The frontend connects the wallet and authenticates against the backend.
2. The backend loads mirrored and onchain borrower state.
3. The frontend signs and submits Move transactions.
4. The backend resyncs the borrower state after chain updates.
5. The UI reflects chain-backed product state instead of frontend-only guesses.
