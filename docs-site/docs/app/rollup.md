# Rollup

The rollup is the MiniMove chain runtime that executes the LendPay protocol.

**The Move contract is the protocol code. The rollup is the running chain environment** that executes that code, stores state, exposes RPC and REST endpoints, and produces blocks.

## Responsibilities

- run the MiniMove chain (`lendpay-4`)
- execute published Move modules
- expose RPC and REST endpoints for frontend, backend, and tooling
- persist chain state: requests, loans, rewards, treasury balances, merchant routes
- host the built-in oracle state used by Move precompiles

## Local Runtime

The rollup is started by the local stack scripts.

Key pieces:
- `scripts/local-stack-up.sh`
- `scripts/local-stack-common.sh`
- local rollup home, usually `~/.minitia-testnet4`
- `minitiad` binary provided by MiniMove / Weave

Default local endpoints:
- RPC: `http://localhost:26657`
- REST: `http://localhost:1317`

Local Postgres (for the backend mirror, not the rollup itself):
- `postgresql://postgres:postgres@127.0.0.1:55432/lendpay_dev`

## Source Of Truth

The rollup is authoritative for:
- published Move package state
- loan request and approval state
- repayment and collateral state
- rewards, staking, and governance state
- merchant route registrations
- chain events and transaction history

The backend mirrors and normalizes some of this state, but the rollup is the actual execution environment.

## What The Rollup Is Not

- the borrower-facing frontend
- the API and auth backend
- the same thing as the Move package source code
- the oracle bridge stack

`make up` starts the rollup node. It does not start the Rapid relayer or OPinit bots. Built-in oracle-dependent Move calls can fail even when the rollup itself is healthy.

## Relationship To Other Layers

- [Frontend](/app/frontend) — connects wallet, submits transactions, reads normalized borrower state
- [Backend](/app/backend) — authenticates users, mirrors borrower state, talks to the rollup
- [Move Contract](/app/smartcontract) — protocol logic deployed onto the rollup

## Debugging Rule

If the frontend looks correct but onchain state is stale, the issue is in one of:

1. the rollup runtime itself
2. the relayer or oracle bridge services
3. backend sync against rollup state

Always check the rollup layer separately, not hidden under frontend or contract issues.
