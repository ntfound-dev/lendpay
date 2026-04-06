# LendPay Frontend

The frontend is a React + Vite borrower console for LendPay.

Its job is to:

- connect the wallet with InterwovenKit
- authenticate the borrower against the backend
- show live protocol state from the rollup
- submit Move transactions for Initia app credit, repayment, rewards, staking, and governance actions

## Technical Architecture

Main entry points:

- [`src/App.tsx`](./src/App.tsx): page orchestration, borrower state sync, and action handlers
- [`src/main.tsx`](./src/main.tsx): app bootstrap
- [`src/lib/api.ts`](./src/lib/api.ts): backend API client
- [`src/lib/move.ts`](./src/lib/move.ts): Move message builders for onchain transactions
- [`src/lib/auth.ts`](./src/lib/auth.ts): wallet challenge signing helpers
- [`src/lib/tx.ts`](./src/lib/tx.ts): tx hash extraction helpers
- [`src/config/env.ts`](./src/config/env.ts): runtime config mapping from Vite env vars
- [`src/config/chain.ts`](./src/config/chain.ts): chain definition wiring
- [`src/components`](./src/components): UI building blocks and page sections
- [`src/styles`](./src/styles): tokens and layout styling

Folder map:

- `components/layout`: shell, topbar, sidebar, mobile nav
- `components/ui`: reusable cards, badges, buttons
- `components/score`: score ring visualization
- `components/loans`: installment schedule display
- `components/shared`: identity and activity surfaces
- `lib`: API, Move tx, auth, formatting, tx helpers
- `config`: chain and environment config
- `types`: frontend domain contracts

## Runtime Flow

1. The user connects a wallet through InterwovenKit.
2. The app requests an auth challenge from the backend.
3. The wallet signs the challenge.
4. The frontend exchanges that signature for a backend session token.
5. The frontend loads score, requests, loans, rewards, campaigns, governance, and merchant data from the backend.
6. For onchain actions, the frontend builds `MsgExecute` payloads and submits them through the wallet.
7. After a transaction, the frontend asks the backend to resync borrower state from the rollup.

## Transaction Surface

The frontend submits wallet-signed Move transactions for:

- Initia app credit requests
- collateralized requests
- installment repayment
- claimable LEND
- point spending
- staking actions
- campaign claims
- governance actions

## Main Product Surfaces

- `Overview`: current borrower state and next actions
- `Analyze`: score output and agent signals
- `Request`: Initia app credit request flow
- `Repayment`: active app credit, repayment state, fees, and collateral status
- `Reputation`: rewards, claimable LEND, staking, and borrower perks
- `Ecosystem`: campaigns, governance, and app registry activity

## App Credit Flow

The request flow is not a generic loan form. It is built around:

- live Initia app selection
- optional live viral drop selection to sync request amount
- requested amount
- profile quote selection
- unsecured app credit as the default borrower path
- optional locked `LEND` collateral only for the advanced secured profile
- wallet-signed Move request submission

After approval, the borrower can use funded balance in the internal `viral_drop` module. That step mints a real onchain receipt object to the borrower wallet and gives the repayment surface a concrete proof-of-use.

The repayment surface then explains where funds go:

- approved amount
- app used
- wallet funding state
- receipt state after `viral_drop` purchase
- next due amount and due date
- collateral lock state when applicable

## Data Sources

The UI combines:

- backend session and product state
- wallet connection state from InterwovenKit
- onchain transaction submission through wallet signing
- backend-synced rollup views for loans, rewards, campaigns, merchants, and governance

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

## Deploy To Vercel

Recommended production split:

- frontend on Vercel
- backend on Railway

This frontend is already prepared for Vercel with:

- [vercel.json](./vercel.json)

Recommended Vercel settings:

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Important envs:

- `VITE_API_BASE_URL`
- `VITE_APPCHAIN_ID`
- `VITE_CHAIN_RPC_URL`
- `VITE_CHAIN_REST_URL`
- `VITE_CHAIN_INDEXER_URL`
- `VITE_PACKAGE_ADDRESS`
- `VITE_NATIVE_SYMBOL`

## Notes

- If `VITE_PACKAGE_ADDRESS` is missing, the UI can still work in partial preview mode, but live Move actions will be blocked.
- Vite uses `vite-plugin-node-polyfills` because `@initia/initia.js` and wallet tooling expect some Node globals in the browser.
- The recommended way to run the whole project is still from the repo root with `make up`.
