# LEND Tokenomics

`LEND` is the native utility token of the LendPay Move rollup.

Three distinct layers — keep them separate:
- `LEND` — the utility asset
- `POINTS` — loyalty and behavior rewards
- Credit line — the underwriting output

For the commercial frame, see [Business Model](/guide/business-model). For risk policy, see [Risk And Growth](/guide/risk-growth).

## Why `LEND` Exists

`LEND` gives the protocol an economic layer that is useful to borrowers, holders, and treasury design.

What `LEND` supports:
- collateral for larger or more advanced credit routes
- tier-based pricing benefits (fee and APR discounts, limit multipliers)
- fee payment with extra discount
- staking and governance participation
- long-term liquidity and treasury coordination

`LEND` is the utility asset around the credit system, not the borrowed principal itself.

## Onchain Reality

The current Move package already includes a live `LEND` token layer.

| Detail | Value |
| --- | --- |
| Token name | LendPay Token |
| Symbol | LEND |
| Decimals | 6 |
| Protocol reserve vault | live |
| Staking vault | live |
| Mint / burn control | onchain |

Source files:
- `smarcontract/sources/tokenomics/lend_token.move`
- `smarcontract/sources/tokenomics/tokenomics.move`
- `smarcontract/sources/tokenomics/fee_engine.move`
- `smarcontract/sources/tokenomics/staking.move`
- `smarcontract/sources/tokenomics/governance.move`
- `smarcontract/sources/credit/config.move`

Token utility is live in the Move package. Long-term treasury and market design is policy direction, not fully enforced issuance logic.

## Utility Map

| Surface | What it does | Status |
| --- | --- | --- |
| Collateral | lock LEND for collateralized credit paths | live |
| Tier benefits | held LEND unlocks fee and APR discounts, cap multipliers | live |
| Fee payment | pay eligible fees in LEND for an extra discount | live |
| Reward distribution | protocol reserve distributes LEND to users | live |
| Staking | stake LEND for reward participation | live |
| Governance | LEND holders vote on proposals | live |
| Market liquidity | treasury and external liquidity routes | partial / planned |
| MiniEVM route | `LEND → MiniEVM` after official denom mapping | planned |

## Tier Thresholds

| Tier | Min LEND held | Fee discount | APR discount | Limit multiplier |
| --- | --- | --- | --- | --- |
| Bronze | 100 | 5% | 5% | 1.0× |
| Silver | 500 | 10% | 10% | 1.0× |
| Gold | 2,000 | 15% | 20% | 1.5× |
| Diamond | 10,000 | 25% | 35% | 2.0× |

Paying eligible fees in LEND adds a further 5% fee discount.

## `POINTS` to `LEND` Conversion

### Fixed on-chain rate
The `redeem_points_to_claimable_lend` contract function converts points at a fixed rate set by `config::lend_per_point_bps()`. The current default: **1,000 pts = 10 LEND**.

### Season-based airdrop estimate
The Loyalty Hub also shows a dynamic season allocation estimate:

```
user_lend_estimate = (user_points / total_platform_points) × season_allocation
```

This is updated live from `GET /api/v1/season` which returns total platform points, season allocation, and the resulting rate. The season allocation and end date are configured by the operator (`SEASON_LEND_ALLOCATION`, `SEASON_END_AT` env vars).

The two mechanisms are separate: the on-chain fixed-rate conversion can be used at any time; the season airdrop is distributed at season end based on pro-rata share.

## Fee Loop And Burn

### Standard fee split

| Destination | Share |
| --- | --- |
| Treasury | 40% |
| Staking | 30% |
| Burn | 30% |

### Late fee split

- 50% burned first
- 25% treasury, 25% staking from the remainder

### Full repayment burn reference

On full repayment, burn target = 0.5% of loan value (`loan_amount / 200`).

### Risk overlay

If default rate is unstable, planned burn redirects into insurance reserve first. Burn resumes when default rate is controlled and reserve is healthy.

## Reward, Staking, And Governance

**Reward:** Users earn claimable LEND for borrowing, on-time repayment, full repayment, and campaign participation.

**Staking:** Loyal holders stake LEND to earn protocol fee rewards and maintain exposure to protocol upside.

**Governance:** Proposal threshold: 500 LEND. Governance exists in the design without dominating the early borrower story.

## Reference Allocation

| Bucket | Share |
| --- | --- |
| Community and airdrop | 30% |
| Treasury | 20% |
| Team | 15% |
| Investor | 15% |
| Burn reserve | 10% |
| Ecosystem and partnership | 10% |

This is the economic blueprint, not a live fully-enforced issuance schedule.

## Airdrop Phases

| Phase | Direction |
| --- | --- |
| Pre-launch | waitlist, testnet, referral rewards |
| Launch | first-loan and loyalty rewards |
| Ongoing | top borrowers and liquidity contributors |

## The Flywheel

1. Users borrow and repay → earn POINTS and claimable LEND
2. Users hold or stake LEND → better pricing and protocol alignment
3. More borrowing → more fee flow
4. Fee flow → treasury, staking rewards, eventual burn
5. Retention and app utility → more borrowers and partners

`LEND` deepens product retention. It should not become a distraction from repayment quality.

## Two Layers To Read

**Onchain truth** — what the package already enforces:
- `lend_token.move`, `tokenomics.move`, `fee_engine.move`, `config.move`

**Management policy** — business intent and rollout discipline:
- [Business Model](/guide/business-model), [Risk And Growth](/guide/risk-growth), [Roadmap](/guide/roadmap)
