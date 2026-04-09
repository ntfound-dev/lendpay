# Quickstart

This is the fastest way to run the full LendPay stack locally.

For hackathon requirement mapping and proof links, see [Hackathon Readiness](/guide/hackathon-readiness).

## Prerequisites

- Node.js 20+
- npm
- the local Initia tooling already expected by this repo

## Start Everything

From the repo root:

```bash
make up
```

Important:

- `make up` does not start the Rapid relayer or OPinit bots for the rollup.
- Having `LEND` in the rollup wallet is not enough by itself to make built-in oracle calls succeed.
- The backend can still show Connect oracle data, but Move calls through the rollup built-in oracle can remain empty until those services are configured.
- The current local `lendpay-4` state also includes the published `bridge` helper module and one registered `LEND -> MiniEVM` route.
- That route already exposes `InitiaDEX` and `LEND/INIT` as onchain liquidity metadata, but it still remains preview-only until the official MiniEVM mapping for `ulend` is live.

Check status:

```bash
make status
```

Stop services:

```bash
make down
```

## Local URLs

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8080`
- Rollup RPC: `http://127.0.0.1:26657`
- Rollup REST: `http://127.0.0.1:1317`
- Docs site: `http://127.0.0.1:4173`

## Local Bridge Status

In the current local runtime used by this repo, the bridge helper route published onchain is:

- source: `lendpay-4 / ulend`
- destination: `evm-1 / erc20/LEND`
- route registry source: `onchain`
- liquidity venue: `InitiaDEX`
- pool reference: `LEND/INIT`
- liquidity status: `coming_soon`
- swap enabled: `false`

That means the route is now provable onchain, but the user-facing sell path should still read as pending until the official MiniEVM denom mapping exists.

## Borrower Demo Flow

1. Open the frontend.
2. Connect wallet with InterwovenKit.
3. Refresh borrower analysis.
4. Choose an app and request credit.
5. Approve the request through the operator path.
6. Use the funded balance inside the app route.
7. Open `Ecosystem` and verify the `LEND -> Initia MiniEVM` card reads from the onchain route registry.
8. Repay and inspect rewards, loyalty, and proof state.

## Run This Docs Site

```bash
cd docs-site
npm install
npm run dev
```
