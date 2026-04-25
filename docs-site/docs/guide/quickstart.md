# Quickstart

The fastest way to run the full LendPay stack locally.

## Prerequisites

- Node.js 20+
- npm
- local Initia tooling expected by this repo

## Start Everything

```bash
make up
```

Notes:
- `make up` does not start the Rapid relayer or OPinit bots.
- Built-in oracle Move calls can remain empty until those services are configured.
- The current local `lendpay-4` state includes the published `bridge` module and one registered `LEND → MiniEVM` route (`ulend → evm-1/erc20/LEND`, InitiaDEX, LEND/INIT pool) — preview-only until the official MiniEVM denom mapping is live.

```bash
make status   # check running services
make down     # stop everything
```

## Local URLs

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:8080` |
| Rollup RPC | `http://localhost:26657` |
| Rollup REST | `http://localhost:1317` |
| Docs site | `http://localhost:4173` |

## Borrower Demo Flow

1. Open the frontend.
2. Connect wallet with InterwovenKit.
3. Click **Refresh analysis** on the Profile page.
4. Choose an app and request credit on the Request page.
5. Approve the request through the operator path.
6. Use the funded balance via the app route.
7. Open Loyalty Hub — season allocation banner shows estimated LEND airdrop.
8. Repay installments and inspect rewards, streak, and tier state.
9. Open Ecosystem and verify the `LEND → Initia MiniEVM` card reads from the onchain route registry.

## Run The Docs Site

```bash
cd docs-site
npm install
npm run dev
```

## Railway Deploy Quickstart

Backend and frontend each have a Railway service. Key env vars to set:

- `DATABASE_URL`, `DIRECT_DATABASE_URL`
- `JWT_SECRET`
- `ROLLUP_REST_URL`, `ROLLUP_RPC_URL` — use Railway private networking (`http://<service>.railway.internal:<port>`)
- `LENDPAY_PACKAGE_ADDRESS`
- `ENABLE_LIVE_ROLLUP_WRITES=true`
- `SEASON_LEND_ALLOCATION` — LEND tokens allocated for the current season
- `VITE_API_BASE_URL` — backend public URL (frontend)

For the full variable list, see [Environment Reference](/reference/env).
