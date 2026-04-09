# Onchain Modules

The Move package implements the onchain credit protocol for LendPay.

## Main Module Groups

- `sources/bootstrap`
- `sources/credit`
- `sources/rewards`
- `sources/tokenomics`
- `sources/shared`

## Core Modules

- `loan_book.move`
- `treasury.move`
- `profiles.move`
- `merchant_registry.move`
- `bridge.move`
- `reputation.move`
- `viral_drop.move`
- `rewards.move`
- `campaigns.move`
- `lend_token.move`
- `fee_engine.move`
- `staking.move`
- `governance.move`

## Credit Lifecycle

1. borrower requests a profiled loan
2. operator approves the request
3. treasury disburses the loan asset
4. borrower uses the funded balance
5. borrower repays installments
6. rewards and reputation update

## Supported Features

- unsecured app credit
- collateralized advanced credit
- app-aware requests
- bridge route metadata, liquidity venue metadata, and bridge intents
- claimable LEND
- staking and staking rewards
- campaign allocation and claim
- governance
- fee settlement in LEND

## Local Validation

The test suite covers:

- request and approval paths
- repayment updates
- rewards claims
- staking
- governance
- campaign claims
- app-linked credit paths
- collateralized flows
- bridge route registration, liquidity metadata updates, and bridge intent lifecycle

## Current Local Bridge Proof

The current local `lendpay-4` package also includes the published `bridge` module and one registered route:

- package upgrade including `bridge.move`: `A36F31E75969F9D285EEA503F6046D065AA3A0B56561B5E04F2EB9DAB8D251FA`
- `bridge::initialize`: `8C7F9944ABB35AA2F5BFF2C7F596D1A6F21D7CE7B7C8D5F3BDD7F4C82561AE30`
- `bridge::register_route`: `A2D0DF04150D326D951A0EE13AA4600EBD22D6F03C62F6440DB5913B05A54C53`

Published route summary:

- source: `lendpay-4 / ulend`
- destination: `evm-1 / erc20/LEND`
- venue: `InitiaDEX`
- pool: `LEND/INIT`
- liquidity status: `coming_soon`
- swap enabled: `false`
