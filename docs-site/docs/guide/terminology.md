# Terminology

Fixed definitions for terms that drift in product, finance, and go-to-market discussions. Use these when framing strategy, writing copy, or reviewing roadmap decisions.

---

## Growth

`Growth` = controlled expansion of the borrower base, partner network, and loan volume.

Growth does **not** mean chasing wallet count without repayment quality or opening large limits before default rate is stable.

LendPay treats growth as earned expansion: it begins after risk quality is credible and default-rate gates are passed. The order matters — prove repayment quality first, then scale. Any growth that runs ahead of risk controls creates liabilities that undermine the product's long-term credibility.

Related: [Risk And Growth](/guide/risk-growth)

---

## Marketing

`Marketing` = the channels and campaigns used to attract, activate, and retain users.

Examples: `X`, `Galxe`, `Zill`, partner co-marketing, community campaigns.

Marketing creates awareness and movement around the product. It helps people discover LendPay, understand the value proposition, and take useful first actions like connecting a wallet or making a first loan request.

Marketing is **not** the same as product adoption inside real app flows. A user who completes a Galxe quest has not proven repayment behavior. A user who requests and repays a loan has. Both matter, but they are not equivalent.

---

## Distribution

`Distribution` = where LendPay is embedded and how users encounter it in actual usage flows.

Examples: merchant checkout surfaces, partner app rails, embedded credit entry points inside Initia apps.

**Not** distribution: social media posts, quest platforms, generic community activity.

Real distribution begins when:
- partner apps embed the credit surface into their checkout or purchase flow
- merchant journeys route users into LendPay credit at the moment of spending intent
- the product becomes part of actual app usage, not only content and campaigns

The distinction matters because distribution produces real repayment data. Marketing produces awareness. Both are necessary, but distribution is what makes the credit product defensible over time.

---

## Liquidity

`Liquidity` = treasury and market access around `LEND` and supported assets.

Examples: treasury reserve management, MiniEVM route readiness, DEX pool participation, bridge route execution for `LEND` exit paths.

Liquidity is about asset movement and market access — whether `LEND` can be acquired, moved, and sold through real routes. It is **not** the same as borrower demand, partner distribution, or user growth.

Why it matters: if `LEND` utility is real but exit liquidity is unclear, holders face unnecessary friction. The protocol needs honest liquidity positioning — do not describe planned DEX pools as already live, and do not conflate "route metadata published onchain" with "route executable today."

Current status: bridge route metadata is published onchain locally. The actual sell route stays in preview until the official MiniEVM denom-to-ERC20 mapping is live.

---

## Utility

`Utility` = practical reasons users or partners would hold, spend, lock, or prefer `LEND`.

Current live utility in the Move package:

| Use case | What it does |
| --- | --- |
| Collateral | lock `LEND` for collateralized credit routes (larger limits) |
| Tier unlock | held `LEND` unlocks fee discounts, APR discounts, and limit multipliers |
| Fee payment | pay eligible protocol fees in `LEND` for an extra discount |
| Staking | stake `LEND` to earn protocol fee rewards |
| Governance | `LEND` holders vote on protocol proposals |
| Claimable rewards | protocol distributes `LEND` from reserve for repayment behavior |

The test: if a user asks "why would I keep this token in the product?", the answer must be clear without relying on price appreciation alone. Utility means the token does something useful inside the protocol — it reduces cost, unlocks access, or earns yield from real fee activity.

`POINTS` and `LEND` serve different roles:
- `POINTS` are earned through activity, spent on perks, and not tradable
- `LEND` is the utility asset — held, staked, used as collateral, or earned through repayment rewards

Neither replaces the credit line. The credit line is the underwriting output.

Related: [LEND Tokenomics](/guide/lend-tokenomics)

---

## Credit Line

`Credit line` = the borrowing power granted by underwriting.

It is a product output shaped by borrower quality and repayment behavior — not a token, not a reward, and not a tradable asset.

`POINTS` are not the credit line.
`LEND` is not the credit line.
The credit line is the access to borrow, sized by the underwriting engine based on wallet reputation, identity signals, repayment history, and product profile rules.

Key distinctions:
- holding more `LEND` can **improve pricing** (APR discount, fee discount) and unlock **higher caps** through tier benefits — but it does not replace repayment proof as the primary underwriting input
- `POINTS` can be spent to boost a limit or reduce APR — but points spending is a perk, not a substitute for demonstrated repayment quality
- the strongest path to a higher credit line is a clean internal repayment record inside LendPay

When discussing increasing or protecting the credit line, the conversation should be about borrower quality, repayment proof, risk controls, and product economics — not token price or point accumulation.

Related: [Risk And Growth](/guide/risk-growth), [Business Model](/guide/business-model)
