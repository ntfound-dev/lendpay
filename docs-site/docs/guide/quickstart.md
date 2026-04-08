# Quickstart

This is the fastest way to run the full LendPay stack locally.

## Prerequisites

- Node.js 20+
- npm
- the local Initia tooling already expected by this repo

## Start Everything

From the repo root:

```bash
make up
```

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

## Borrower Demo Flow

1. Open the frontend.
2. Connect wallet with InterwovenKit.
3. Refresh borrower analysis.
4. Choose an app and request credit.
5. Approve the request through the operator path.
6. Use the funded balance inside the app route.
7. Repay and inspect rewards, loyalty, and proof state.

## Run This Docs Site

```bash
cd docs-site
npm install
npm run dev
```
