# Rollup

The rollup is the MiniMove chain runtime that executes the LendPay protocol.

It is different from the Move contract itself:

- the `Move Contract` is the protocol code
- the `Rollup` is the running chain environment that executes that code, stores state, exposes RPC and REST, and produces blocks

## Responsibilities

- run the MiniMove chain for `lendpay`
- execute published Move modules onchain
- expose RPC and REST endpoints for frontend, backend, and tooling
- persist chain state such as requests, loans, rewards, treasury balances, and merchant routes
- host the built-in oracle state used by Move precompiles

## Local Runtime

In local development, the rollup is started by the local stack scripts.

Main pieces:

- `scripts/local-stack-up.sh`
- `scripts/local-stack-common.sh`
- local rollup home, usually under `~/.minitia-testnet4`
- `minitiad` runtime provided by MiniMove / Weave

Default local endpoints:

- RPC: `http://127.0.0.1:26657`
- REST: `http://127.0.0.1:1317`

Related local stack dependency:

- Postgres: `postgresql://postgres:postgres@127.0.0.1:55432/lendpay_dev`

Important distinction:

- `Rollup RPC` and `Rollup REST` belong to the chain runtime
- `Postgres` belongs to the app stack and is used by the backend mirror layer
- Postgres is not the source of truth for onchain execution, but it is still part of the local runtime you need for the full LendPay stack

## What The Rollup Is Responsible For

The rollup is the source of truth for:

- published Move package state
- loan request and approval state
- repayment and collateral state
- rewards, staking, and governance state
- merchant route registrations
- chain events and transaction history

The backend mirrors and normalizes some of this state, but the rollup is still the actual execution environment.

## What The Rollup Is Not

The rollup is not:

- the borrower-facing frontend
- the API and auth backend
- the same thing as the Move package source code
- automatically the same thing as the oracle bridge stack

That last point matters locally:

- `make up` starts the rollup node
- `make up` does not automatically start the Rapid relayer or OPinit bots
- because of that, built-in oracle-dependent Move calls can still fail even when the rollup itself is healthy

## Relationship To Other Layers

- [Frontend](/app/frontend)
  Connects wallet, submits transactions, and reads normalized borrower state.
- [Backend](/app/backend)
  Authenticates users, mirrors borrower state, and talks to the rollup through integrations.
- [Move Contract](/app/smartcontract)
  Contains the actual protocol logic deployed onto the rollup.

## Practical Rule

If the frontend looks fine but onchain state is stale, the issue can be in:

- the rollup runtime itself
- the relayer or oracle bridge services around the rollup
- backend sync against rollup state

So for operations, the rollup should be documented as its own layer, not hidden under frontend or Move contract.
