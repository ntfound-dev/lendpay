# LendPay Frontend

The frontend is a React + Vite borrower console for the LendPay MiniMove appchain.

It is responsible for:

- connecting the wallet through InterwovenKit
- authenticating the borrower against the backend with a signed challenge
- loading borrower, rewards, loan, campaign, and ecosystem state mirrored from the rollup
- submitting Move transactions through the wallet for request, repay, rewards, staking, campaign, and governance actions
- presenting operator and technical surfaces when those modes are enabled

## Stack

- React 19
- TypeScript
- Vite 7
- `@initia/interwovenkit-react`
- `@tanstack/react-query`
- `wagmi`
- `vite-plugin-node-polyfills`

`npm` is the expected package manager in this folder because the repo already includes `package-lock.json`.

## Product Surfaces

- `Overview`: borrower summary, safe-spend guidance, outstanding balance, claimable rewards, wallet balance, and recent activity
- `Profile`: score output, APR, tier, score breakdown, identity status, and refresh flow
- `Request`: app credit request flow, merchant selection, profile quote selection, and collateralized request path
- `Repay`: active loan, installment schedule, fees, viral drop purchase state, and collectible claim flow
- `Loyalty Hub`: claimable LEND, staking, referral, leaderboard, perks, and wallet recovery actions
- `Ecosystem`: campaigns, governance, merchant registry, proof explorer, and operator tooling

## Technical Architecture

Main entry points:

- [`src/main.tsx`](./src/main.tsx): React bootstrap, QueryClient, Wagmi, and InterwovenKit provider wiring
- [`src/App.tsx`](./src/App.tsx): page orchestration, borrower state sync, toast handling, and transaction actions
- [`src/config/env.ts`](./src/config/env.ts): runtime config mapped from Vite env vars
- [`src/config/chain.ts`](./src/config/chain.ts): custom chain definition passed to InterwovenKit
- [`src/lib/api.ts`](./src/lib/api.ts): backend API client
- [`src/lib/move.ts`](./src/lib/move.ts): Move `MsgExecute` builders
- [`src/lib/auth.ts`](./src/lib/auth.ts): challenge-signing helpers
- [`src/lib/tx.ts`](./src/lib/tx.ts): tx hash extraction helpers
- [`src/lib/appHelpers.ts`](./src/lib/appHelpers.ts): UI helpers for labels, grouping, and borrower summaries
- [`src/components/pages`](./src/components/pages): page-level surfaces
- [`src/components/shared`](./src/components/shared): agent panel, activity feed, proof modal, identity card, and empty states
- [`src/styles`](./src/styles): tokens and app styling

Folder map:

- `components/layout`: sidebar, topbar, and mobile nav
- `components/ui`: buttons, cards, and badges
- `components/score`: score visualizations
- `components/loans`: installment schedule UI
- `components/pages`: Overview, Profile, Request, Repay, Loyalty Hub, and Ecosystem
- `components/shared`: cross-page surfaces and proof explorer
- `config`: env and chain config
- `lib`: API, Move tx, auth, formatting, and app helpers
- `types`: frontend domain types mirrored from backend responses

## Runtime Flow

1. The user connects a wallet with InterwovenKit.
2. The frontend requests an auth challenge from the backend.
3. The wallet signs the challenge.
4. The frontend exchanges the signature for a backend session token.
5. The app loads borrower state from backend routes that mirror rollup state.
6. When the user takes an onchain action, the frontend builds Move messages in [`src/lib/move.ts`](./src/lib/move.ts) and submits them through InterwovenKit.
7. After a successful transaction, the frontend asks the backend to resync product state so the UI reflects chain state instead of guesses.

## Transaction Handling

InterwovenKit is the primary transaction handler.

The frontend uses `requestTxBlock` for wallet approval and wraps it with a timeout inside [`src/App.tsx`](./src/App.tsx). If the extension stops on `Loading...`, the app shows a warning toast and recovery actions in Loyalty Hub so the user can reopen the wallet instead of staring at a spinner forever.

The main transaction surfaces include:

- loan requests
- collateralized loan requests
- installment repayment
- claimable LEND
- staking reward claims
- point redemption
- staking and unstaking
- viral drop purchases and collectible claims
- campaign claims
- governance propose, vote, and finalize
- merchant registration and active-state changes

## Modes

The app has two URL-driven modes:

- operator mode: enabled by `?operator=1` or `#operator`
- technical mode: enabled by `?technical=1` or `#technical`

Operator mode unlocks admin actions in Ecosystem. Technical mode exposes more provenance and protocol-oriented detail in the UI.

## Environment

Copy `.env.example` to `.env`.

Core envs:

- `VITE_API_BASE_URL`: backend base URL, defaults to `http://localhost:8080`
- `VITE_APPCHAIN_ID`: chain id passed to InterwovenKit and used for tx submission
- `VITE_CHAIN_NAME`: short chain name for the custom chain config
- `VITE_CHAIN_PRETTY_NAME`: human-readable chain label
- `VITE_CHAIN_NETWORK_TYPE`: usually `testnet`
- `VITE_CHAIN_BECH32_PREFIX`: address prefix, currently `init`
- `VITE_CHAIN_RPC_URL`: rollup RPC URL
- `VITE_CHAIN_REST_URL`: rollup REST URL
- `VITE_CHAIN_INDEXER_URL`: indexer URL used in the custom chain config
- `VITE_NATIVE_DENOM`: native gas denom
- `VITE_NATIVE_SYMBOL`: token label shown in the UI
- `VITE_NATIVE_DECIMALS`: native token decimals
- `VITE_PACKAGE_ADDRESS`: deployed Move package address
- `VITE_LOAN_MODULE_NAME`: default loan module, currently `loan_book`
- `VITE_REQUEST_FUNCTION_NAME`: unsecured/profiled request entry function
- `VITE_REQUEST_COLLATERAL_FUNCTION_NAME`: collateralized request entry function
- `VITE_REQUEST_PROFILE_ID`: default profile id passed to profiled requests
- `VITE_REPAY_FUNCTION_NAME`: installment repayment function

Optional envs:

- `VITE_PREVIEW_OPERATOR_TOKEN`: enables preview/operator actions from the frontend
- `VITE_ENABLE_DEMO_APPROVAL`: allows demo approval UX in local/test environments

Important behavior notes:

- if `VITE_PACKAGE_ADDRESS` is missing, read-only surfaces can still render, but live Move writes should be treated as unavailable
- if `VITE_API_BASE_URL` points to a dead backend, the app can boot, but borrower state will not load
- the defaults in [`src/config/env.ts`](./src/config/env.ts) are local-development oriented and match the included `.env.example`

## Local Development

Recommended full-stack path from the repo root:

```bash
make up
```

That brings up the frontend, backend, and local rollup services together.

If you only want to run the frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://127.0.0.1:5173`.

Frontend-only caveat:

- most connected screens still expect a working backend at `VITE_API_BASE_URL`
- wallet actions still expect a reachable rollup RPC and REST target
- InterwovenKit still needs the browser wallet extension/session to be available

## Scripts

- `npm run dev`: start Vite on `0.0.0.0:5173`
- `npm run build`: run `tsc -b` and then produce the Vite build
- `npm run preview`: preview the production build locally

Useful manual check:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

## Deploy To Vercel

Recommended hosting split:

- frontend on Vercel
- backend on Railway

This folder already includes [`vercel.json`](./vercel.json).

Recommended Vercel settings:

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Important envs in Vercel:

- `VITE_API_BASE_URL`
- `VITE_APPCHAIN_ID`
- `VITE_CHAIN_RPC_URL`
- `VITE_CHAIN_REST_URL`
- `VITE_CHAIN_INDEXER_URL`
- `VITE_PACKAGE_ADDRESS`
- `VITE_NATIVE_SYMBOL`
- `VITE_PREVIEW_OPERATOR_TOKEN` if operator preview actions should remain available

## Troubleshooting

- Wallet popup stuck on `Loading...`: the app should surface recovery UI, but the first check is still to open the extension and confirm there is a pending approval request
- Connected UI loads with missing data: confirm the backend is reachable at `VITE_API_BASE_URL` and the wallet session challenge flow succeeds
- Onchain actions fail immediately: confirm `VITE_PACKAGE_ADDRESS`, function-name envs, and chain endpoints match the currently deployed package
- Rewards, request, or repay actions look live but do nothing: verify the rollup RPC and REST URLs are reachable and the wallet is connected to the same chain id configured in `VITE_APPCHAIN_ID`
- Vite build or typecheck fails after domain changes: re-run `npx tsc -p tsconfig.app.json --noEmit` and compare page props against [`src/types/domain.ts`](./src/types/domain.ts)
