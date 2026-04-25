# Move Contract

The live onchain package enforcing LendPay credit, rewards, tokenomics, and ecosystem settlement on `lendpay-4`.

## VM Status

| VM | Status |
| --- | --- |
| Move | Live — documented here |
| EVM | Planned — placeholder only |
| Wasm | Planned — placeholder only |

## Responsibilities

- Store borrower credit state onchain
- Handle request, approval, repayment, and default flows
- Manage protocol treasury and liquidity custody
- Issue and track native `LEND`
- Run points, rewards, staking, fee, and governance logic
- Register partner routes for ecosystem-linked usage
- Store bridge-route metadata and bridge intents (does not execute the bridge itself)

## Repo Layout

| Path | Contents |
| --- | --- |
| `smarcontract/Move.toml` | Package manifest — name, named addresses, dependency wiring |
| `smarcontract/sources/bootstrap` | One-time protocol initialization |
| `smarcontract/sources/credit` | Loan requests, approvals, treasury, profiles, merchant routes, reputation |
| `smarcontract/sources/rewards` | Points, claimable LEND, campaigns, referrals |
| `smarcontract/sources/tokenomics` | Fee engine, staking, governance, supply control |
| `smarcontract/sources/shared` | Error definitions, asset helpers |

## Core Modules

| Module | Role |
| --- | --- |
| `loan_book.move` | Main borrower lifecycle — requests, approvals, repayment, default |
| `treasury.move` | Protocol vault — liquidity, disbursement, collateral custody |
| `profiles.move` | Credit product rules and eligibility checks |
| `merchant_registry.move` | Partner route metadata for app-linked credit |
| `bridge.move` | Bridge route registry and bridge intent audit trail |
| `reputation.move` | Username attestations, identity flags, repayment counters |
| `rewards.move` | Loyalty engine — points, claimable LEND, perks |
| `lend_token.move` | Native LEND asset control |
| `fee_engine.move` | Origination and late fee accounting |
| `staking.move` | LEND staking and reward accrual |
| `governance.move` | Proposals and token-weighted voting |

---

## Detailed Module Reference

### `bootstrap.move`

Source: `smarcontract/sources/bootstrap/bootstrap.move`

The bootstrap orchestrator. It does not hold protocol state — it initializes all other modules in the correct order.

- `initialize_protocol(admin, treasury_admin, loan_asset_metadata)` — creates the whole protocol from zero: initializes LEND, writes core config, creates treasury vaults, turns on fee, staking, governance, profile, merchant, reputation, rewards, referral, campaign, and loan registries, then registers example ecosystem routes.

This is the one transaction that turns an empty package into a working protocol. If this order is wrong, later modules fail because dependencies like config or token metadata do not exist yet.

---

### `loan_book.move`

Source: `smarcontract/sources/credit/loan_book.move`

The main credit engine. Stores borrower requests and live loans.

**State:**
- `LoanRequest` — pending borrower intent before operator approval
- `Loan` — active or completed credit agreement after approval
- `LoanBook` — global registry with all requests, loans, and incrementing IDs

**Entry functions:**

| Function | Description |
| --- | --- |
| `request_loan` | Opens a plain request without a named profile |
| `request_profiled_loan` | Opens a request using profile rules from `profiles.move` |
| `request_collateralized_loan` | Validates collateral requirements, locks borrower LEND, creates request |
| `approve_request` | Converts a pending request into a live loan — applies APR discounts, disburses principal, records reputation and rewards, triggers referral rewards, assesses origination fee |
| `reject_request` | Rejects a pending request and returns any locked collateral |
| `cancel_request` | Borrower cancels a pending request and recovers collateral before approval |
| `repay_installment` | Moves one installment to treasury, updates due state, records on-time or late behavior, assesses late fees if needed, releases collateral on full repayment, may burn LEND after full payoff |
| `mark_default` | Marks an overdue loan as defaulted, updates reputation and rewards, liquidates locked collateral |

**Key views:** `get_request`, `get_loan`, `loan_is_active`, `loan_is_repaid`, `active_loan_id_of`, `has_pending_request_of`, `has_active_loan_of`, `locked_collateral_of`.

---

### `bridge.move`

Source: `smarcontract/sources/credit/bridge.move`

A bridge helper layer, not a custom bridge engine. Its job is to keep route truth and user intent onchain while the actual transfer happens through official Initia infrastructure.

**State:**
- `BridgeRoute` — source chain, source denom, destination chain, destination denom, transfer method, live status, mapping status, liquidity venue, pool reference, swap readiness, operator notes
- `BridgeIntent` — who opened it, which route, how much, destination recipient, and resolution status
- `BridgeRegistry` — global registry for all routes and intents

**Entry functions:**

| Function | Description |
| --- | --- |
| `initialize` | Creates the global bridge registry |
| `register_route` | Admin registers a supported route with mapping, liquidity venue, and status |
| `update_route_status` | Admin keeps a route honest — turns it on or off, updates mapping reference |
| `update_route_liquidity` | Admin publishes sell-side venue metadata (DEX, pool, readiness, swap toggle) |
| `open_bridge_intent` | Borrower records a bridge intent — only allowed if the route is actually live |
| `cancel_bridge_intent` | Requester cancels a pending intent |
| `resolve_bridge_intent` | Operator marks intent completed or failed after the external bridge finishes |

**Key views:** `route_is_live`, `route_is_sell_ready`, `route_liquidity_status`, `route_swap_enabled`, `intent_status`, `intent_settlement_reference`.

**Current local proof:**

| Action | Hash |
| --- | --- |
| Package upgrade + `bridge.move` | `A36F31E75969F9D285EEA503F6046D065AA3A0B56561B5E04F2EB9DAB8D251FA` |
| `bridge::initialize` | `8C7F9944ABB35AA2F5BFF2C7F596D1A6F21D7CE7B7C8D5F3BDD7F4C82561AE30` |
| `bridge::register_route` | `A2D0DF04150D326D951A0EE13AA4600EBD22D6F03C62F6440DB5913B05A54C53` |

Route: `lendpay-4/ulend` → `evm-1/erc20/LEND`, venue `InitiaDEX`, pool `LEND/INIT`, `liquidity_status: coming_soon`, `swap_enabled: false`.

The route truth is onchain and provable. The actual sell route is preview-only until the official MiniEVM mapping is published.

---

### `treasury.move`

Source: `smarcontract/sources/credit/treasury.move`

The protocol vault layer. Controls liquidity, reward reserve, and collateral custody.

**State:** `Treasury` stores vault references and aggregate counters — deposited liquidity, disbursed principal, repaid amount, collateral totals, reward reserve, claimed rewards, and burned LEND.

**Three vaults created on `initialize`:** loan liquidity vault, collateral vault, seized collateral vault.

**Internal protocol functions:** `lock_lend_collateral`, `release_lend_collateral`, `liquidate_lend_collateral`, `disburse_loan`, `record_repayment`, `release_reward`, `absorb_protocol_lend`, `burn_protocol_lend`.

**Key views:** vault balances (`liquidity_balance`, `reward_reserve`, `collateral_balance`), accounting totals (`total_disbursed`, `total_repaid`, `total_collateral_liquidated`), vault addresses.

---

### `profiles.move`

Source: `smarcontract/sources/credit/profiles.move`

Defines the product catalog and qualification logic for each loan type.

**Default profiles:**

| Profile | Description |
| --- | --- |
| `PROFILE_MICRO_LOAN` | Small unsecured starter loan |
| `PROFILE_STANDARD_BNPL` | Bigger unsecured BNPL requiring some held LEND |
| `PROFILE_CREDIT_LINE` | Revolving-style line with higher holding requirement |
| `PROFILE_COLLATERALIZED` | Secured product with explicit collateral ratio |

**Key function:** `quote_profile(user, profile_id)` — calculates held LEND, tier-based multiplier, rewards-based credit boost, final max principal, and whether the user qualifies.

Note: held LEND and points-based limit boost affect product sizing, which directly shapes underwriting behavior.

---

### `merchant_registry.move`

Source: `smarcontract/sources/credit/merchant_registry.move`

The ecosystem merchant directory for app-linked credit.

**State:** `Merchant` stores address, category hash, listing fee, partner fee, and active flag. `MerchantRegistry` stores all records.

**Key functions:** `register_merchant`, `set_active`, `quote_partner_fee`, `merchant_address`, `is_active`.

---

### `reputation.move`

Source: `smarcontract/sources/credit/reputation.move`

The borrower track-record registry.

**State:** `ReputationEntry` stores request count, approval count, repayment/default history, on-time/late payment counters, username hash, and verification flag.

**Hooks called by other modules:** `record_request`, `record_approval`, `record_on_time_payment`, `record_late_payment`, `record_full_repayment`, `record_default`.

**Key functions:** `attest_username`, `has_verified_username`, `platform_actions_of`.

---

### `rewards.move`

Source: `smarcontract/sources/rewards/rewards.move`

The loyalty engine that turns protocol activity into points, claimable LEND, and borrower perks.

**State:** `RewardAccount` tracks points, points spent, lifetime points, claimable and claimed LEND, repayment streak, limit boost, APR discount, premium checks, badges, and last reward time.

**Automatic hooks (friend-only):** `reward_request`, `reward_approval`, `reward_on_time_payment`, `reward_late_payment`, `reward_full_repayment`, `reward_referral`, `penalize_default`.

**Borrower-facing entry functions:**

| Function | Description |
| --- | --- |
| `claim_lend` | Moves accumulated claimable LEND into the user wallet |
| `redeem_points_to_claimable_lend` | Burns points and converts them to future-claimable LEND at the fixed config rate |
| `spend_points_for_limit_boost` | Spends points to increase limit boost basis points |
| `spend_points_for_interest_discount` | Spends points to buy APR discount |
| `unlock_premium_credit_check` | Spends points to unlock a premium check slot |
| `redeem_exclusive_badge` | Spends points to mint a badge-like perk counter |

**Important:** `grant_points` also auto-adds claimable LEND based on the point conversion rate config. The season airdrop estimate shown in the Loyalty Hub is a separate off-chain display model based on `(user_points / total_platform_points) × season_allocation` — it does not correspond to `redeem_points_to_claimable_lend`.

---

### `lend_token.move`

Source: `smarcontract/sources/tokenomics/lend_token.move`

Native LEND asset control. Manages reserve, burns, staking inventory, and per-user token accounting.

**State:** `BalanceEntry` tracks staked amount, rewards received, burned amount, and fee contribution per user. `LendLedger` stores mint/burn caps, reserve and staking vault refs, supply totals, and user metadata.

**Key entry functions:** `initialize`, `mint_to_protocol_reserve`, `deposit_to_protocol_reserve`, `transfer`.

**Internal protocol functions:** `distribute_from_protocol`, `burn_from_protocol_reserve`, `collect_fee_from_user`, `move_to_staked`, `release_from_staked`.

**Key views:** `balance_of`, `staked_balance_of`, `total_balance_of`, `voting_power_of`, `circulating_supply`.

Note: `voting_power_of(user)` equals total held plus staked LEND — governance uses token balance directly as voting power.

---

### `fee_engine.move`

Source: `smarcontract/sources/tokenomics/fee_engine.move`

Fee accounting and settlement in LEND.

**State:** `FeeState` stores origination fee due, late fee due, and paid totals per loan. `FeeRegistry` stores all loan fee states plus aggregate treasury, staking, burn, and total paid fees.

**Key functions:**

| Function | Description |
| --- | --- |
| `assess_origination_fee` | Hook called when a request is approved |
| `assess_late_fee` | Hook called when a payment misses the grace window |
| `pay_outstanding_fees_in_lend` | Borrower clears all fee debt in LEND — computes discounts, splits treasury/staking/burn shares, collects payment, funds staking rewards, zeroes debt |
| `quote_origination_fee` / `quote_late_fee` | Quote before payment |

---

### `staking.move`

Source: `smarcontract/sources/tokenomics/staking.move`

Staking reward index and user staking positions.

**State:** `StakePosition` stores staked amount, reward debt, pending rewards, lifetime claimed, and last stake time. `StakingRegistry` stores all positions, total staked, reward index, undistributed rewards, and total claimed.

**Key functions:** `stake`, `unstake`, `claim_rewards`, `fund_from_fee` (friend hook from fee engine), `quote_claimable`, `total_staked`.

---

### `governance.move`

Source: `smarcontract/sources/tokenomics/governance.move`

Proposals and votes using LEND voting power.

**State:** `Proposal` stores metadata, yes/no vote totals, end time, and status. `VoteReceipt` prevents duplicate voting.

**Key functions:**

| Function | Description |
| --- | --- |
| `propose` | Opens a new proposal if proposer has enough LEND voting power |
| `vote` | Casts a yes/no vote using current LEND voting power; stores receipt |
| `finalize` | Closes a proposal after voting period, checks quorum and majority |
| `has_user_voted` | Convenience checker for UI or backend |

---

## Runtime Role

| Layer | Responsibility |
| --- | --- |
| Frontend | Signs transactions, renders borrower state |
| Backend | Prepares payloads, mirrors and syncs onchain state |
| Move contract | Finalizes protocol state — the source of truth |

## Related Docs

- [Frontend](/app/frontend)
- [Backend](/app/backend)
- [Onchain Modules](/protocol/move-package)
- [EVM Contract (Soon)](/app/evm-contract)
- [Wasm Contract (Soon)](/app/wasm-contract)
