# LendPay Frontend

The frontend is a React + Vite borrower console for LendPay.

Its job is to:

- connect the wallet with InterwovenKit
- authenticate the borrower against the backend
- show live protocol state from the rollup
- submit Move transactions for checkout credit, repayment, rewards, staking, and governance actions

## Technical Architecture

Main entry points:

- [`src/App.tsx`](./src/App.tsx): page orchestration, borrower state sync, and action handlers
- [`src/lib/api.ts`](./src/lib/api.ts): backend API client
- [`src/lib/move.ts`](./src/lib/move.ts): Move message builders for onchain transactions
- [`src/config/env.ts`](./src/config/env.ts): runtime config mapping from Vite env vars
- [`src/components`](./src/components): UI building blocks and page sections
- [`src/styles`](./src/styles): tokens and layout styling

## Runtime Flow

1. The user connects a wallet through InterwovenKit.
2. The app requests an auth challenge from the backend.
3. The wallet signs the challenge.
4. The frontend exchanges that signature for a backend session token.
5. The frontend loads score, requests, loans, rewards, campaigns, governance, and merchant data from the backend.
6. For onchain actions, the frontend builds `MsgExecute` payloads and submits them through the wallet.
7. After a transaction, the frontend asks the backend to resync borrower state from the rollup.

## Main Product Surfaces

- `Overview`: current borrower state and next actions
- `Analyze`: score output and agent signals
- `Request`: merchant checkout credit request flow
- `Repayment`: active checkout loan, repayment state, fees, and collateral status
- `Reputation`: rewards, claimable LEND, staking, and borrower perks
- `Operations`: campaigns, governance, and merchant registry actions

## Merchant Checkout Flow

The request flow is not a generic loan form. It is built around:

- merchant selection
- checkout amount
- profile quote selection
- optional collateral requirements
- wallet-signed Move request submission

The repayment surface then explains where funds go:

- approved amount
- merchant destination
- wallet funding state
- next due amount and due date
- collateral lock state when applicable

## Environment

Copy `.env.example` to `.env`.

Important envs:

- `VITE_API_BASE_URL`
- `VITE_APPCHAIN_ID`
- `VITE_CHAIN_RPC_URL`
- `VITE_CHAIN_REST_URL`
- `VITE_CHAIN_INDEXER_URL`
- `VITE_NATIVE_DENOM`
- `VITE_NATIVE_SYMBOL`
- `VITE_PACKAGE_ADDRESS`
- `VITE_LOAN_MODULE_NAME`
- `VITE_REQUEST_FUNCTION_NAME`
- `VITE_REQUEST_COLLATERAL_FUNCTION_NAME`
- `VITE_REPAY_FUNCTION_NAME`
- `VITE_PREVIEW_OPERATOR_TOKEN`

## Run Frontend Only

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

- If `VITE_PACKAGE_ADDRESS` is missing, the UI can still work in partial preview mode, but live Move actions will be blocked.
- Vite uses `vite-plugin-node-polyfills` because `@initia/initia.js` and wallet tooling expect some Node globals in the browser.
- The recommended way to run the whole project is still from the repo root with `make up`.
