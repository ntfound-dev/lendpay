# Frontend

The frontend is a React + Vite borrower console for the LendPay MiniMove appchain.

## Responsibilities

- connect the wallet through InterwovenKit
- authenticate against the backend with a signed challenge
- load borrower, rewards, loan, campaign, and ecosystem state
- submit Move transactions for request, repay, rewards, campaign, and governance actions
- present borrower, operator, and technical surfaces

## Main Entry Points

- `src/main.tsx`: app bootstrap, QueryClient, Wagmi, and InterwovenKit provider wiring
- `src/App.tsx`: page orchestration, borrower sync, toasts, and transaction actions
- `src/config/env.ts`: runtime config from Vite env variables
- `src/config/chain.ts`: custom chain config for InterwovenKit
- `src/lib/api.ts`: backend API client
- `src/lib/move.ts`: Move `MsgExecute` builders

## Product Surfaces

- `Overview`
- `Profile`
- `Request`
- `Repay`
- `Loyalty Hub`
- `Ecosystem`

## Transaction Model

InterwovenKit is the primary transaction handler.

The app uses `requestTxBlock` and wraps it with timeout and recovery UI so a stuck extension does not trap the user in an endless loading state.

## Modes

- Operator mode: `?operator=1` or `#operator`
- Technical mode: `?technical=1` or `#technical`

These surface extra tooling without changing the main borrower journey.
