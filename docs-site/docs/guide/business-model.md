# Business Model

LendPay is a credit infrastructure layer for Initia apps, not just a loan screen.

The long-term value is not only in lending to individual borrowers. The bigger opportunity is becoming the reusable credit rail that partner apps plug into for checkout financing, better conversion, and stronger repeat usage.

For precise wording of terms like `growth`, `distribution`, `liquidity`, and `utility`, see [Terminology](/guide/terminology).

## Problem

Initia users can already bridge, trade, and interact with apps — but they lack a clean credit rail for real usage.

The gap is not asset access. The gap is responsible pay-later purchasing power inside actual ecosystem experiences:
- users can hold assets but cannot easily access reputation-aware pay-later credit
- apps can acquire users but have no native checkout credit layer
- generic cash-like lending creates higher misuse risk and weaker repayment intent

LendPay's job is to connect onchain identity and repayment quality to app-native credit usage.

## Solution

LendPay turns wallet reputation, identity, and repayment behavior into app-native credit.

Product path:
1. connect wallet
2. resolve identity and borrower context
3. analyze borrower quality
4. issue a credit line or checkout approval
5. route funds into an Initia app or merchant flow
6. reward clean repayment with stronger access over time

When credit is tied to real checkout intent, the product becomes more useful to apps and less exposed to generic cash-loan misuse.

## Revenue Sources

| Source | What it means |
| --- | --- |
| Origination fee | charged on each approved loan |
| Interest spread | APR based on risk and product tier |
| Partner fee | from integrated apps using the credit rail |

Supporting sources: late payment fees, treasury operations once the protocol is mature.

Current planning:
- average loan size ~$300
- origination fee ~1.5%
- APR reference ~9.35%

## Revenue Calculator

<RevenueCalculator />

- `Gross revenue` = origination + interest + partner fee
- `Expected credit loss` = loan volume × default rate × loss-given-default
- `Net before opex` = gross revenue − credit loss
- `Net after opex` = net before opex − operating cost

**Management rule:** if default rate is above 5%, prioritize insurance reserve over burn.

## Token Layers

For the dedicated `LEND` economic design, see [LEND Tokenomics](/guide/lend-tokenomics).

### `POINTS`

- earned from borrow, repay on time, and referral
- spent on limit boost, APR discount, premium checks, badges, or converted to LEND
- not tradable, not priced

| Action | Purpose |
| --- | --- |
| Limit boost | reward proven borrowers with better access |
| APR discount | reduce borrowing cost for disciplined users |
| Premium check | unlock deeper underwriting pass |
| Badge | visible borrower reputation surface |
| Convert to LEND | bridge loyalty into utility asset |

### `LEND`

- used for collateral, tier unlocks, staking, governance, and future liquidity
- earned through point conversion or market acquisition
- fee flow supports burn and staking rewards

### Credit line

The credit line is the underwriting output — not a token, not a reward. It is shaped by repayment behavior and borrower quality. This is the core product.

## Burn Policy

| Mode | Trigger | Allocation |
| --- | --- | --- |
| Reserve-first | default rate above target or reserve thin | treasury + reserve + staking |
| Burn-enabled | default rate controlled, reserve healthy | treasury + staking + burn |

Treasury credibility comes before token optics.

## Ecosystem Impact

| Stakeholder | Expected value |
| --- | --- |
| Borrower | responsible credit, lower costs over time |
| Merchant / app | better conversion, stronger user retention |
| Initia ecosystem | more onchain commerce, credible identity-linked activity |
| LEND holder | clear utility via tier, staking, fee-linked demand |

If LendPay works, Initia feels like a live commerce ecosystem rather than a place users only swap, bridge, and leave.

## Post-Launch Marketing

| Channel | Job |
| --- | --- |
| `X` | narrative, borrower flow clips, partner proof |
| `Galxe` | structured quests tied to real product actions |
| `Zill` | community tasks, referral loops, merchant campaigns |

**Real distribution** is not social media — it is being embedded in partner app flows and merchant checkout journeys. Marketing creates awareness; distribution places LendPay where users naturally transact.

## Risk And Growth Link

The business model works only if default rate stays under control. That is why the strategy is:
- start with segmented risk policy
- let line growth follow repayment proof
- move merchant-tied credit earlier in the roadmap
- build reserve before aggressive burn while defaults are unstable

See [Risk And Growth](/guide/risk-growth).
