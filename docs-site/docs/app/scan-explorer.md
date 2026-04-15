# Scan Explorer

`LendPay Scan` is the built-in explorer surface served from `/scan.html`.

It is the live inspection page for `lendpay-4`, and it is meant to help the team understand what the rollup is doing without leaving the LendPay frontend.

This page explains the full explorer UI, not just the `Verify Contracts` modal.

## What LendPay Scan Is For

The explorer currently acts as:

- a live transaction viewer
- a recent block viewer
- a saved-account activity surface
- a developer tools entrypoint
- a proof modal for recent onchain execution

It is intentionally lighter than a full public block explorer.

The point is to expose the most useful live data for LendPay product work, debugging, demos, and hackathon review.

## Ongoing Development

`LendPay Scan` will be developed further on a regular basis, and this page will keep tracking those improvements.

That includes:

- new tabs or data surfaces
- richer proof and verification panels
- account and device-state improvements
- future NFT and explorer integrations

So treat this page as a living reference for the current explorer UI, not a frozen specification.

## Route And Data Source

Production route:

```bash
/scan.html
```

API path used by the page:

```bash
/scan-api/*
```

Current runtime behavior:

- local development reads through `/scan-api`
- production rewrites `/scan-api/*` to the public Railway rollup runtime
- if the same-origin proxy path fails, the explorer can fall back to the public Railway rollup endpoint directly

This is why the page can still work even when the frontend and the rollup runtime are deployed on different hosts.

## Page Layout

The explorer has four major zones:

1. left sidebar
2. top bar
3. primary tabs
4. detail modals

Each zone is described below.

## Left Sidebar

### `Your account`

This section is for the currently selected wallet address saved on the device.

Actions:

- `Past transactions`
  Opens the transaction view filtered to that account.
- `Your account details`
  Opens a modal with the saved address, recent tx count, latest seen time, and network.

This is a convenience surface for quickly jumping back to the wallet you are currently checking.

### `Developer tools`

This section is for team-facing debugging and verification helpers.

Current action:

- `Verify contracts`
  Opens a modal that summarizes recently observed package/module/function calls from recent transactions.

Important:

- this is not a full source verifier yet
- it is a recent call-surface inspector

### `This device`

This section shows saved addresses remembered in browser local storage.

What it means:

- the addresses are saved locally in the browser
- this is not a chain registry
- this is not a backend-side saved profile list

So when the explorer says an account is `Saved locally`, it means the browser has remembered it as a recently inspected account.

### `Live height`

This shows the latest known block height from the explorer refresh loop.

Use it as a quick sanity check that the explorer is still syncing and receiving fresh block data.

### `View doc`

This opens the live docs site.

It is meant to give developers a quick path from the explorer into reference documentation without sending them to a GitHub folder tree.

## Top Bar

### `chain explorer / lendpay scan`

This is the page identity and confirms that you are inside the dedicated explorer surface, not the borrower dashboard.

### Global search

The search box accepts:

- transaction hash
- block height
- address

Typical use:

- paste a tx hash to jump to its proof
- enter a block height to inspect a block
- paste an address to filter recent activity for that account

### `lendpay-4`

This badge is the active chain ID shown by the explorer.

It tells you which rollup you are currently inspecting.

### Wallet badge

The right-side address badge shows the currently active account in the explorer context.

This is the address used for filtered account views and device-saved account actions.

## Main Tabs

The explorer currently has four tabs:

- `Overview`
- `Transactions`
- `Blocks`
- `NFTs`

### `Overview`

The overview is the high-level status page.

It summarizes:

- current chain health
- latest activity
- recent transactions
- latest blocks and execution signals

This is the fastest place to check whether the rollup is alive and whether new activity is flowing in.

### `Transactions`

This is the most detailed and most actively used tab today.

What it shows:

- every indexed transaction sorted by recency
- a filter box for hash, action, sender, and address matching
- auto-refresh timing metadata
- per-row transaction proof entry points

#### Transaction columns

- `TX Hash`
  The transaction hash, truncated for readability, with copy support.
- `Action`
  A normalized action label derived from the Move or Cosmos message path.
- `Sender`
  The effective sender the explorer could resolve.
- `Amount`
  The primary amount inferred from message or event data.
- `Timestamp`
  Absolute time plus a relative label such as `5 hours ago`.

#### Why actions look different

Some actions are direct Move entrypoints, such as:

- `loan_book::repay_installment`
- `loan_book::request_profiled_loan`
- `rewards::claim_lend`

Some are wrapper flows, such as:

- `Grant Allowance`
- `Authz Exec -> rewards::claim_lend`
- `Authz Exec -> loan_book::repay_installment`

That difference matters:

- direct labels usually mean the entrypoint is called plainly
- `Grant Allowance` usually reflects authz setup
- `Authz Exec -> ...` means a wrapper executed another underlying call

#### Why some amounts are `—`

An amount shows as `—` when the explorer cannot safely infer a meaningful transfer or payload amount from the transaction.

That does not necessarily mean the transaction did nothing.

It usually means the action was structural, permission-related, or not represented as a clean single amount.

### `Blocks`

This tab shows recent blocks sorted by recency.

It focuses on:

- block height
- block hash
- proposer label
- transaction count
- timestamp

Use it when you want to confirm that:

- the rollup is still producing blocks
- a transaction should have landed by now
- recent throughput looks healthy

### `NFTs`

This tab is intentionally a placeholder today.

What it means:

- the UI is ready for NFT indexer integration
- the search field is already there
- the page stays empty until an NFT endpoint is wired in

So this tab is a planned explorer surface, not a complete live NFT explorer yet.

## Transaction Proof Modal

Clicking a transaction row opens `Transaction Proof`.

This is the detailed proof panel for one transaction and is one of the most important explorer surfaces.

### Top summary

The header shows:

- chain ID
- confirmation status
- a short description of the source

The summary stats show:

- `Chain`
- `Block`
- `Gas`
- `Fee`

### `Contract Info`

This section explains the actual execution target and participants.

Fields include:

- `Package`
  The Move package address that handled the call.
- `Module`
  The module name used.
- `Function`
  The function name used.
- `Sender`
  The effective sender visible to the explorer.
- `Recipient`
  The resolved target recipient when one exists.
- `Fee payer`
  The fee-paying account if it differs from the simple sender view.
- `VM sender`
  The virtual-machine level sender when the inner execution context differs from the outer wrapper.
- `Wrapper`
  A higher-level execution wrapper such as authz execution when relevant.
- `Grantee`
  The delegated grantee when the transaction used authz.

This is why the modal is useful even when the table row alone is not enough.

It helps explain *how* a transaction happened, not just *that* it happened.

### Summary text

Below `Contract Info`, the explorer renders a normalized human summary when it can.

Examples:

- loan request summary
- amount summary
- tenor summary
- borrower summary

This is derived from transaction events and payload hints, so it is easier to scan than raw JSON.

### `TX Hash`

This section gives you:

- the full hash with copy support
- `Open tx JSON`
  A direct link to the raw transaction JSON from the underlying endpoint
- `Copy all proof details`
  A convenient text export of the normalized proof information

That makes the modal useful for debugging, demos, bug reports, and handoff to teammates.

## Account Detail Modal

`Your account details` opens a small account-focused modal.

It currently shows:

- address
- tx count linked to that account in the explorer cache
- latest seen timestamp
- network

This is a browser-context helper.

It is not yet a full chain account profile page.

## Verify Contracts Modal

`Verify Contracts` is the lightweight contract inspection surface inside the explorer.

What it does:

- reads recent transactions already visible in the page
- extracts `module_address`, `module_name`, and `function_name`
- deduplicates repeated contract calls by package + module + function
- shows recent call surfaces as structured cards

Each card shows:

- `Package`
- `Module`
- `Function`
- `Observed action`
  Only shown when the higher-level action label differs from the plain `module::function` target

### What it is good for

- checking which Move entrypoints a product action really hit
- confirming whether authz wrappers resolved to the expected inner call
- comparing recent live usage against documented package behavior
- giving reviewers a quick manual verification surface during demos

### What it is not

This modal does **not** yet:

- verify source code or bytecode hashes
- compare deployed code against repository contents automatically
- prove package upgrade lineage by itself
- replace a real contract verifier product

So today it should be understood as a recent call-surface inspector, not a formal verifier.

## How To Read The Explorer Correctly

A few interpretation rules matter:

- `Saved locally` means browser local storage, not onchain identity
- `Grant Allowance` often means authz setup, not the final business action
- `Authz Exec -> ...` means the visible wrapper differs from the inner Move call
- `Amount: —` usually means the explorer could not extract a clean single amount
- `Transaction Proof` is a normalized view, while `Open tx JSON` is the raw source

These distinctions help avoid over-reading the UI.

## Relationship To Other Docs

Use this page together with:

- [Frontend](/app/frontend)
- [Move Contract](/app/smartcontract)
- [API](/reference/api)
- [Testnet Evidence](/reference/testnet)

The explorer shows what was recently observed.

The Move package docs explain what those calls are meant to do.

The API docs explain where frontend and backend state comes from.

The testnet evidence page gives concrete package and transaction references when you need harder proof.

## Current Limitations

- it depends on endpoints currently wired into the explorer
- it is optimized for recent activity, not long-term archival search
- NFT support is still a placeholder
- contract verification is observational, not cryptographic
- account surfaces are browser-context helpers, not full explorer identity pages

That limitation is intentional for now.

The explorer tries to be honest about what it knows, instead of pretending to be a full chain intelligence platform before the underlying infrastructure exists.
