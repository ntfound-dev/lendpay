# Risk And Growth Strategy

LendPay should treat default control as the primary growth gate.

This is one of the most important management decisions in the project.

It means LendPay should not behave like a product that tries to maximize loan volume first and clean up risk later. It should do the opposite: prove repayment quality first, then earn the right to scale.

This document captures the management direction behind that choice:

- do not chase volume before repayment quality is stable
- do not let users "buy" large limits with token holdings alone
- do not market bridge features before the route is truly live

For shared definitions of `growth`, `distribution`, `liquidity`, and `utility`, see [Terminology](/guide/terminology).

## Core Rule

LendPay should not scale aggressively until default rate is consistently below `5%`.

Why this matters:

- revenue projections become meaningless if losses scale faster than fees
- early borrower quality matters more than vanity growth
- the protocol needs repeat repayment proof before it deserves larger balance-sheet risk

This rule is not only about finance. It is also about product discipline.

If default quality is weak, then:

- larger limits become dangerous
- burn optics become premature
- marketing spend becomes lower quality
- merchant partners become harder to retain

So the correct order is simple:

- prove quality first
- scale second

## Layer 1: Segmented Risk Policy

The first underwriting control should be a segmented policy, not one flat model for every wallet.

Suggested borrower buckets:

| Bucket | Signal | Policy |
| --- | --- | --- |
| New wallet | wallet age under `3 months`, low transaction depth | very small limit, short tenor, collateral-first |
| Active wallet | consistent transactions, visible DeFi or app usage | moderate limit, selective unsecured access |
| Established wallet | clean repayment history inside LendPay | full policy access, wider tenor range |

Policy rule:

- new wallets should not receive large unsecured limits even if external signals look temporarily strong

This matters because external wallet signals can help with orientation, but they should not be mistaken for proven internal repayment quality.

The goal of segmentation is not to reject everyone. The goal is to size exposure correctly.

That means:

- new wallets can still enter the system
- but they should enter through small, controlled, low-damage exposure

## Layer 2: Repayment-Led Credit Growth

The most important long-term rule is simple:

> repayment history inside LendPay matters more than reputation outside LendPay

This means:

- every borrower starts with a small line
- larger limits are unlocked mainly through clean internal repayment behavior
- `POINTS` and held `LEND` can improve pricing, perks, and cap eligibility
- `POINTS` and held `LEND` should not be the primary reason a user gets a large credit line

Why this is the safer model:

- users cannot buy trust only by holding tokens
- repayment performance becomes the strongest anti-default filter
- larger exposure is reserved for proven borrowers instead of optimistic scoring alone

This is one of the healthiest boundaries in the whole product.

It protects LendPay from a bad failure mode where:

- a user accumulates token status
- receives large credit too early
- and still has no real repayment record inside the protocol

That is not the kind of growth LendPay should reward.

## Layer 3: Repayment Incentives

Repayment must feel rewarding, not just obligatory.

Recommended product behaviors:

- every on-time installment should visibly improve the borrower's dashboard reputation
- streaks should unlock gradual APR discounts
- claimable `LEND` should favor completed repayment behavior over passive holding alone

Example incentives:

- `3` on-time payments in a row: lower APR by `1%`
- `6` on-time payments in a row: lower APR by `2.5%`
- claimable `LEND` released fully after loan completion rather than encouraging extraction mid-loan

This creates a soft lock-in effect without making the protocol overly complex.

The deeper reason this matters is behavioral:

- users protect what feels valuable
- visible progress is often stronger than abstract policy
- if repayment clearly improves the borrower’s future cost and access, default becomes less attractive

So the incentive design should make good behavior visible, cumulative, and easy to understand.

## Layer 4: Merchant-Tied Credit

Merchant integration is not only a revenue feature. It is also a risk-control feature.

Why merchant-tied credit lowers default pressure:

- funds are routed to a specific merchant or app instead of becoming generic cash
- purchase intent is clearer than open-ended wallet borrowing
- misuse risk drops when funds cannot be freely redirected

Strategic implication:

- merchant-tied BNPL should move earlier in the roadmap
- it should become a primary product path, not a late-stage add-on

This is a structural risk advantage, not just a UX choice.

When funds are tied to a real checkout flow:

- the borrower has a more concrete reason to borrow
- the merchant has a stronger reason to integrate
- the protocol gets a clearer usage signal than it would from generic cash-like disbursement

That is why merchant integration should be treated as both:

- a revenue lever
- a default-mitigation lever

## Layer 5: Reserve Before Burn

Early-stage treasury policy should prioritize resilience over token optics.

Initial recommendation:

- while default rate is still unstable, redirect part of the planned burn allocation into an insurance reserve
- activate full burn mechanics only after reserves can absorb a meaningful stress period

Practical policy:

- treasury first
- insurance reserve second
- staking rewards third
- burn after risk buffer is credible

This is a healthier early-stage tradeoff than forcing aggressive burn while solvency is still fragile.

The treasury principle should be:

- first survive
- then reward
- then optimize token optics

In early-stage credit systems, survival quality is more important than appearance of scarcity.

## Recommended Execution Order

### Months 1-2

- implement segmented risk policy
- reduce exposure for new wallets
- keep starter limits intentionally small

Main outcome:

- borrower entry becomes safer without killing adoption completely

### Months 2-4

- add streak system
- delay full `LEND` reward extraction until repayment milestones are met
- make repayment progress more visible in the dashboard

Main outcome:

- good repayment behavior becomes more attractive and more visible

### Months 3-6

- onboard `2-3` merchant partners
- shift borrower flow toward merchant-tied credit instead of generic cash-like borrowing

Main outcome:

- usage starts looking more like real commerce and less like open-ended credit extraction

### Month 6 and beyond

- evaluate whether default rate is sustainably below target
- only then reopen larger limits and stronger burn mechanics

Main outcome:

- scale is earned through proof, not assumed in advance

## Management Decisions Locked By This Strategy

- default rate control is more important than short-term loan volume
- small unsecured starter credit is allowed, but large line growth must come from repayment proof
- `LEND` remains useful for collateral, tier, staking, and future liquidity
- `POINTS` remain useful for perks, discount, and loyalty
- merchant integration is both a revenue lever and a risk mitigant
- bridge expansion stays secondary until the MiniEVM route is truly live

These decisions matter because they prevent narrative drift.

Without these boundaries, it becomes too easy for the product to slide into:

- token-led optimism
- volume chasing
- premature multi-VM storytelling
- treasury decisions that look good before they are safe

## Relationship To The Broader Plan

This document complements the main project plan in `plan.md`.

It should be read as the risk and growth policy overlay for:

- underwriting
- roadmap prioritization
- treasury policy
- borrower incentive design

In simple terms:

- the roadmap says what LendPay wants to build
- this page explains the discipline that should decide when LendPay is allowed to grow
