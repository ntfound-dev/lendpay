# Business Model

LendPay is not just a loan app. It is a credit infrastructure layer for Initia apps.

That distinction matters because the long-term value is not only in lending to a single borrower. The bigger opportunity is to become the reusable credit rail that partner apps can plug into when they want checkout financing, better conversion, and stronger repeat usage.

This page explains the full commercial frame in one place:

- the problem LendPay solves
- the product solution
- the business model
- the tokenomic structure
- the real ecosystem impact
- the post-launch marketing strategy

It also includes a simple revenue calculator so the team can pressure-test assumptions quickly.

For precise wording of terms like `growth`, `distribution`, `liquidity`, and `utility`, see [Terminology](/guide/terminology).

## Problem

Initia users can already bridge, trade, and interact with apps, but they still lack a clean credit rail for real usage.

Today the main gap is not access to assets. The main gap is access to responsible pay-later purchasing power inside actual ecosystem experiences.

In practice:

- users can hold assets but still cannot easily access responsible pay-later credit
- apps can acquire users, but they do not have a native checkout credit layer
- generic cash-like lending creates higher misuse risk and weaker repayment intent

This creates two product problems:

- borrowers need lightweight, reputation-aware credit
- apps need embedded financing that increases conversion without becoming a bank themselves

That is why LendPay should not be framed as “just another lender.” The real job is to connect onchain identity and repayment quality to app-native credit usage.

## Solution

LendPay turns wallet reputation, identity, and repayment behavior into app-native credit.

The intended product path is:

1. connect wallet
2. resolve identity and borrower context
3. analyze borrower quality
4. issue a small credit line or checkout approval
5. route funds into an Initia app or merchant flow
6. reward clean repayment with stronger access over time

Product principle:

- credit should grow from repayment proof, not from token speculation alone

This is why merchant-linked credit matters so much. When credit is tied to real checkout intent, the product becomes more useful to apps and less exposed to the worst behavior of generic cash-loan usage.

## Business Model

LendPay earns protocol revenue from three main sources:

| Revenue source | What it means |
| --- | --- |
| Origination fee | fee charged on each approved loan |
| Interest spread | APR charged to borrower based on risk and product |
| Partner fee | fee from integrated apps or merchants using the credit rail |

Supporting revenue sources:

- late payment fees
- treasury and liquidity operations once the protocol is mature

Current planning direction:

- average loan size around `$300`
- origination fee around `1.5%`
- APR reference around `9.35%`
- partner fee modeled as a smaller percentage of settled loan volume

The important commercial point is that LendPay is selling a service, not just a token story.

That service is:

- underwriting access
- checkout conversion
- repayment-linked borrower retention

## Revenue Calculator

Use this calculator to sanity-check the monthly model.

<RevenueCalculator />

Calculator interpretation:

- `Gross revenue` = origination + interest + partner fee
- `Expected credit loss` = loan volume x default rate x loss-given-default
- `Net before opex` = gross revenue minus expected credit loss
- `Net after opex` = net before opex minus operating cost

Management rule:

- if default rate is above `5%`, prioritize insurance reserve over burn

This is not just a spreadsheet detail. It is a discipline rule. If the model only looks good before default loss is accounted for, the model is not good enough yet.

## Tokenomics

The economic model uses three clearly separated layers.

For the dedicated `LEND` economic design, see [LEND Tokenomics](/guide/lend-tokenomics).

### `POINTS`

`POINTS` are loyalty and reputation.

- earned from borrow, repay on time, and referral
- spent on limit boost, APR discount, premium checks, and badges
- not tradable and intentionally not priced

Point design rule:

- points should feel useful immediately
- points should improve borrower economics
- points should not become a speculative instrument

### Point Utility Detail

Suggested point actions:

| Action | Purpose |
| --- | --- |
| Limit boost | reward proven borrowers with better access |
| APR discount | reduce borrowing cost for disciplined users |
| Premium check | unlock deeper underwriting pass |
| Badge / social proof | visible borrower reputation surface |
| Convert to claimable `LEND` | bridge loyalty into utility asset |

`POINTS` should feel like an operating system for borrower behavior. They should encourage discipline, improve UX, and create visible progress, but they should never become the thing users speculate on instead of the credit product itself.

### `LEND`

`LEND` is the utility asset.

- used for collateral, tier, staking, and future liquidity
- can be earned through point conversion or acquired in market contexts
- fee flow can later support burn and staking rewards

The role of `LEND` is to support product utility and treasury mechanics, not to replace underwriting.

### `CREDIT LINE`

The credit line is not a token.

- it is the underwriting output of the system
- it should be shaped mainly by repayment behavior and borrower quality
- it is the core product being distributed to borrowers and partner apps

That distinction is important because many products blur the line between token incentives and actual credit quality. LendPay should not.

## Discount Voucher

Voucher logic is the user-facing bridge between retention and merchant conversion.

Recommended framing:

- vouchers are ecosystem discount rights
- vouchers should reward healthy holding and healthy repayment behavior
- vouchers should make partner apps more attractive to use through LendPay

Practical role:

- Bronze and Silver tiers unlock starter discounts for lower-ticket partner checkouts
- higher tiers unlock stronger discounts for premium partner routes
- vouchers should increase app conversion, not just decorate the dashboard

Product rule:

- discounts should be meaningful enough to change user behavior
- voucher unlocks should remain easy to explain in one sentence

The best version of this system is simple:

- the borrower understands the perk quickly
- the partner sees better conversion
- the protocol sees stronger repeat behavior

## Burn Policy

Burn exists to reinforce long-term `LEND` utility, but it should not come before protocol safety.

Operational rule:

- when default rate is unstable, redirect the planned burn allocation into insurance reserve
- when default rate is stable and reserve is credible, restore burn as part of the fee loop

This creates two treasury modes:

| Mode | Trigger | Allocation emphasis |
| --- | --- | --- |
| Reserve-first mode | default rate above target or reserve still thin | treasury + reserve + staking |
| Burn-enabled mode | default rate controlled and reserve healthy | treasury + staking + burn |

Why this matters:

- early-stage solvency is more valuable than short-term token optics
- a live protocol with delayed burn is better than an under-reserved protocol with aggressive burn

The rule here is simple: treasury credibility comes before token theatrics.

## Token Utility Summary

| Layer | Main purpose | Should not be confused with |
| --- | --- | --- |
| `POINTS` | loyalty, perks, discount actions | market-priced token |
| `LEND` | utility, collateral, staking, tier | direct credit line |
| Credit line | borrowing power | tradable asset |

## Real Ecosystem Impact

LendPay should create visible value for the broader Initia ecosystem, not just for its own dashboard.

Expected ecosystem impact:

- higher checkout conversion for partner apps
- larger average order size through pay-later support
- stronger repeat usage because borrowers return to preserve reputation
- more onchain identity value because repayment behavior becomes meaningful
- a reusable credit rail that other apps can plug into instead of rebuilding lending logic themselves

The most important ecosystem effects are:

| Stakeholder | Expected value |
| --- | --- |
| Borrower | access to responsible credit and lower costs over time |
| Merchant / app | better conversion and stronger user retention |
| Initia ecosystem | more onchain commerce and more credible identity-linked activity |
| `LEND` holder | clearer utility through tier, staking, and fee-linked demand |

This is the core thesis: if LendPay works, it should make Initia feel more like a live commerce ecosystem and less like a place where users only swap, bridge, and leave.

## Post-Launch Marketing Strategy

After hackathon, marketing should focus on proving trust, acquiring the right users, and showing real app demand.

Important distinction:

- `distribution` for LendPay means partner apps, merchant rails, and embedded checkout entry points
- `marketing` means the channels used to attract, activate, and retain users around that product

### `X`

Use `X` for narrative and proof.

- publish borrower flow clips
- show repayment streak and app checkout demos
- explain why LendPay is credit infrastructure, not just another lender
- post partner integrations as proof of ecosystem pull

Best use:

- credibility, storytelling, and ecosystem positioning

### `Galxe`

Use `Galxe` for structured growth campaigns.

- wallet connect quests
- first profile refresh quests
- first repayment milestone campaigns
- partner-specific quests tied to real product actions

Best use:

- acquisition and activation, not empty farming

### `Zill`

Use `Zill` as a lightweight community task and retention layer.

- social tasks
- referral loops
- merchant campaign participation
- repeat borrower community missions

Best use:

- keep community momentum alive between product milestones

### Marketing Channel Roles

Each channel should have a different job:

| Channel | Job |
| --- | --- |
| `X` | tell the story and prove product credibility |
| `Galxe` | convert attention into measurable onchain actions |
| `Zill` | maintain community participation and referral energy |

The rule is simple:

- do not pay for noise
- reward actions that improve borrower quality, app usage, or repayment proof

### What Distribution Actually Means

For LendPay, real distribution is not `X`, `Galxe`, or `Zill`.

Real distribution means:

- being embedded in partner app flows
- appearing inside merchant or checkout journeys
- becoming the credit layer that apps route users into

So the model is:

- `marketing` creates awareness and activation
- `distribution` comes from app integrations and embedded usage surfaces

This distinction is important because a lot of web3 teams confuse audience attention with product distribution. LendPay should not make that mistake.

## Risk And Growth Link

The business model only works if default rate stays under control.

That is why the matching strategy is:

- start with segmented risk policy
- let line growth follow repayment proof
- move merchant-tied credit earlier in the roadmap
- build reserve before aggressive burn if defaults are still unstable

For the full policy, see [Risk And Growth](/guide/risk-growth).
