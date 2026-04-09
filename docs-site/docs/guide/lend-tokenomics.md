# LEND Tokenomics

`LEND` is the native utility token inside the LendPay Move rollup.

This page exists to keep one thing clear: `LEND`, `POINTS`, and the borrower credit line are not the same thing.

- `LEND` is the utility asset
- `POINTS` are loyalty and behavior rewards
- the credit line is the underwriting output

For the broader commercial frame, see [Business Model](/guide/business-model). For risk policy, see [Risk And Growth](/guide/risk-growth).

## Why `LEND` Exists

`LEND` gives the protocol an economic layer that is useful to borrowers, useful to loyal holders, and useful to treasury design.

In practical terms, `LEND` is meant to support:

- collateral for larger or more advanced credit routes
- tier-based pricing benefits
- fee payment and fee discounts
- staking and governance participation
- long-term liquidity and treasury coordination

The goal is not to turn `LEND` into the borrowed principal. The goal is to make `LEND` the utility asset around the credit system.

## What `LEND` Is Not

To keep the product understandable, these boundaries should stay fixed:

- `LEND` is not the borrower credit line
- `LEND` is not the same thing as `POINTS`
- `LEND` is not the asset users are necessarily borrowing
- `LEND` should not be marketed as a shortcut to bypass underwriting

This matters because the product is still a credit product first. Token utility should support the system, not replace borrower quality.

## Onchain Reality Today

The current Move package already includes a real `LEND` token layer.

Live design details:

- native token name: `LendPay Token`
- symbol: `LEND`
- decimals: `6`
- protocol reserve vault: live
- protocol staking vault: live
- mint and burn capability: controlled by the onchain ledger

The main source files are:

- `smarcontract/sources/tokenomics/lend_token.move`
- `smarcontract/sources/tokenomics/tokenomics.move`
- `smarcontract/sources/tokenomics/fee_engine.move`
- `smarcontract/sources/tokenomics/staking.move`
- `smarcontract/sources/tokenomics/governance.move`
- `smarcontract/sources/credit/config.move`

Important honesty note:

- the token utility layer is live in the Move package
- some long-term treasury and market design is still policy direction, not fully enforced issuance logic

That means docs should separate `what the code already does` from `what the business plan intends`.

## Utility Map

| Utility surface | What it means | Status |
| --- | --- | --- |
| Collateral | `LEND` can be locked for collateralized credit paths | live |
| Tier benefits | held `LEND` unlocks fee and APR discounts, plus cap multipliers | live |
| Fee payment | users can pay eligible protocol fees in `LEND` with extra discount | live |
| Reward distribution | protocol reserve can distribute `LEND` to users | live |
| Staking | `LEND` can be staked for reward participation | live |
| Governance | `LEND` holders can participate in proposal and vote flow | live |
| Market liquidity | treasury and future external liquidity routes | partial / planned |
| MiniEVM route | `LEND -> MiniEVM` path after official mapping is available | planned |

## Current Policy Defaults

Some important `LEND` rules are already encoded in the current Move package and config defaults.

### Tier Thresholds

These are the current default holding thresholds:

| Tier | Minimum `LEND` | Default fee discount | APR discount | Limit multiplier |
| --- | --- | --- | --- | --- |
| Bronze | `100` | `5%` | `5%` | `1.0x` |
| Silver | `500` | `10%` | `10%` | `1.0x` |
| Gold | `2,000` | `15%` | `20%` | `1.5x` |
| Diamond | `10,000` | `25%` | `35%` | `2.0x` |

Extra note:

- paying eligible fees in `LEND` adds a further default `5%` fee discount

These defaults come from the current config and tokenomics modules, so they are more than presentation copy. They are part of the protocol policy surface.

### `POINTS` to `LEND` Conversion Bridge

The current default conversion rule is:

- `1,000 points = 10 LEND`

That makes `POINTS` the loyalty layer that can gradually flow into `LEND`, without turning `POINTS` themselves into a market asset.

## Fee Loop And Burn Logic

The clearest part of `LEND` tokenomics is the fee loop.

### Standard Fee Split

For standard fee flow, the current onchain split is:

- `40%` treasury
- `30%` staking
- `30%` burn

### Late Fee Split

For late fees, the current onchain split is effectively:

- `25%` treasury
- `25%` staking
- `50%` burn

This is because the protocol burns half of the late fee first, then splits the remainder equally between treasury and staking.

### Full Repayment Burn

The Move package also includes a repayment-linked burn reference:

- on full repayment, burn target = `0.5%` of loan value

That is implemented as `loan_amount / 200`.

### Risk Overlay

The management policy adds one important override on top of those mechanics:

- if default rate is still unstable, planned burn should be redirected into insurance reserve first

So the protocol should read burn in two layers:

- the Move package shows the intended token logic
- the business policy decides when burn should be emphasized versus delayed for solvency

## Reward, Staking, And Governance Role

`LEND` also matters beyond fee flow.

### Reward Role

`LEND` is the token users can claim after productive behavior such as:

- borrowing
- repaying on time
- completing full repayment
- participating in campaigns and loyalty programs

This keeps the token tied to product usage rather than pure speculation.

### Staking Role

Staking gives `LEND` a retention function.

The intended result is simple:

- loyal holders can keep exposure to protocol upside
- fee flow can support staking rewards
- the token becomes more than a one-time reward claim

### Governance Role

Governance gives advanced holders a protocol voice.

Current default reference:

- proposal threshold: `500 LEND`

That keeps governance in the design without making it the center of the early borrower story.

## Reference Allocation Direction

The project plan keeps a reference allocation model for `LEND`.

This is best read as the economic blueprint, not as a claim that the full issuance schedule is already hard-coded and live.

| Allocation bucket | Share |
| --- | --- |
| Community and airdrop | `30%` |
| Treasury | `20%` |
| Team | `15%` |
| Burn reserve | `10%` |
| Investor | `15%` |
| Ecosystem and partnership | `10%` |

Why this matters:

- community allocation supports acquisition and loyalty
- treasury allocation supports solvency and operating resilience
- ecosystem allocation supports partner distribution
- burn reserve keeps long-term supply design visible

## Airdrop Direction

The plan also keeps a phased airdrop structure for `LEND`.

| Phase | Intended direction |
| --- | --- |
| Pre-launch | waitlist, testnet, referral rewards |
| Launch | first-loan and loyalty rewards |
| Ongoing | top borrowers and liquidity contributors |

This makes the token easier to explain:

- early users are rewarded for helping bootstrap the network
- active borrowers are rewarded for real product usage
- deeper ecosystem participants are rewarded for long-term contribution

## The Intended Flywheel

The token only makes sense if it supports a healthy product loop.

The intended flywheel is:

1. users enter the app and complete borrower actions
2. users earn `POINTS` and some claimable `LEND`
3. users hold or stake `LEND` for better pricing and stronger alignment
4. more borrowing and repayment activity creates more fee flow
5. fee flow supports treasury, staking rewards, and eventual burn
6. stronger retention and app utility attract more borrowers and partners

This is the key design principle:

- `LEND` should deepen product retention
- it should not become a distraction from repayment quality

## Practical Reading For The Team

If we want to stay honest and consistent, the team should read `LEND` tokenomics in two layers.

### Layer 1: Onchain truth

Read these for what the package already supports:

- `smarcontract/sources/tokenomics/lend_token.move`
- `smarcontract/sources/tokenomics/tokenomics.move`
- `smarcontract/sources/tokenomics/fee_engine.move`
- `smarcontract/sources/credit/config.move`

### Layer 2: Management policy

Read these for business intent and rollout discipline:

- [Business Model](/guide/business-model)
- [Risk And Growth](/guide/risk-growth)
- [Roadmap](/guide/roadmap)

That separation keeps us from over-claiming what is already live while still documenting the intended economic design clearly.
