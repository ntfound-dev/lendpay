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
- [`sources/credit`](./sources/credit): config, treasury, loan book, profiles, merchants, bridge helper state, reputation, viral drop destination
- [`sources/rewards`](./sources/rewards): rewards accounting and campaign logic
- [`sources/tokenomics`](./sources/tokenomics): LEND asset, fees, staking, governance
- [`sources/shared`](./sources/shared): common errors and asset helpers

Core modules:

- [`bootstrap.move`](./sources/bootstrap/bootstrap.move): initializes protocol state and native assets
- [`loan_book.move`](./sources/credit/loan_book.move): request, approve, repay, default, and collateral handling
- [`treasury.move`](./sources/credit/treasury.move): custody and disbursement of native assets
- [`profiles.move`](./sources/credit/profiles.move): product profiles and collateral requirements
- [`merchant_registry.move`](./sources/credit/merchant_registry.move): ecosystem app registry rail
- [`bridge.move`](./sources/credit/bridge.move): bridge route registry, liquidity venue metadata, and user bridge-intent audit trail
- [`reputation.move`](./sources/credit/reputation.move): borrower identity and repayment reputation
- [`viral_drop.move`](./sources/credit/viral_drop.move): internal live app destination that receives funded balance and mints receipts
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
- `bridge`
  Cross-VM helper registry:
  `register_route`, `update_route_status`, `update_route_liquidity`, `open_bridge_intent`, `cancel_bridge_intent`, `resolve_bridge_intent`.
- `reputation`
  Identity and borrower reputation:
  `attest_username`, `get_entry`, `has_verified_username`, `platform_actions_of`.
- `viral_drop`
  Internal funded-use path:
  `buy_item`, `get_item`, `get_purchase`, `payout_vault_address`, `payout_balance`.
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

1. borrower requests a profiled loan for an Initia app purchase
2. operator approves the request
3. treasury disburses the loan asset
4. borrower repays installments
5. rewards and reputation are updated
6. collateral unlocks on full repayment or is seized on default

The contract also supports:

- ecosystem-aware requests
- unsecured profiles for small and standard app credit
- a separate collateralized profile for advanced secured credit
- bridge-route metadata and user bridge intents for real sell/exit paths once mapping is live
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
- app-linked request behavior
- funded viral drop purchase behavior
- collateralized request behavior

## Current Testnet Rollup

The active local testnet runtime after the native-asset migration is:

- chain id: `lendpay-4`
- RPC: `http://127.0.0.1:26657`
- REST: `http://127.0.0.1:1317`
- package owner / admin key: `BridgeExecutor`
- package address: `0x5972A1C7118A8977852DC3307621535D5C1CDA63`
- native `LEND` asset metadata: `0xad42527a722cbb97f7689ea4207f130859f0f93f1dce39b3675fa97ccd1ed551`
- internal base denom on the rollup: `ulend`

Latest successful transactions:

- deploy: `6CD7DD459C4CE732E6F4E0C7DA6193E5156024B95A3259212E337311D5D46035`
- bootstrap: `FEC142843CECAE4011E4ECAEB32A5019A9E66E099EAC875BD82DBF953D3AFF1D`
- fund liquidity: `66B5BD6A6C084973DBEDAD5B0D72478777E312639066D187C8CEC2E1637F1F41`
- mint protocol LEND reserve: `136738739C255EA38072520101DC9E3BB14696A0F451271B8AD54B918FECD7AE`
- register `viral_drop` route (`merchant_id = 1`): `D8B83D0730FBB8DE518AC5E93EA72FEBD540560680F181582086E29717E5B1ED`
- register `mock_cabal` route (`merchant_id = 2`): `D33F15997D8E1D604C059E9445800DFD66AFE4331CD605A734A2557AF9900D0D`
- register `mock_yominet` route (`merchant_id = 3`): `23E92FB5ACEA3353D7CB211496C02E5C1C03B8772021635A3A9C1CA3419329F9`
- register `mock_intergaze` route (`merchant_id = 4`): `9EB9F34C2C81E10C81E7AA5C5AAFFD1D33CF3B01EBE8CBB15C09E351DE652B6C`
- package upgrade including `bridge.move`: `A36F31E75969F9D285EEA503F6046D065AA3A0B56561B5E04F2EB9DAB8D251FA`
- `bridge::initialize`: `8C7F9944ABB35AA2F5BFF2C7F596D1A6F21D7CE7B7C8D5F3BDD7F4C82561AE30`
- `bridge::register_route`: `A2D0DF04150D326D951A0EE13AA4600EBD22D6F03C62F6440DB5913B05A54C53`

Current published bridge route on `lendpay-4`:

- source: `lendpay-4 / ulend`
- destination: `evm-1 / erc20/LEND`
- liquidity venue: `InitiaDEX`
- pool reference: `LEND/INIT`
- liquidity status: `coming_soon`
- swap enabled: `false`

This route is now provable onchain, but the final user sell path still remains preview until the official MiniEVM mapping is live.

## Testnet App Route Proofs

The Ecosystem cards shown in the app are backed by real modules and registry routes on
`lendpay-4`, not frontend-only placeholders.

Registered live routes:

- `merchant_id = 1` → `viral_drop` payout vault `0xc07d30ee174fbcb89a762825c28096658cff605fb91f192be7419b3d531fb01f`
- `merchant_id = 2` → `mock_cabal` payout vault `0x6ed66c3a1abca0af34c9b2cee26bf3727041a6adf3ec58981df92c2b70650744`
- `merchant_id = 3` → `mock_yominet` payout vault `0x2756948e243875c21d6581d56b9de61f2944af7f92b9e020b5a8f537204cc661`
- `merchant_id = 4` → `mock_intergaze` payout vault `0xdb94cf24410d6156d9f7658f6bf02a6510a5ab051d2428e13b22639100ea5cf2`
- `merchant_id = 5` → additional `viral_drop` route created by the end-to-end flow verification

Verified testnet transactions:

- `mock_cabal::deposit` to merchant route `2`: `F42757619297C6BE5CC925A036CD35795FF773835CCD0455A50D32692A8ECFDA`
  Result: position `#1` opened for `200 LEND`, payout vault balance `200`.
- `mock_yominet::buy_item` on merchant route `3`: `5ACD1D0C7B2521B68ADDA2993FBE250CD92D115728D59102A69C7DCB3A65B722`
  Result: purchase `#1`, amount paid `220 LEND`, receipt NFT stored in [`app-route-proof/mock-yominet-purchase.json`](./artifacts/testnet/lendpay-4/app-route-proof/mock-yominet-purchase.json).
- `mock_intergaze::buy_item` on merchant route `4`: `4C8DA789BAB6E6B2AED92DAE4A3BDADA79990D3521BEC2E1E018EAAECE016D3E`
  Result: purchase `#1`, amount paid `180 LEND`, receipt NFT stored in [`app-route-proof/mock-intergaze-purchase.json`](./artifacts/testnet/lendpay-4/app-route-proof/mock-intergaze-purchase.json).
- `viral_drop::buy_item` on merchant route `1`: `578AB95B519EE25A7E60D52E0A876C5DB81D4B658871BD066938F4E4863A4286`
  Result: purchase `#1`, amount paid `300 LEND`, receipt NFT stored in [`app-route-proof/viral-drop-purchase.json`](./artifacts/testnet/lendpay-4/app-route-proof/viral-drop-purchase.json).

Supporting artifacts are stored under:

```bash
artifacts/testnet/lendpay-4/
```

The most relevant files are:

- [`artifacts/testnet/lendpay-4/deploy.json`](./artifacts/testnet/lendpay-4/deploy.json)
- [`artifacts/testnet/lendpay-4/bootstrap.json`](./artifacts/testnet/lendpay-4/bootstrap.json)
- [`artifacts/testnet/lendpay-4/fund-liquidity.json`](./artifacts/testnet/lendpay-4/fund-liquidity.json)
- [`artifacts/testnet/lendpay-4/mint-lend-reserve.json`](./artifacts/testnet/lendpay-4/mint-lend-reserve.json)
- [`artifacts/testnet/lendpay-4/register-viral-drops.json`](./artifacts/testnet/lendpay-4/register-viral-drops.json)
- [`artifacts/testnet/lendpay-4/register-mock-cabal.json`](./artifacts/testnet/lendpay-4/register-mock-cabal.json)
- [`artifacts/testnet/lendpay-4/register-mock-yominet.json`](./artifacts/testnet/lendpay-4/register-mock-yominet.json)
- [`artifacts/testnet/lendpay-4/register-mock-intergaze.json`](./artifacts/testnet/lendpay-4/register-mock-intergaze.json)
- [`artifacts/testnet/lendpay-4/app-route-proof/summary.json`](./artifacts/testnet/lendpay-4/app-route-proof/summary.json)
- [`artifacts/testnet/lendpay-4/core-flow-verification/summary.json`](./artifacts/testnet/lendpay-4/core-flow-verification/summary.json)

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
- app-linked credit paths
- viral drop usage paths
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
./scripts/rollup/viral-drop-flow.sh
```

The demo uses the existing local `Validator` key as borrower by default, then executes:

1. fund borrower with native `LEND`
1. fund borrower with native `LEND`
2. attest `.init`-style username bytes onchain
3. request a profiled micro-loan
4. approve the loan as operator
5. repay all installments
6. claim earned `LEND`
7. pay outstanding origination fees in `LEND`
8. stake the remaining `LEND`
9. claim staking rewards

The flow artifacts are useful as deploy evidence and local validation records.

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
- App semantics are enforced at the application layer by pairing request metadata with registry state and borrower UX, while loan execution remains protocol-native onchain.
