# Onchain Modules

The Move package is the live onchain credit protocol for LendPay on `lendpay-4`.

## Source Layout

| Folder | Contents |
| --- | --- |
| `sources/bootstrap` | One-time initialization logic |
| `sources/credit` | Loan, treasury, profiles, merchant registry, bridge, reputation |
| `sources/rewards` | Points, claimable LEND, campaigns, referrals |
| `sources/tokenomics` | Fee engine, staking, governance, LEND token |
| `sources/shared` | Error definitions, asset helpers |

## Core Modules

| Module | Role |
| --- | --- |
| `loan_book.move` | Request, approval, repayment, default lifecycle |
| `treasury.move` | Protocol vault, disbursement, collateral custody |
| `profiles.move` | Credit product rules and qualification checks |
| `merchant_registry.move` | Partner route metadata and app-linked credit |
| `bridge.move` | Bridge route registry and bridge intent audit trail |
| `reputation.move` | Borrower identity, username attestations, repayment counters |
| `viral_drop.move` | Example live ecosystem route |
| `rewards.move` | Points, claimable LEND, perks |
| `campaigns.move` | Campaign allocation and claim |
| `lend_token.move` | Native LEND asset control |
| `fee_engine.move` | Origination and late fee settlement |
| `staking.move` | LEND staking and reward accrual |
| `governance.move` | Proposals and voting |

## Credit Lifecycle

1. Borrower requests a profiled loan
2. Operator approves the request
3. Treasury disburses the loan asset
4. Borrower uses the funded balance
5. Borrower repays installments
6. Rewards and reputation update

## Test Coverage

- Request and approval paths
- Repayment updates
- Rewards claims
- Staking
- Governance
- Campaign claims
- App-linked credit paths
- Collateralized flows
- Bridge route registration, liquidity metadata updates, and bridge intent lifecycle

## Bridge Proof

The `lendpay-4` package includes the published `bridge` module with one registered route.

| Action | Hash |
| --- | --- |
| Package upgrade (`bridge.move` included) | `A36F31E75969F9D285EEA503F6046D065AA3A0B56561B5E04F2EB9DAB8D251FA` |
| `bridge::initialize` | `8C7F9944ABB35AA2F5BFF2C7F596D1A6F21D7CE7B7C8D5F3BDD7F4C82561AE30` |
| `bridge::register_route` | `A2D0DF04150D326D951A0EE13AA4600EBD22D6F03C62F6440DB5913B05A54C53` |

Route: `lendpay-4 / ulend` → `evm-1 / erc20/LEND`, venue `InitiaDEX`, pool `LEND/INIT`, `liquidity_status: coming_soon`, `swap_enabled: false`.
