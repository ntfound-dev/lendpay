# LendPay Move Package

This package implements the onchain credit protocol for LendPay.

It uses real Initia fungible assets for:

- loan liquidity custody via a protocol vault store
- native `LEND` issuance via Initia coin metadata
- protocol `LEND` reserve custody
- staking custody for staked `LEND`

## Technical Architecture

Main module groups:

- [`sources/bootstrap`](./sources/bootstrap): one-time protocol initialization
- [`sources/credit`](./sources/credit): config, treasury, loan book, profiles, merchants, reputation
- [`sources/rewards`](./sources/rewards): rewards accounting and campaign logic
- [`sources/tokenomics`](./sources/tokenomics): LEND asset, fees, staking, governance
- [`sources/shared`](./sources/shared): common errors and asset helpers

Core modules:

- [`bootstrap.move`](./sources/bootstrap/bootstrap.move): initializes protocol state and native assets
- [`loan_book.move`](./sources/credit/loan_book.move): request, approve, repay, default, and collateral handling
- [`treasury.move`](./sources/credit/treasury.move): custody and disbursement of native assets
- [`profiles.move`](./sources/credit/profiles.move): product profiles and collateral requirements
- [`merchant_registry.move`](./sources/credit/merchant_registry.move): merchant partner rail
- [`reputation.move`](./sources/credit/reputation.move): borrower identity and repayment reputation
- [`rewards.move`](./sources/rewards/rewards.move): points, LEND claims, point spending, and borrower perks
- [`campaigns.move`](./sources/rewards/campaigns.move): campaign allocations and claims
- [`lend_token.move`](./sources/tokenomics/lend_token.move): native LEND ledger and supply control
- [`fee_engine.move`](./sources/tokenomics/fee_engine.move): origination and late fee accounting
- [`staking.move`](./sources/tokenomics/staking.move): staking and staking reward state
- [`governance.move`](./sources/tokenomics/governance.move): proposal, voting, and finalize flow

## Module Responsibility Map

Key entry and view functions by module:

- `bootstrap::initialize_protocol`
  Creates the protocol package state and wires config, treasury, rewards, tokenomics, and supporting registries.
- `config`
  Admin policy module for pause state, treasury admin, fee policy, reward policy, tier policy, point spending policy, and governance policy.
- `loan_book`
  Core borrower lifecycle:
  `request_loan`, `request_profiled_loan`, `request_collateralized_loan`, `approve_request`, `reject_request`, `cancel_request`, `repay_installment`, `mark_default`.
- `treasury`
  Native asset custody and accounting views:
  `deposit_liquidity`, balances, disbursement totals, repayment totals, collateral totals, and vault addresses.
- `profiles`
  Product qualification and collateral quoting:
  `quote_profile`, `qualifies_for_profile`, `max_principal_for`, `required_collateral_for`.
- `merchant_registry`
  Merchant rail management:
  `register_merchant`, `set_active`, `get_merchant`, `quote_partner_fee`.
- `reputation`
  Identity and borrower reputation:
  `attest_username`, `get_entry`, `has_verified_username`, `platform_actions_of`.
- `rewards`
  Borrower incentives and perks:
  `claim_lend`, `redeem_points_to_claimable_lend`, `spend_points_for_limit_boost`, `spend_points_for_interest_discount`, `unlock_premium_credit_check`, `redeem_exclusive_badge`.
- `campaigns`
  Campaign creation and distribution:
  `create_campaign`, `allocate_claim`, `close_campaign`, `claim_campaign`, `claimable_amount`, `can_claim`.
- `lend_token`
  Native LEND controls:
  `initialize`, `mint_to_protocol_reserve`, `deposit_to_protocol_reserve`, `transfer`, plus balance and supply views.
- `fee_engine`
  Fee settlement:
  `pay_outstanding_fees_in_lend`, `quote_origination_fee`, `quote_late_fee`, `get_fee_state`.
- `staking`
  Staking lifecycle:
  `stake`, `unstake`, `claim_rewards`, `quote_claimable`, `total_staked`.
- `governance`
  Onchain governance:
  `propose`, `vote`, `finalize`, `get_proposal`, `has_user_voted`.
- `tokenomics`
  Pure quote helpers for tier, discounts, fee split, burn, allocation, and point conversion.

## Onchain Flow

The credit lifecycle is:

1. borrower requests a profiled checkout loan
2. operator approves the request
3. treasury disburses the loan asset
4. borrower repays installments
5. rewards and reputation are updated
6. collateral unlocks on full repayment or is seized on default

The contract also supports:

- merchant-aware requests
- point spending for perks
- claimable LEND
- staking and staking rewards
- governance
- campaign allocations and claims

## Testing Scope

The local test suite exercises:

- borrower request and approval paths
- repayment and reward updates
- fee quoting and fee payment in LEND
- governance proposal and voting
- campaign allocation and claim behavior
- merchant-linked request behavior
- collateralized request behavior

## Current Local Rollup

The package is already deployed on the local MiniMove rollup:

- chain id: `lendpay-local-1`
- RPC: `http://localhost:26657`
- module address: `0x52683DF957C5538C0FA362B068804A120E408D2B`
- loan asset metadata: `0x25c4855dbee8a475c72526cc888c20562befd9cac8ceb78367ed490e1b0dab3`
- deploy tx: `47C0DF5AE56C885F5565BB07FE00332FD227BCAC5678C9A049B1C8E510F16276`
- bootstrap tx: `75FAC78441FF0CDEBE657FE72A2DA8E7B6519809DB279FDC8FC734AF71DBD823`
- fund liquidity tx: `186826C23EB72A5C3FD97214263FE59AA5DAC4DCEE564F73A19F3EA2524ED367`
- mint reserve tx: `4368AAB6902C76D4E43F7E045A5FEA0CCE9505845281786D57A553824D9C7ADC`

## Build and Test

Run local tests in dev mode:

```bash
./scripts/rollup/test.sh
```

Build in dev mode:

```bash
./scripts/rollup/build.sh
```

To build against a real deployed package address:

```bash
LENDPAY_PACKAGE_ADDRESS=0x... ./scripts/rollup/build.sh
```

## Local Validation

Tests currently cover:

- request and approval flow
- repayment updates
- rewards claims
- fee handling
- staking
- governance
- campaign claims
- merchant-linked credit paths
- collateralized request paths

## Rollup Deployment Flow

1. Export rollup env and publish the package:

```bash
source ./scripts/rollup/.env.example
./scripts/rollup/deploy.sh
```

This follows the official MoveVM flow: `minitiad move deploy --upgrade-policy COMPATIBLE`
with a concrete named address for `lendpay`. If `LENDPAY_PACKAGE_ADDRESS` is blank,
the scripts derive the module address from the deployer key:

```bash
minitiad keys parse $(minitiad keys show $ROLLUP_KEY_NAME --address)
```

2. Set `LENDPAY_PACKAGE_ADDRESS` to that derived hex module address if you want to
pin it explicitly. If you keep using the same deploy key, the scripts can derive it
automatically.

3. Bootstrap the protocol:

```bash
TREASURY_ADMIN_ADDRESS=init1...
LOAN_ASSET_METADATA=0x...
./scripts/rollup/bootstrap.sh
```

4. Fund the loan liquidity vault with the configured loan asset:

```bash
AMOUNT=1000000 ./scripts/rollup/fund-liquidity.sh
```

5. Mint `LEND` into the protocol reserve:

```bash
AMOUNT=500000 ./scripts/rollup/mint-lend-reserve.sh
```

## Demo Borrower Flow

For the current local rollup, the example env file is already prefilled with the
live local chain values:

```bash
source ./scripts/rollup/.env.example
```

Then run the full borrower lifecycle:

```bash
./scripts/rollup/demo-flow.sh
```

The demo uses the existing local `Validator` key as borrower by default, then executes:

1. fund borrower with `umin`
2. attest `.init`-style username bytes onchain
3. request a profiled micro-loan
4. approve the loan as operator
5. repay all installments
6. claim earned `LEND`
7. pay outstanding origination fees in `LEND`
8. stake the remaining `LEND`
9. claim staking rewards

The demo artifacts are useful as deploy evidence and local validation records.

Artifacts land under:

```bash
artifacts/rollup/demo/
```

The final summary file is:

```bash
artifacts/rollup/demo/summary.json
```

## Important Runtime Notes

- For real deployment, `lendpay` must resolve to a concrete hex address. The deploy
  script passes it via `--named-addresses` so you do not need to edit `Move.toml`
  by hand.
- The shared rollup helper now auto-adds `LD_LIBRARY_PATH` when `MINITIAD_BIN`
  points to a local MiniMove binary directory that contains `libmovevm.x86_64.so`.
- `loan_asset_metadata` must be the metadata object address of the asset used for principal and repayment.
- `LEND` is initialized by the package itself during `bootstrap::initialize_protocol`.
- Loan disbursement and repayment now move real assets instead of updating accounting only.
- Rewards, fee collection, burns, and staking now move real `LEND`.
- Merchant checkout semantics are enforced at the application layer by pairing request metadata with merchant registry state and borrower UX, while loan execution remains protocol-native onchain.
