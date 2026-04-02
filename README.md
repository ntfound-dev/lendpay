# LendPay

LendPay is an Initia MiniMove appchain for merchant checkout credit.

It combines:

- a React frontend for borrower checkout, repayment, rewards, and operations
- a TypeScript backend for sessions, underwriting, protocol sync, and operator actions
- Move smart contracts for requests, approvals, repayments, collateral, rewards, staking, governance, campaigns, and merchant rails

## Architecture At A Glance

1. The frontend connects the wallet and submits Move transactions.
2. The backend authenticates the borrower, computes score output, mirrors product state, and performs operator actions.
3. The MiniMove rollup executes the protocol logic onchain.

Docs by layer:

- frontend technical docs: [frontend/README.md](./frontend/README.md)
- backend technical docs: [backend/README.md](./backend/README.md)
- smart contract technical docs: [smarcontract/README.md](./smarcontract/README.md)

## What Problem It Solves

Most onchain users can trade and swap, but they still cannot access simple credit for real purchases. Wallet activity and identity signals rarely become usable financing, and merchants do not have a clean pay-later rail on appchains.

LendPay turns wallet activity, `.init` identity, and repayment history into merchant-aware installment credit.

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
- backend: `http://127.0.0.1:8080`
- rollup RPC: `http://127.0.0.1:26657`
- rollup REST: `http://127.0.0.1:1317`

## Local Demo Flow

1. Run `make up`
2. Open `http://127.0.0.1:5173`
3. Connect wallet with InterwovenKit
4. Analyze borrower profile
5. Choose a merchant partner and request checkout credit
6. Approve and repay through the live local rollup flow

## Deployment Evidence

- rollup chain id: `lendpay-local-1`
- package deploy artifact: [smarcontract/artifacts/rollup/deploy.json](./smarcontract/artifacts/rollup/deploy.json)
- submission metadata: [.initia/submission.json](./.initia/submission.json)
