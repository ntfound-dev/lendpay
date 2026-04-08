# Move Package

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
