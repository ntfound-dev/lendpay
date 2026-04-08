# LendPay

LendPay is an Initia MiniMove appchain for agent-guided credit across Initia apps.

It combines:

- a React frontend for app credit requests, live viral drop usage, repayment, rewards, and ecosystem activity
- a TypeScript backend for sessions, underwriting, protocol sync, and operator actions
- Move smart contracts for requests, approvals, repayments, collateral, rewards, staking, governance, campaigns, and app rails

## Architecture At A Glance

1. The frontend connects the wallet and submits Move transactions.
2. The backend authenticates the borrower, computes score output, mirrors product state, and performs operator actions.
3. The MiniMove rollup executes the protocol logic onchain.

Docs by layer:

- frontend technical docs: [frontend/README.md](./frontend/README.md)
- backend technical docs: [backend/README.md](./backend/README.md)
- smart contract technical docs: [smarcontract/README.md](./smarcontract/README.md)
- standalone docs site: [docs-site](./docs-site)

## What Problem It Solves

Most onchain users can trade and swap, but they still cannot access simple credit for real app experiences. Wallet activity and identity signals rarely become usable financing, and Initia apps still lack a clean pay-later rail for drops, passes, collectibles, and other consumer actions.

LendPay turns wallet activity, `.init` identity, and repayment history into ecosystem-aware installment credit.
Small app requests are reputation-based and unsecured. A separate advanced profile supports locked `LEND` collateral for larger secured requests.

## Core Flow

LendPay is currently tightened around one truthful internal borrower flow:

1. connect wallet and refresh borrower analysis
2. request credit for a live Initia app
3. operator approval funds the borrower wallet
4. the borrower uses that funded balance in `viral_drop`
5. an onchain receipt is minted to the borrower wallet
6. the borrower repays installments and improves reputation

## Initia Native Features Used

- InterwovenKit wallet/session UX
- Initia Usernames (`.init`)
- MiniMove rollup execution for credit, receipts, and repayment

## Quick Start

Start the full local stack from the repo root:

```bash
make up
```

Check status:

```bash
make status
```

Stop everything:

```bash
make down
```

Restart everything:

```bash
make restart
```

Show log locations:

```bash
make logs
```

## Local URLs

- frontend: `http://127.0.0.1:5173`
- docs: `http://127.0.0.1:4173`
- backend: `http://127.0.0.1:8080`
- rollup RPC: `http://127.0.0.1:26657`
- rollup REST: `http://127.0.0.1:1317`

## Local Demo Flow

1. Run `make up`
2. Open docs at `http://127.0.0.1:4173` if you want the product and architecture reference site
3. Open `http://127.0.0.1:5173`
4. Connect wallet with InterwovenKit
5. Analyze borrower profile
6. Choose the live app and request credit
7. Approve the request through the operator flow
8. Use the funded balance in the live viral drop
9. Repay through the live rollup flow

## Deployment Evidence

- testnet rollup chain id: `lendpay-3`
- package address: `0x5972A1C7118A8977852DC3307621535D5C1CDA63`
- upgrade tx: `9BE4D230F9F06F0757A2EB075D8CC405BFF5C9262076603D89731C727F953843`
- viral drop init tx: `FBACB5F822F6D75BA9F2AF8CD2A3C9DD50F8D74629306F96B7B244DB633DDC6D`
- partner app register tx: `2BD5EC0362C534A0A7E5AF030897029C291C7FEF426156A7FEA5F09EED2280F2`
- testnet artifacts: [smarcontract/artifacts/testnet/lendpay-3](./smarcontract/artifacts/testnet/lendpay-3)
- submission metadata: [.initia/submission.json](./.initia/submission.json)

## App Hosting

Recommended app hosting split:

- frontend on Vercel from [`frontend`](./frontend)
- backend on Railway from [`backend`](./backend)

The frontend already includes [frontend/vercel.json](./frontend/vercel.json).

The backend already includes:

- [backend/Dockerfile](./backend/Dockerfile)
- [backend/railway.json](./backend/railway.json)

Important note:

- the app layer can be public on Vercel/Railway
- the rollup still needs a public RPC/REST host if you want the chain itself to stop depending on `localhost`
