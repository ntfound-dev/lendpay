# Scan Explorer

`LendPay Scan` is the built-in explorer surface at `/scan.html`. It is the live inspection page for `lendpay-4` — a transaction viewer, block viewer, developer tools entrypoint, and proof modal for recent onchain execution.

It is intentionally lighter than a full public block explorer. The goal is to expose the most useful live data for product work, debugging, demos, and hackathon review.

## Route And Data Source

```
/scan.html          — explorer page
/scan-api/*         — proxied rollup API
```

In local development, requests go through `/scan-api`. In production, `/scan-api/*` rewrites to the public Railway rollup runtime. If the same-origin proxy fails, the explorer falls back to the public rollup endpoint directly.

## Page Layout

### Left Sidebar

**Your account** — The currently selected wallet address saved on the device.
- `Past transactions` — Opens the transaction view filtered to that account
- `Your account details` — Shows saved address, recent tx count, latest seen time, and network

**Developer tools**
- `Verify contracts` — Opens the contract inspection modal (see below)

**This device** — Addresses saved in browser local storage. These are browser-context helpers, not a chain registry or backend profile list. `Saved locally` means the browser remembers it as a recently inspected account.

**Live height** — Latest known block height from the explorer refresh loop. Quick sanity check that the explorer is still syncing.

**View doc** — Opens the docs site from inside the explorer.

### Top Bar

- **Global search** — Accepts transaction hash, block height, or address
- **`lendpay-4`** — Active chain ID badge
- **Wallet badge** — Currently active account used for filtered account views

## Main Tabs

### Overview

High-level status page: chain health, latest activity, recent transactions, and latest blocks. The fastest place to check whether the rollup is alive.

### Transactions

The most actively used tab.

| Column | Description |
| --- | --- |
| `TX Hash` | Truncated with copy support |
| `Action` | Normalized action label derived from Move or Cosmos message path |
| `Sender` | Effective sender resolved by the explorer |
| `Amount` | Primary amount inferred from message or event data |
| `Timestamp` | Absolute time plus relative label |

**Why actions look different:** Some are direct Move entrypoints (`loan_book::repay_installment`, `rewards::claim_lend`). Some are wrapper flows (`Grant Allowance`, `Authz Exec -> loan_book::repay_installment`). Direct labels mean the entrypoint is called plainly. `Authz Exec ->` means a wrapper executed another underlying call.

**Why some amounts show `—`:** The explorer cannot safely infer a meaningful transfer amount from the transaction. This usually means the action was structural or permission-related, not that the transaction did nothing.

### Blocks

Recent blocks sorted by recency: block height, hash, proposer label, transaction count, and timestamp. Use it to confirm the rollup is still producing blocks and recent throughput looks healthy.

### NFTs

Placeholder — the UI is ready for NFT indexer integration, but the endpoint is not yet wired. Empty until connected.

## Transaction Proof Modal

Click any transaction row to open `Transaction Proof`.

**Top summary:** Chain ID, confirmation status, source description, and stats: `Chain`, `Block`, `Gas`, `Fee`.

**Contract Info:**

| Field | Description |
| --- | --- |
| `Package` | Move package address |
| `Module` | Module name |
| `Function` | Function name |
| `Sender` | Effective sender |
| `Recipient` | Resolved target recipient |
| `Fee payer` | Fee-paying account if different from sender |
| `VM sender` | Inner execution context sender when it differs from the outer wrapper |
| `Wrapper` | Higher-level wrapper such as authz execution |
| `Grantee` | Delegated grantee when authz was used |

**Summary text:** Normalized human-readable summary derived from events and payload hints — loan request summary, amount, tenor, borrower.

**TX Hash section:**
- Full hash with copy support
- `Open tx JSON` — direct link to raw transaction JSON
- `Copy all proof details` — text export of normalized proof information

## Account Detail Modal

`Your account details` shows: address, tx count in the explorer cache, latest seen timestamp, and network. Browser-context only — not a full chain account profile.

## Verify Contracts Modal

Reads recent transactions already visible in the page, extracts `module_address`, `module_name`, and `function_name`, deduplicates by package + module + function, and displays each as a structured card.

Each card shows: `Package`, `Module`, `Function`, and `Observed action` (when the higher-level action label differs from the plain `module::function` target).

**Useful for:**
- Checking which Move entrypoints a product action really hit
- Confirming whether authz wrappers resolved to the expected inner call
- Comparing recent usage against documented package behavior

**Not yet:** source code verification, bytecode hash comparison, package upgrade lineage proof, or formal contract verification.

## Interpretation Rules

| What you see | What it means |
| --- | --- |
| `Saved locally` | Browser local storage, not onchain identity |
| `Grant Allowance` | Likely authz setup, not the final business action |
| `Authz Exec -> ...` | Wrapper differs from the inner Move call |
| `Amount: —` | Explorer could not extract a clean single amount |
| `Transaction Proof` | Normalized view — `Open tx JSON` is the raw source |

## Current Limitations

- Optimized for recent activity, not long-term archival search
- NFT support is a placeholder
- Contract verification is observational, not cryptographic
- Account surfaces are browser-context helpers, not full identity pages

## Related Docs

- [Frontend](/app/frontend)
- [Move Contract](/app/smartcontract)
- [API](/reference/api)
- [Testnet Evidence](/reference/testnet)
