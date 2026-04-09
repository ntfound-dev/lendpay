# Move Contract

The Move contract layer is the current live onchain package that enforces LendPay credit, rewards, tokenomics, and ecosystem settlement on the rollup.

## VM Status

- `Move`: live and documented in this page
- `EVM`: planned, docs placeholder only for now
- `Wasm`: planned, docs placeholder only for now

## Responsibilities

- store borrower credit state onchain
- handle request, approval, repayment, and default flows
- manage protocol treasury and liquidity custody
- issue and track native `LEND`
- run points, rewards, staking, fee, and governance logic
- register partner routes for ecosystem-linked usage
- store bridge-route metadata and bridge intents without pretending to execute the bridge inside Move

## Repo Location

- `smarcontract/Move.toml`
  Package manifest for the Move app. It defines the package name, named addresses, and dependency wiring used when the contract is built or published.
- `smarcontract/sources/bootstrap`
  One-time initialization logic. This folder is used to create the protocol state, wire modules together, and set up native assets during bootstrap.
- `smarcontract/sources/credit`
  Core credit system. This is where loan requests, approvals, treasury movements, borrower profiles, merchant routes, and reputation state live.
- `smarcontract/sources/rewards`
  Borrower incentive logic. This folder manages points, claimable `LEND`, campaigns, and referral-style reward flows.
- `smarcontract/sources/tokenomics`
  `LEND` economic layer. It contains fee handling, staking, governance, supply control, and pure tokenomics quote helpers.
- `smarcontract/sources/shared`
  Shared utilities. This folder holds common error definitions and asset helper functions used by the rest of the package.

## Core Modules

- `loan_book.move`
  Main borrower lifecycle module. It creates loan requests, stores installment schedules, handles approval and rejection, tracks repayment progress, and marks default or collateral seizure outcomes.
- `treasury.move`
  Protocol vault and liquidity custody. This module receives liquidity, disburses approved loans, records repayments, and tracks locked collateral and treasury balances.
- `profiles.move`
  Credit product rules. It defines borrower profiles, qualification checks, principal caps, APR-related product constraints, and collateral requirement quotes for secured flows.
- `merchant_registry.move`
  Ecosystem app registry. It stores partner route metadata, enables or disables merchants, and exposes partner fee or route lookup information for app-linked credit.
- `bridge.move`
  Cross-VM helper registry. It stores bridge route metadata, tracks whether a route is actually live, keeps sell-side liquidity venue metadata, and records user bridge intents plus resolution status so the protocol has an onchain audit trail for `LEND` exit paths.
- `reputation.move`
  Borrower identity and trust record. It keeps username attestations, verified identity flags, and repayment or activity counters used to understand user quality onchain.
- `rewards.move`
  Loyalty and perks engine. It manages points, claimable `LEND`, point redemptions, and user perk actions such as limit boosts, APR discounts, and badge-style unlocks.
- `lend_token.move`
  Native `LEND` asset control. It is responsible for minting, transfers, reserve handling, and balance or supply views for the protocol token.
- `fee_engine.move`
  Fee accounting and settlement. This module quotes origination and late fees, tracks fee state, and supports paying outstanding protocol fees in `LEND`.
- `staking.move`
  Staking state machine for `LEND`. It handles stake, unstake, reward accrual, reward claims, and reporting of total staked balances.
- `governance.move`
  Onchain governance flow. This module stores proposals, voting state, and finalization logic for protocol-level decisions.

## Supporting Files Worth Knowing

- `bootstrap.move`
  Calls the one-time protocol initialization flow that wires together config, treasury, rewards, tokenomics, and supporting registries.
- `config.move`
  Holds admin-configurable protocol policy such as pause controls, treasury admin, fee policy, reward policy, tier policy, and governance settings.
- `campaigns.move`
  Handles campaign allocation and claims so the protocol can distribute targeted rewards outside the base borrower flow.
- `tokenomics.move`
  Provides quote helpers for point conversion, tier thresholds, discounts, burn logic, and fee split math.
- `viral_drop.move`
  Example live ecosystem route that receives funded balance from the protocol and converts it into an in-app purchase or receipt flow.

## Detailed File Guide

### `bootstrap.move`

Source: `smarcontract/sources/bootstrap/bootstrap.move`

This file is the bootstrap orchestrator. It does not hold protocol state by itself. Its only job is to initialize all other modules in the correct order.

- `initialize_protocol(admin, treasury_admin, loan_asset_metadata)`
  Creates the whole protocol from zero.
  It initializes `LEND`, writes core config, creates treasury vaults, turns on fee, staking, governance, profile, merchant, reputation, rewards, referral, campaign, and loan registries, then registers example ecosystem routes like `viral_drop` and the mock apps.

Why it matters:

- this is the one transaction that turns an empty package into a working protocol
- if this order is wrong, later modules can fail because dependencies such as config or token metadata do not exist yet

### `loan_book.move`

Source: `smarcontract/sources/credit/loan_book.move`

This is the main credit engine. It stores borrower requests and live loans.

Main state:

- `LoanRequest`
  Pending borrower intent before an operator approves it.
- `Loan`
  Active or completed credit agreement after approval.
- `LoanBook`
  Global registry that stores all requests and loans and increments IDs.

Main entry functions:

- `initialize(admin)`
  Creates the global `LoanBook` resource.
- `request_loan(borrower, amount, tenor_months)`
  Opens a plain request without a named profile.
- `request_profiled_loan(borrower, profile_id, amount, tenor_months)`
  Opens a request using profile rules from `profiles.move`.
- `request_collateralized_loan(borrower, profile_id, amount, collateral_amount, tenor_months)`
  Validates collateral requirements, locks borrower `LEND` in the treasury, then creates the request.
- `approve_request(admin, request_id, apr_bps, installment_amount, installments_total, grace_period_seconds)`
  Converts a pending request into a live loan.
  This function also applies APR discounts from held `LEND` and rewards points, disburses principal from treasury, records reputation and rewards, triggers referral rewards, and assesses origination fee.
- `reject_request(admin, request_id)`
  Rejects a pending request and returns any locked collateral.
- `cancel_request(borrower, request_id)`
  Lets the borrower cancel a pending request and get collateral back before approval.
- `repay_installment(borrower, loan_id)`
  Moves one installment back into treasury, updates due state, records on-time or late behavior, assesses late fees if needed, releases collateral on full repayment, and may burn protocol `LEND` after full payoff.
- `mark_default(admin, loan_id)`
  Marks an overdue active loan as defaulted, updates reputation and rewards, and liquidates locked collateral if it exists.

Important internal behavior:

- `request_loan_internal(...)`
  Shared path used by all request entry functions.
  It checks terms, prevents duplicate active credit, writes the request, and emits the request event.
- `assert_request_terms(amount, tenor_months)`
  Shared sanity checks for pause state, amount, and tenor.
- `has_pending_request_for(...)` and `has_active_loan_for(...)`
  Prevent a user from stacking overlapping loans or pending requests.

Key views:

- `get_request(request_id)` and `get_loan(loan_id)`
  Return the full stored structs.
- `request_profile_id`, `request_collateral_amount`, `request_status`
  Small request-focused view helpers.
- `loan_borrower`, `loan_status`, `loan_profile_id`, `loan_collateral_amount`, `loan_collateral_state`, `loan_apr_bps`
  Small loan-focused view helpers.
- `loan_is_active`, `loan_is_repaid`
  Boolean convenience helpers.
- `active_loan_id_of(user)`
  Returns the current active loan ID for a borrower.
- `has_pending_request_of(user)` and `has_active_loan_of(user)`
  Useful for frontend or backend gating.
- `locked_collateral_of(user)`
  Sums collateral that is still tied up across pending requests and active loans.
- `force_loan_due_for_testing(admin, loan_id)`
  Test-only helper that forces a loan due immediately.

### `bridge.move`

Source: `smarcontract/sources/credit/bridge.move`

This file is a bridge helper layer, not a custom bridge engine.

Its job is to keep route truth and user intent onchain while the actual transfer still happens through official Initia UX and infrastructure such as Interwoven Bridge.

Main state:

- `BridgeRoute`
  One route definition for a supported bridge path.
  It stores source chain, source denom, destination chain, destination denom, transfer method, live status, mapping status, liquidity venue, pool reference, swap readiness, and operator notes such as ERC20 mapping reference.
- `BridgeIntent`
  One user intent to bridge `LEND` out of the rollup.
  It stores who opened it, which route was used, how much was requested, destination recipient, and whether the intent was completed, cancelled, or failed.
- `BridgeRegistry`
  Global registry for all routes and intents.

Main entry functions:

- `initialize(admin)`
  Creates the global bridge registry.
- `register_route(...)`
  Lets admin register a supported route, such as `lendpay-4 -> MiniEVM`, with current mapping, liquidity venue, and activity status.
- `update_route_status(...)`
  Lets admin keep a route honest by turning it on or off and updating mapping reference or notes.
- `update_route_liquidity(...)`
  Lets admin publish or update sell-side venue metadata like `InitiaDEX`, pool references, liquidity readiness, and whether swap should be exposed to users yet.
- `open_bridge_intent(requester, route_id, amount, recipient)`
  Lets a borrower record a real bridge intent, but only if the route is actually live.
  This is important because it avoids pretending that a preview-only route is executable.
- `cancel_bridge_intent(requester, intent_id)`
  Lets the requester cancel a still-pending intent.
- `resolve_bridge_intent(admin, intent_id, successful, settlement_reference, note)`
  Lets an operator mark the recorded intent as completed or failed after the external bridge path finishes.

Key views:

- `get_route(route_id)` and `get_intent(intent_id)`
  Return the stored structs for route and intent records.
- `route_is_live(route_id)`
  Small truth helper used to distinguish real executable paths from preview-only paths.
- `route_destination_asset_reference(route_id)`
  Returns operator-published mapping information, such as a destination ERC20 address.
- `route_liquidity_venue(route_id)`, `route_pool_reference(route_id)`, `route_liquidity_status(route_id)`, `route_swap_enabled(route_id)`
  Liquidity-side helpers for the sell venue after the bridge step.
- `route_is_sell_ready(route_id)`
  Tells the app whether the route is not only bridge-live, but also ready for the destination swap venue.
- `intent_status(intent_id)` and `intent_settlement_reference(intent_id)`
  Useful for backend sync and user-facing status reporting.

Why it matters:

- it gives `LEND` a smart-contract-side place to represent sell and exit routes
- it gives the protocol a clear place to publish where bridged `LEND` should actually be sold
- it stays honest about the boundary: the contract stores metadata and audit state, while Interwoven Bridge still handles the real asset transfer flow

### Current Local Bridge Proof

The current local `lendpay-4` package has already been upgraded with `bridge.move`, initialized, and given one registered route.

Recorded local hashes:

- package upgrade including `bridge.move`: `A36F31E75969F9D285EEA503F6046D065AA3A0B56561B5E04F2EB9DAB8D251FA`
- `bridge::initialize`: `8C7F9944ABB35AA2F5BFF2C7F596D1A6F21D7CE7B7C8D5F3BDD7F4C82561AE30`
- `bridge::register_route`: `A2D0DF04150D326D951A0EE13AA4600EBD22D6F03C62F6440DB5913B05A54C53`

Published route summary:

- source chain: `lendpay-4`
- source denom: `ulend`
- destination chain: `evm-1`
- destination denom: `erc20/LEND`
- liquidity venue: `InitiaDEX`
- pool reference: `LEND/INIT`
- liquidity status: `coming_soon`
- swap enabled: `false`

This is the important boundary:

- the route truth is now onchain
- the UI and backend can prove that truth from the rollup
- but the actual sell route is still preview-only until the official MiniEVM mapping is published

### `treasury.move`

Source: `smarcontract/sources/credit/treasury.move`

This file is the protocol vault layer. It controls liquidity, reward reserve, and collateral custody.

Main state:

- `Treasury`
  Stores vault references and aggregate counters such as deposited liquidity, disbursed principal, repaid amount, collateral totals, reward reserve, claimed rewards, and burned protocol `LEND`.

Main entry functions:

- `initialize(admin)`
  Creates three vaults:
  loan liquidity vault, collateral vault, and seized collateral vault.
- `deposit_liquidity(admin, amount)`
  Moves the loan asset into the protocol liquidity vault.
- `withdraw_seized_collateral(admin, recipient, amount)`
  Lets treasury admin withdraw liquidated collateral from the seized vault.

Protocol-only internal functions:

- `lock_lend_collateral(borrower, amount)`
  Pulls `LEND` from the borrower into the collateral vault.
- `release_lend_collateral(borrower, amount)`
  Returns locked collateral back to the borrower.
- `liquidate_lend_collateral(amount)`
  Moves collateral from the active collateral vault into the seized vault.
- `disburse_loan(borrower, amount)`
  Pays approved principal from liquidity vault to borrower.
- `record_repayment(borrower, amount)`
  Pulls repayment asset from borrower back into protocol liquidity.
- `release_reward(amount)`
  Reduces reward reserve when `LEND` rewards are claimed.
- `absorb_protocol_lend(amount)`
  Increases the internal reward reserve accounting when the protocol receives `LEND`.
- `burn_protocol_lend(amount)`
  Decreases reward reserve accounting when reserve `LEND` is burned.

Key views:

- asset metadata helpers: `loan_asset_metadata`, `lend_collateral_metadata`
- vault balances: `liquidity_balance`, `reward_reserve`, `collateral_balance`, `seized_collateral_balance`
- accounting totals: `total_collateral_locked`, `total_collateral_released`, `total_collateral_liquidated`, `total_disbursed`, `total_repaid`, `total_lend_claimed`, `total_protocol_lend_burned`
- vault addresses: `loan_vault_address`, `collateral_vault_address`, `seized_collateral_vault_address`

### `profiles.move`

Source: `smarcontract/sources/credit/profiles.move`

This file defines the product catalog and qualification logic for each loan type.

Main state:

- `CreditProfile`
  Single product definition with principal cap hint, tenor cap, minimum LEND holding, and collateral rules.
- `ProfileRegistry`
  Registry of all product profiles.
- `ProfileQuote`
  A computed eligibility result for one user and one profile.

Default profiles created in `initialize(admin)`:

- `PROFILE_MICRO_LOAN`
  Small unsecured starter loan.
- `PROFILE_STANDARD_BNPL`
  Bigger unsecured BNPL product that requires some held `LEND`.
- `PROFILE_CREDIT_LINE`
  Revolving-style line with higher holding requirement.
- `PROFILE_COLLATERALIZED`
  Secured product with explicit collateral ratio.

Main functions:

- `initialize(admin)`
  Seeds the default profiles.
- `update_profile(...)`
  Lets admin change max principal, tenor, minimum holdings, and collateral behavior for a profile.
- `get_profile(profile_id)`
  Returns the raw profile definition.
- `profile_count()`
  Returns how many profiles exist.
- `quote_profile(user, profile_id)`
  This is the core decision helper.
  It calculates current held `LEND`, tier-based multiplier, rewards-based credit boost, final max principal, and whether the user qualifies.
- `qualifies_for_profile(user, profile_id)`
  Boolean wrapper around `quote_profile`.
- `max_principal_for(user, profile_id)`
  Returns the computed principal cap for a user.
- `required_collateral_for(profile_id, amount)`
  Computes required collateral using the profile collateral ratio.
- `assert_request_allowed(user, profile_id, amount, tenor_months)`
  Blocks invalid unsecured requests.
- `assert_collateral_request_allowed(user, profile_id, amount, tenor_months, collateral_amount)`
  Blocks invalid collateralized requests and verifies collateral sufficiency.

Important design note:

- this module currently lets held `LEND` and points-based limit boost affect product sizing
- that is useful to know because it directly shapes underwriting behavior

### `merchant_registry.move`

Source: `smarcontract/sources/credit/merchant_registry.move`

This file is the ecosystem merchant directory for app-linked credit.

Main state:

- `Merchant`
  Stores merchant address, category hash, listing fee, partner fee, and active flag.
- `MerchantRegistry`
  Stores all merchant records and the next merchant ID.

Main functions:

- `initialize(admin)`
  Creates the registry.
- `register_merchant(admin, merchant_address, category_hash, listing_fee_bps, partner_fee_bps)`
  Adds a new merchant route with pricing metadata.
- `set_active(admin, merchant_id, active)`
  Enables or disables a merchant route without deleting it.
- `get_merchant(merchant_id)`
  Returns the raw merchant struct.
- `next_merchant_id()`
  Useful for admin tooling and tests.
- `quote_partner_fee(merchant_id, order_amount)`
  Computes the partner fee for a specific order amount.
- `merchant_address(merchant_id)`
  Returns where app-linked routed funds should go.
- `is_active(merchant_id)`
  Returns route availability.

### `reputation.move`

Source: `smarcontract/sources/credit/reputation.move`

This file is the borrower track-record registry.

Main state:

- `ReputationEntry`
  Stores request count, approval count, repayment/default history, on-time or late payment counters, username hash, and verification flag.
- `ReputationRegistry`
  Global collection of reputation entries.

Main functions:

- `initialize(admin)`
  Creates the registry.
- `attest_username(admin, user, username_hash)`
  Stores a verified username attestation for a borrower.
- `record_request(user)`
  Internal protocol hook fired when a request is created.
- `record_approval(user)`
  Internal protocol hook fired when a request is approved.
- `record_on_time_payment(user)`
  Increments clean repayment behavior.
- `record_late_payment(user)`
  Increments late behavior.
- `record_full_repayment(user)`
  Records one completed loan lifecycle.
- `record_default(user)`
  Records a default.
- `get_entry(user)`
  Returns the full reputation struct, or a zeroed fallback if the user has no history yet.
- `has_verified_username(user)`
  Shortcut for identity verification state.
- `username_hash_of(user)`
  Returns the stored username hash.
- `platform_actions_of(user)`
  Sums multiple activity counters into a simple behavior number.
- `loans_requested_of(user)` and `loans_approved_of(user)`
  Small counter helpers used by integrations.

### `rewards.move`

Source: `smarcontract/sources/rewards/rewards.move`

This file is the loyalty engine that turns protocol activity into points, claimable `LEND`, and borrower perks.

Main state:

- `RewardAccount`
  Tracks points, points spent, lifetime points, claimable and claimed `LEND`, repayment streak, limit boost, APR discount, premium checks, badges, and last reward time.
- `RewardsRegistry`
  Stores all reward accounts.

Automatic reward hooks:

- `reward_request`
- `reward_approval`
- `reward_on_time_payment`
- `reward_late_payment`
- `reward_full_repayment`
- `reward_referral`
- `penalize_default`

These are friend-only hooks called by other modules such as `loan_book` and `referral`.

Borrower-facing entry functions:

- `claim_lend(user)`
  Moves accumulated claimable `LEND` from the protocol reserve into the user wallet.
- `redeem_points_to_claimable_lend(user, points_to_redeem)`
  Burns points and converts them into future-claimable `LEND`.
- `spend_points_for_limit_boost(user)`
  Spends points to increase the borrower limit boost basis points.
- `spend_points_for_interest_discount(user, whole_percent)`
  Spends points to buy APR discount.
- `unlock_premium_credit_check(user)`
  Spends points to unlock a premium check slot.
- `redeem_exclusive_badge(user)`
  Spends points to mint a badge-like perk counter.

Key views:

- `get_account(user)`
  Returns the full reward account.
- `interest_discount_bps_of`
- `credit_limit_boost_bps_of`
- `premium_checks_available_of`
- `badge_count_of`
- `points_balance_of`

Important internal behavior:

- `grant_points(...)`
  Centralized reward writer that also auto-adds claimable `LEND` based on point conversion rate.
- `spend_points_in_registry(...)`
  Shared debit path for all points-spending actions.
- `points_to_lend(points_delta)`
  Converts points to `LEND` using config basis points.

### `lend_token.move`

Source: `smarcontract/sources/tokenomics/lend_token.move`

This file defines the native `LEND` asset and how the protocol manages reserve, burns, staking inventory, and per-user token accounting.

Main state:

- `BalanceEntry`
  Per-user helper state for staked amount, rewards received, burned amount, and fee contribution.
- `LendLedger`
  Global token ledger that stores mint and burn caps, reserve and staking vault refs, supply totals, and user-side accounting metadata.

Main entry functions:

- `initialize(admin)`
  Creates the `LEND` coin metadata and the reserve and staking vaults.
- `mint_to_protocol_reserve(admin, amount)`
  Mints fresh `LEND` directly into protocol reserve and tells treasury that reserve inventory grew.
- `deposit_to_protocol_reserve(user, amount)`
  Lets treasury admin top up reserve with existing `LEND`.
- `transfer(sender, recipient, amount)`
  Plain token transfer wrapper with protocol event emission.

Protocol-only internal functions:

- `distribute_from_protocol(user, amount)`
  Sends reserve `LEND` out to users for rewards or claims.
- `burn_from_protocol_reserve(amount)`
  Burns `LEND` from reserve, typically after successful repayment logic asks for burn.
- `collect_fee_from_user(user, protocol_credit, burn_amount)`
  Pulls `LEND` fee payment from a user, routes part into reserve, and burns the configured part.
- `move_to_staked(user, amount)`
  Moves user `LEND` into staking vault and updates internal staked balance.
- `release_from_staked(user, amount)`
  Returns staked `LEND` back to the wallet.

Key views:

- token metadata and vaults: `metadata_address`, `reserve_vault_address`, `staking_vault_address`
- user balances: `balance_of`, `staked_balance_of`, `total_balance_of`
- governance weight: `voting_power_of`
- protocol balances: `protocol_inventory`, `staked_inventory`
- supply totals: `total_minted`, `total_burned`, `circulating_supply`

Important design note:

- `voting_power_of(user)` is currently equal to total held plus staked `LEND`
- governance therefore uses token balance directly as power

### `fee_engine.move`

Source: `smarcontract/sources/tokenomics/fee_engine.move`

This file keeps fee debt per loan and handles settlement in `LEND`.

Main state:

- `FeeState`
  Stores origination fee due, late fee due, and paid totals for one loan.
- `FeeRegistry`
  Stores all loan fee states plus aggregate accrued totals for treasury, staking, burn, and total paid fees.
- `FeeQuoted`
  Helper struct returned by quote functions.

Main functions:

- `initialize(admin)`
  Creates the fee registry.
- `assess_origination_fee(loan_id, borrower, principal)`
  Internal hook used when a request is approved.
- `assess_late_fee(loan_id, borrower, installment_amount)`
  Internal hook used when a payment misses the grace window.
- `pay_outstanding_fees_in_lend(user, loan_id)`
  Lets a borrower clear all current fee debt in `LEND`.
  The function computes discounted due amounts, splits shares between treasury, staking, and burn, collects payment through `lend_token`, funds staking rewards, and zeroes the debt counters.
- `quote_origination_fee(principal, borrower, pay_in_lend)`
  Quotes fee before payment.
- `quote_late_fee(installment_amount, borrower, pay_in_lend)`
  Quotes late fee before payment.
- `get_fee_state(loan_id)`
  Returns the current fee record for a loan.

Important internal helpers:

- `split_standard_fee(amount)`
  Uses tokenomics split for normal fees.
- `split_late_fee(amount)`
  Uses the late-fee-specific burn split.
- `apply_discount(amount, discount_bps)`
  Shared percentage reduction helper.

### `staking.move`

Source: `smarcontract/sources/tokenomics/staking.move`

This file runs the staking reward index and user staking positions.

Main state:

- `StakePosition`
  Stores staked amount, reward debt, pending rewards, lifetime claimed rewards, and last stake time for one user.
- `StakingRegistry`
  Stores all positions, total staked, reward index, undistributed rewards, and total claimed rewards.

Main functions:

- `initialize(admin)`
  Creates the staking registry.
- `stake(user, amount)`
  Syncs rewards, accrues pending rewards for the position, moves `LEND` into staking vault, and increases total staked.
- `unstake(user, amount)`
  Syncs rewards, accrues pending rewards, decreases staked position, and returns `LEND` from staking vault.
- `claim_rewards(user)`
  Syncs rewards, crystallizes pending rewards, sends reserve `LEND` to the user, and records total claimed.
- `fund_from_fee(amount)`
  Friend-only hook used by `fee_engine` to feed staking rewards from fee revenue.
- `quote_claimable(user)`
  Read-only estimator of what the user could claim right now.
- `total_staked()`
  Returns protocol-wide staked amount.
- `undistributed_rewards()`
  Returns rewards waiting to be spread into the reward index.

Important internal helpers:

- `sync_registry_rewards`
  Moves undistributed rewards into the global reward index.
- `accrue_position`
  Updates a position pending reward amount from the latest index.
- `projected_reward_index`
  Lets the view path estimate rewards without mutating state.

### `governance.move`

Source: `smarcontract/sources/tokenomics/governance.move`

This file manages proposals and votes using `LEND` voting power.

Main state:

- `Proposal`
  Stores proposal metadata, yes and no vote totals, end time, and current status.
- `VoteReceipt`
  Prevents duplicate voting and records each voter choice.
- `GovernanceRegistry`
  Stores all proposals and receipts.

Main functions:

- `initialize(admin)`
  Creates the governance registry.
- `propose(proposer, proposal_type, title_hash, body_hash)`
  Opens a new proposal if the proposer has enough `LEND` voting power to cross the threshold.
- `vote(voter, proposal_id, support)`
  Casts a yes or no vote using current `LEND` voting power and stores a receipt so the same wallet cannot vote twice.
- `finalize(actor, proposal_id)`
  Closes a proposal after voting period ends and checks quorum plus yes/no majority.
- `get_proposal(proposal_id)`
  Returns the raw proposal struct.
- `next_proposal_id()`
  Returns the next available proposal ID.
- `has_user_voted(voter, proposal_id)`
  Convenience checker for UI or backend.

## Runtime Role

The contract is the source of truth for:

- loan requests and approvals
- installment repayment state
- collateral locks
- borrower reputation updates
- claimable `LEND`
- partner route settlement

The frontend signs transactions, the backend prepares and mirrors data, and the smartcontract finalizes the actual protocol state.

## Related Docs

- [Frontend](/app/frontend)
- [Backend](/app/backend)
- [Onchain Modules](/protocol/move-package)
- [EVM Contract (Soon)](/app/evm-contract)
- [Wasm Contract (Soon)](/app/wasm-contract)
