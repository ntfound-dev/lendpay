# Scoring Criteria

How the hackathon judging criteria maps to LendPay. The goal is to make it easy to see where the submission is strong and what judges can verify quickly.

## Summary

| Criteria | Weight | Core question |
| --- | --- | --- |
| Originality and Track Fit | `20%` | Is this a distinct DeFi + AI product with a clear point of view? |
| Technical Execution and Initia Integration | `30%` | Does the appchain run, does the core logic work, and are Initia integrations real? |
| Product Value and UX | `20%` | Is the product understandable and improved by the Initia experience? |
| Working Demo and Completeness | `20%` | Can judges verify the flow end to end without guessing? |
| Market Understanding | `10%` | Does the team understand the user, market, and distribution path? |

---

## 1. Originality And Track Fit (`20%`)

**What LendPay claims:** Credit infrastructure for Initia apps, not a generic lending dashboard. `DeFi` because it is an onchain credit rail on its own MiniMove rollup. `AI` because underwriting, borrower scoring, and borrower-quality interpretation are part of the product.

**The stronger originality claim:** Most onchain apps can swap, bridge, and trade. Very few offer app-native checkout credit with borrower identity, repayment proof, and ecosystem-aware routing. LendPay treats credit as reusable infrastructure for apps.

**What helps this score:**
- Clear `DeFi + AI` track fit
- Own rollup instead of a mock contract-only demo
- `.init` identity plus borrower behavior as part of the product story
- Merchant-tied credit framing instead of generic cash-loan framing
- Real bridge-route registry keeping `LEND` exit metadata onchain

**What to avoid:** Overselling bridge sell readiness or multi-VM futures as the reason the product is special today.

Related: [Introduction](/guide/introduction), [Business Model](/guide/business-model), [Roadmap](/guide/roadmap)

---

## 2. Technical Execution And Initia Integration (`30%`)

Judges check three things: does the rollup exist and run, does the core flow work onchain, are Initia-native integrations real.

**What LendPay already has:**
- Dedicated MiniMove rollup runtime
- Deployed package and transaction evidence
- Request → approval → repayment flow against Move modules
- InterwovenKit as the wallet and transaction layer
- `.init` identity integrated into the borrower model
- Temporary auto-sign session UX for supported Move actions
- Bridge helper registry published onchain, surfaced through the Ecosystem page

**Best evidence to show:**
- Chain ID `lendpay-4`, package address, transaction hashes
- `bridge::initialize` and `bridge::register_route` hashes on the same package
- End-to-end borrower flow wired through frontend → backend → rollup → Move

Related: [Hackathon Readiness](/guide/hackathon-readiness), [Architecture](/guide/architecture), [Testnet Evidence](/reference/testnet)

---

## 3. Product Value And UX (`20%`)

Judges should be able to answer: what problem does this solve, who is it for, why does Initia make the experience better.

**The borrower path:**
1. Connect wallet
2. Analyze borrower quality
3. Request app credit
4. Get funded
5. Use the balance in a live app route
6. Repay and earn stronger future access

**Why Initia improves the UX:**
- InterwovenKit makes wallet and transaction flow native
- `.init` usernames make borrower identity readable
- MiniMove rollup keeps credit logic inside the appchain instead of a loose offchain mock
- Session UX smooths repeated supported actions
- Bridge surface shows route truth from the rollup, not hand-wavy claims

**UX strength:** The app stays legible as a borrower console first, not a giant protocol control panel.

Related: [Frontend](/app/frontend), [Quickstart](/guide/quickstart)

---

## 4. Working Demo And Completeness (`20%`)

Judges should not have to reverse-engineer the project.

**What judges need quickly:** How to run it, what the main flow is, what evidence proves the rollup is real, what artifacts exist.

**Current LendPay has:**
- `README.md`
- `.initia/submission.json`
- Docs site
- Quickstart flow
- Testnet evidence page
- End-to-end borrower demo path

**The demo story is narrow enough to verify:** Connect → analyze → request → approve → use in live destination flow → repay. That is easier to judge than a wide but shallow feature list.

Related: [Quickstart](/guide/quickstart), [Hackathon Readiness](/guide/hackathon-readiness), [Testnet Evidence](/reference/testnet)

---

## 5. Market Understanding (`10%`)

**LendPay's position:**
- Target user: onchain users who want small, reputation-aware app credit
- Distribution path: partner apps and merchant-like app routes
- Business model: origination fee, interest spread, partner integration fees

**Why it is credible:**
- Not pretending to replace a bank on day one
- Roadmap keeps growth behind repayment quality
- Merchant-tied credit is both a usage engine and a risk-control tool
- Tokenomics are positioned as utility, not as the main business

Related: [Business Model](/guide/business-model), [Risk And Growth](/guide/risk-growth), [LEND Tokenomics](/guide/lend-tokenomics)

---

## One-Paragraph Summary For Judges

LendPay is a credit infrastructure layer for Initia apps, not a generic lending UI. It runs on its own MiniMove rollup with real transaction evidence. It uses InterwovenKit, `.init` identity, and session UX in a real borrower flow. The bridge route registry is published onchain locally, even though the destination sell mapping is still pending. The market story is credible because growth, risk, and token utility are already separated clearly.
