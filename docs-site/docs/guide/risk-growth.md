# Risk And Growth Strategy

Default control is the primary growth gate. LendPay should prove repayment quality first, then earn the right to scale — not the reverse.

For shared term definitions see [Terminology](/guide/terminology).

## Core Rule

**Do not scale aggressively until default rate is consistently below `5%`.**

If losses scale faster than fees, revenue projections become meaningless. Early borrower quality matters more than vanity growth. The protocol needs repeat repayment proof before it deserves larger balance-sheet risk.

Weak default quality also means: larger limits become dangerous, burn optics become premature, marketing spend becomes lower quality, merchant partners become harder to retain.

Order: prove quality first, scale second.

---

## Layer 1: Segmented Risk Policy

One flat model for every wallet is not enough. Use a segmented policy.

| Bucket | Signal | Policy |
| --- | --- | --- |
| New wallet | Age under 3 months, low transaction depth | Very small limit, short tenor, collateral-first |
| Active wallet | Consistent transactions, visible DeFi or app usage | Moderate limit, selective unsecured access |
| Established wallet | Clean repayment history inside LendPay | Full policy access, wider tenor range |

New wallets can still enter. External wallet signals help with orientation but should not be mistaken for proven internal repayment quality. Size exposure correctly — do not reject everyone, but do not hand large limits to unproven accounts.

---

## Layer 2: Repayment-Led Credit Growth

> Repayment history inside LendPay matters more than reputation outside LendPay.

- Every borrower starts with a small line
- Larger limits unlock through clean internal repayment behavior
- `POINTS` and held `LEND` can improve pricing and perks
- `POINTS` and held `LEND` should **not** be the primary reason a user gets a large credit line

Users cannot buy trust by holding tokens. Repayment performance is the strongest anti-default filter. This prevents the failure mode where a user accumulates token status, receives large credit too early, and still has no real repayment record inside the protocol.

---

## Layer 3: Repayment Incentives

Repayment must feel rewarding, not just obligatory.

| Milestone | Incentive |
| --- | --- |
| 3 on-time payments in a row | APR reduced by `1%` |
| 6 on-time payments in a row | APR reduced by `2.5%` |
| Full loan completion | Claimable `LEND` released |

Visible progress is often stronger than abstract policy. If repayment clearly improves future cost and access, default becomes less attractive.

---

## Layer 4: Merchant-Tied Credit

Merchant integration is a risk-control tool, not just a revenue feature.

Why merchant-tied credit lowers default pressure:
- Funds route to a specific app instead of becoming generic cash
- Purchase intent is clearer than open-ended wallet borrowing
- Misuse risk drops when funds cannot be freely redirected

**Implication:** Merchant-tied BNPL should be a primary product path, not a late-stage add-on. It is both a revenue lever and a default-mitigation lever.

---

## Layer 5: Reserve Before Burn

While default rate is unstable, redirect part of the planned burn allocation into an insurance reserve.

Priority order:
1. Treasury
2. Insurance reserve
3. Staking rewards
4. Burn (only after risk buffer is credible)

Activate full burn mechanics only after reserves can absorb a meaningful stress period. First survive, then reward, then optimize token optics.

---

## Execution Timeline

| Period | Focus | Outcome |
| --- | --- | --- |
| Months 1–2 | Segmented risk policy, small starter limits | Safer borrower entry |
| Months 2–4 | Streak system, delayed `LEND` extraction until repayment milestones | Good behavior becomes visible and rewarding |
| Months 3–6 | Onboard 2–3 merchant partners | Usage looks like real commerce, not cash extraction |
| Month 6+ | Evaluate default rate; reopen larger limits and stronger burn only if below target | Scale earned through proof |

---

## Management Decisions Fixed By This Strategy

- Default rate control over short-term loan volume
- Large line growth must come from repayment proof, not token holdings
- `LEND` stays useful for collateral, tier, staking, future liquidity
- `POINTS` stay useful for perks, discount, loyalty
- Merchant integration is both revenue and risk mitigation
- Bridge expansion stays secondary until the MiniEVM route is live

These boundaries prevent narrative drift into token-led optimism, volume chasing, premature multi-VM storytelling, or treasury decisions that look good before they are safe.

## Related Docs

- [Roadmap](/guide/roadmap)
- [Business Model](/guide/business-model)
- [LEND Tokenomics](/guide/lend-tokenomics)
- [Terminology](/guide/terminology)
