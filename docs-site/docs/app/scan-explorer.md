# Scan Explorer

`LendPay Scan` is the explorer surface that ships with the frontend at `/scan.html`.

It is not a separate indexer product. It is a developer-facing and operator-friendly window into the live `lendpay-4` rollup activity that the LendPay frontend already knows how to reach.

## What It Shows

The explorer currently focuses on:

- latest blocks from the rollup REST surface
- recent transactions and transaction detail modals
- account lookups from the locally cached transaction feed
- NFT placeholder/account lookup surfaces
- developer tools such as `Verify Contracts`

The goal is not to replace a full public block explorer yet.

The goal is to give the LendPay team a truthful live execution surface while the product is still evolving quickly.

## Route And Data Source

Production route:

```bash
/scan.html
```

Production API path:

```bash
/scan-api/*
```

Current behavior:

- local development uses `/scan-api` as the frontend proxy path
- production rewrites `/scan-api/*` to the public Railway rollup runtime
- if the same-origin proxy path fails, the explorer can fall back to the public Railway rollup endpoint directly

This is why the scan page can keep working even when the frontend and backend are deployed separately.

## Verify Contracts

The `Verify Contracts` modal is the lightweight contract inspection surface inside `LendPay Scan`.

You open it from:

- `LendPay Scan`
- sidebar
- `Developer tools`
- `Verify contracts`

What it does:

- reads recent transaction activity already visible in the explorer
- extracts Move `module_address`, `module_name`, and `function_name`
- deduplicates repeated contract calls by package + module + function
- shows a compact list of recent call surfaces developers can inspect manually

What each card shows:

- `Package`
  The Move package address that received the call.
- `Module`
  The Move module name observed in the transaction.
- `Function`
  The Move function name observed in the transaction.
- `Observed action`
  The higher-level action string seen by the explorer when it differs from the plain `module::function` target.

## What Verify Contracts Is Not

This modal does **not** currently:

- verify bytecode against a published source bundle
- compare ABI or Move source hashes automatically
- prove package upgrade lineage by itself
- fetch source code from a repository or package registry

So the current modal is best understood as:

- a manual contract call inspection surface
- a recent call registry for developers
- a quick way to confirm which package/module/function triplets are actually being exercised

It is not yet a dedicated source verifier.

## How To Use It Well

Typical workflow:

1. Open `LendPay Scan`.
2. Trigger the feature you want to inspect in the app.
3. Open `Verify Contracts`.
4. Confirm the `Package`, `Module`, and `Function` shown in the modal.
5. Cross-check the package address against the Move package docs or testnet evidence.

This is especially useful when:

- a new frontend action has just been wired
- a repayment flow looks suspicious
- a route or rewards action needs a quick sanity check
- you want to confirm which Move entrypoints are actually hit in live usage

## Relationship To The Move Package Docs

Use the `Verify Contracts` modal together with:

- [Move Contract](/app/smartcontract)
- [Testnet Evidence](/reference/testnet)

The modal tells you which call surface was exercised.

The Move package docs explain what that surface is supposed to do.

The testnet evidence page gives you concrete package and transaction references when you need to prove that a path was really deployed or executed.

## Current Limitations

- it depends on recent transactions already visible to the explorer
- it is only as complete as the current transaction normalization layer
- it is optimized for recent developer debugging, not archival search
- it shows real call targets, but not full contract source verification yet

That limitation is intentional for now.

It keeps the surface honest: the UI only claims to show recent observed call activity, not more than that.
