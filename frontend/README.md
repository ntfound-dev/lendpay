# LendPay Frontend

React + Vite borrower console for the LendPay Move rollup.

This app is the user-facing product shell. It connects the wallet with InterwovenKit, authenticates against the backend, loads mirrored borrower state, and opens wallet approvals for Move actions such as request, repay, claim, stake, and campaign flows.

## What It Does

- connects wallets through `@initia/interwovenkit-react`
- signs backend login challenges and persists the backend session per wallet address
- renders the borrower dashboard, request flow, repay flow, loyalty surfaces, ecosystem reads, and proof explorer
- builds Move `MsgExecute` payloads for rollup actions
- tries to enable Interwoven auto-sign for supported Move actions
- shows a human-readable tx preview before the wallet signer opens

## Stack

- React 19
- TypeScript
- Vite 7
- `@initia/interwovenkit-react`
- `@tanstack/react-query`
- `wagmi`
- `vite-plugin-node-polyfills`

`npm` is the expected package manager in this folder because the repo already includes `package-lock.json`.

Current dependency baseline in this folder:

- `@initia/interwovenkit-react`: `2.6.0`
- `wagmi`: `2.17.2`
- `viem`: `2.47.10`
- `@tanstack/react-query`: `5.96.2`
- `@cosmjs/amino`: `0.36.2`

The lockfile also pins WalletConnect/AppKit transitives through npm `overrides` so React 19 no longer trips the old `valtio` peer warning during normal installs.

## Main Files

Bootstrap and config:

- [`src/main.tsx`](./src/main.tsx): React root, QueryClient, Wagmi, InterwovenKit provider, auto-sign config, reconnect behavior, error boundary, and wallet suggestion pruning
- [`src/config/env.ts`](./src/config/env.ts): Vite env mapping
- [`src/config/chain.ts`](./src/config/chain.ts): custom chain passed to InterwovenKit

App and hooks:

- [`src/App.tsx`](./src/App.tsx): top-level page orchestration, borrower sync, tx submission, toasts, technical mode, and view state
- [`src/hooks/useBackendSession.ts`](./src/hooks/useBackendSession.ts): backend session creation, persistence, and reuse
- [`src/hooks/useAutoSignPermission.ts`](./src/hooks/useAutoSignPermission.ts): auto-sign permission grant flow
- [`src/hooks/useTxPreview.ts`](./src/hooks/useTxPreview.ts): preview modal state and confirmation handling

Libraries:

- [`src/lib/api.ts`](./src/lib/api.ts): backend API client with timeout and retry logic
- [`src/lib/move.ts`](./src/lib/move.ts): Move message builders
- [`src/lib/auth.ts`](./src/lib/auth.ts): wallet signing helpers for backend login
- [`src/lib/tx.ts`](./src/lib/tx.ts): tx hash extraction helpers
- [`src/lib/appHelpers.ts`](./src/lib/appHelpers.ts): labels, grouping, summaries, and helper formatting
- [`src/lib/nav.ts`](./src/lib/nav.ts): shared navigation model

Shared UI:

- [`src/components/pages`](./src/components/pages): Overview, Profile, Request, Repay, Loyalty Hub, and Ecosystem
- [`src/components/shared/TxPreviewModal.tsx`](./src/components/shared/TxPreviewModal.tsx): pre-wallet transaction summary modal
- [`src/components/shared/ProofModal.tsx`](./src/components/shared/ProofModal.tsx): tx proof and protocol explorer surface
- [`src/components/shared/ErrorBoundary.tsx`](./src/components/shared/ErrorBoundary.tsx): crash guard for the app shell

## Product Surfaces

- `Overview`: account summary, credit limit, outstanding amount, wallet balance, next payment, and activity
- `Profile`: score, APR, breakdown, username status, and refresh actions
- `Request`: merchant selection, profile quote selection, amount, tenor, collateral path, and request submit flow
- `Repay`: active loan, due installment, fee state, and repay actions
- `Loyalty Hub`: LEND balances, reward claims, staking actions, referral, leaderboard, and perk purchases
- `Ecosystem`: campaign reads, governance reads, merchant catalog, proof explorer, and technical surfaces

## Wallet, Auth, and Tx Flow

1. The app opens InterwovenKit connect flow through `openConnect()`.
2. The frontend requests a backend challenge.
3. It prefers plain-text signing for login and falls back to Amino signing when needed.
4. The backend returns a signed session token, which is stored per wallet address in local storage.
5. The app loads borrower state from backend routes.
6. For onchain actions, LendPay first shows `TxPreviewModal`.
7. For supported `MsgExecute` calls, the app tries to enable auto-sign permission through Interwoven.
8. The primary wallet path is `requestTxBlock` with a 45 second approval timeout.
9. If that approval path fails or the extension stalls, the app falls back to direct submit with `estimateGas + submitTxBlock`.
10. After the tx succeeds, the app asks the backend to resync borrower state.

Important current behavior:

- the Wagmi connector is restricted to `initiaPrivyWalletConnector`
- `reconnectOnMount` is enabled, so refresh should reconnect instead of feeling like a logout
- the app clears stale non-Initia Wagmi connector state on boot
- some wallet UI still belongs to the wallet extension itself, so raw JSON sign docs can still appear after the in-app preview

## Modes

Technical mode is still available:

- `?technical=1`
- `#technical`

Public operator mode is currently disabled in the client. Admin buttons remain visible only where the product needs to explain the flow, but public actions return disabled messaging until server-side operator auth is reintroduced safely.

## Environment

Copy `.env.example` to `.env`.

Core backend and chain wiring:

- `VITE_API_BASE_URL`
- `VITE_APPCHAIN_ID`
- `VITE_CHAIN_NAME`
- `VITE_CHAIN_PRETTY_NAME`
- `VITE_CHAIN_NETWORK_TYPE`
- `VITE_CHAIN_BECH32_PREFIX`
- `VITE_CHAIN_RPC_URL`
- `VITE_CHAIN_REST_URL`
- `VITE_CHAIN_INDEXER_URL`

Asset and package config:

- `VITE_NATIVE_DENOM`
- `VITE_NATIVE_SYMBOL`
- `VITE_NATIVE_DECIMALS`
- `VITE_PACKAGE_ADDRESS`
- `VITE_LOAN_MODULE_NAME`

Move entry functions:

- `VITE_REQUEST_FUNCTION_NAME`
- `VITE_REQUEST_COLLATERAL_FUNCTION_NAME`
- `VITE_CANCEL_REQUEST_FUNCTION_NAME`
- `VITE_REQUEST_PROFILE_ID`
- `VITE_REPAY_FUNCTION_NAME`

Optional:

- `VITE_ENABLE_DEMO_APPROVAL`

Notes:

- if `VITE_PACKAGE_ADDRESS` is missing, write paths should be treated as unavailable
- if `VITE_API_BASE_URL` is unreachable, the shell can boot but borrower state will fail to load
- `VITE_CANCEL_REQUEST_FUNCTION_NAME` is read by the app config and should stay aligned with the deployed Move package

## Local Development

Best full-stack path from the repo root:

```bash
make up
```

That starts:

- PostgreSQL
- rollup RPC and REST
- backend API
- frontend
- docs site

If you want the frontend only:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

Frontend-only caveats:

- most connected screens still expect the backend to be reachable at `VITE_API_BASE_URL`
- wallet actions still need a live rollup RPC and REST target
- auto-sign and signer flows still require the Interwoven wallet extension or session to be available
- when this repo is installed from a Windows-mounted path such as `/mnt/c/...` inside WSL, `npm install` can still hit occasional rename permission errors from the filesystem layer; if that happens, rerun from a normal Windows shell or move the repo into the Linux filesystem for the cleanest `node_modules` behavior

## Scripts

- `npm run dev`: starts Vite
- `npm run build`: runs `tsc -b` and then `vite build`
- `npm run preview`: previews the built app locally

Useful manual check:

```bash
./node_modules/.bin/tsc -p tsconfig.app.json --noEmit --pretty false
```

## Build and Node Notes

Vite 7 needs a modern Node runtime. In practice, use Node `20.19+`, `22.12+`, or `24+`.

Current repo state:

- repo root `.nvmrc`: `24.10.0`
- frontend-local `.nvmrc`: `20.20.2`

If `npm run build` fails with an engine/version warning, switch Node first before debugging the app itself.

Dependency cleanup status:

- the old React 19 peer warning from `@reown/appkit`/`valtio` has been removed by the current lockfile overrides
- `npm audit` no longer reports any `high` severity items in this folder after the current lockfile overrides for the wallet connector chain
- the remaining advisories are low-severity transitive issues in `@initia/initia.js` and the browser polyfill toolchain

## Deployment

Recommended split:

- frontend on Vercel
- backend on Railway

This folder already includes [`vercel.json`](./vercel.json).

Recommended Vercel settings:

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Important Vercel envs:

- `VITE_API_BASE_URL`
- `VITE_APPCHAIN_ID`
- `VITE_CHAIN_RPC_URL`
- `VITE_CHAIN_REST_URL`
- `VITE_CHAIN_INDEXER_URL`
- `VITE_PACKAGE_ADDRESS`
- `VITE_NATIVE_SYMBOL`
- `VITE_CANCEL_REQUEST_FUNCTION_NAME`

Production example:

- copy `frontend/.env.production.example`
- `VITE_API_BASE_URL=https://balanced-peace-backend.up.railway.app`
- `VITE_CHAIN_RPC_URL=https://rollup-runtime-backend.up.railway.app`
- `VITE_CHAIN_REST_URL=https://rollup-runtime-backend.up.railway.app`
- `VITE_CHAIN_INDEXER_URL=https://balanced-peace-backend.up.railway.app`

Production builds now require those URL env vars explicitly and no longer fall back to hardcoded Railway domains.

## Troubleshooting

- wallet reconnect feels lost after refresh: confirm the backend is still reachable and the wallet extension session is still alive
- wallet popup stuck on `Loading...`: open the Interwoven extension directly and check for a pending approval or permission grant
- backend login fails after a successful wallet sign: restart the local backend if you changed auth code, then refresh and reconnect
- tx preview looks right but the signer shows raw JSON: that last screen is coming from the wallet extension, not from the LendPay modal
- request, repay, or claim actions fail immediately: check chain ID, package address, and function-name env vars against the deployed package
