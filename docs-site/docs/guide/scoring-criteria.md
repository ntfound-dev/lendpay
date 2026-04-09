# Scoring Criteria

This page translates the hackathon judging criteria into a practical reading of LendPay.

The goal is not to inflate the project. The goal is to make it easy to see where the submission is strong, where the proof already exists, and what judges should be able to verify quickly.

## Judge Lens Summary

| Criteria | Weight | What judges are really asking |
| --- | --- | --- |
| Originality and Track Fit | `20%` | is this a distinct DeFi + AI product with a clear point of view |
| Technical Execution and Initia Integration | `30%` | does the appchain run, does the core logic work, and is Initia integration meaningful |
| Product Value and UX | `20%` | is the product understandable and improved by the Initia experience |
| Working Demo and Completeness | `20%` | can judges verify the flow end to end without guessing |
| Market Understanding | `10%` | does the team understand the user, the market, and the distribution path |

## 1. Originality And Track Fit (`20%`)

Judges are not only asking whether the idea is interesting. They are asking whether it is clearly shaped for its chosen track.

### What LendPay Is Claiming

LendPay is not framed as a generic lending dashboard.

The point of view is:

- `DeFi` because it is an onchain credit rail running on its own MiniMove rollup
- `AI` because underwriting, borrower scoring, and borrower-quality interpretation are part of the product thesis
- more specifically, it is credit infrastructure for Initia apps rather than a standalone loan marketplace

### Why That Is Distinct

The strongest originality claim is not “we also do lending.”

The stronger claim is:

- most onchain apps can swap, bridge, and trade
- very few offer app-native checkout credit with borrower identity, repayment proof, and ecosystem-aware routing
- LendPay treats credit as reusable infrastructure for apps, not just capital access for one borrower screen

### What Helps This Score

- clear `DeFi + AI` fit
- own rollup instead of a mock contract-only demo
- `.init` identity plus borrower behavior as part of the product story
- merchant-tied and app-tied credit framing instead of generic cash-loan framing
- a real bridge-route registry on the rollup that keeps `LEND` exit metadata onchain instead of leaving the whole path as hand-wavy docs

### What To Avoid

- overselling bridge sell readiness or multi-VM futures as if they are the reason the product is special today
- describing the app as “just BNPL onchain” without the infrastructure angle

Related docs:

- [Introduction](/guide/introduction)
- [Business Model](/guide/business-model)
- [Roadmap](/guide/roadmap)

## 2. Technical Execution And Initia Integration (`30%`)

This is the heaviest category, so the proof needs to be concrete.

Judges are effectively checking three things:

1. does the rollup exist and run
2. does the core flow work onchain
3. are Initia-native integrations real rather than decorative

### What LendPay Already Has

- dedicated MiniMove rollup runtime
- deployed package and transaction evidence
- request, approval, and repayment flow implemented against Move modules
- InterwovenKit used as the wallet and transaction layer
- `.init` identity integrated into the borrower model
- temporary auto-sign session UX implemented for supported Move actions
- local bridge helper registry published onchain and surfaced through the Ecosystem page

### Best Evidence To Show

- rollup chain ID `lendpay-4`
- package address and transaction hashes
- borrower request -> approval -> repay flow
- `bridge::initialize` and `bridge::register_route` hashes on the same package
- live docs for frontend, backend, rollup, and Move contract

### Why This Should Score Well

The core product is not simulated in a slide deck. It is wired through:

- frontend wallet flow
- backend auth and state sync
- rollup execution
- onchain Move logic

That is the kind of integration depth judges usually want to see.

Related docs:

- [Hackathon Readiness](/guide/hackathon-readiness)
- [Architecture](/guide/architecture)
- [Frontend](/app/frontend)
- [Rollup](/app/rollup)
- [Move Contract](/app/smartcontract)
- [Testnet Evidence](/reference/testnet)

## 3. Product Value And UX (`20%`)

This category is about clarity and usefulness.

Judges should be able to answer:

- what problem does this solve
- who is it for
- why does Initia make the experience better

### LendPay's Product Story

The product is aiming to make one borrower path simple:

1. connect wallet
2. analyze borrower quality
3. request app credit
4. get funded
5. use the balance in a live app route
6. repay and earn stronger future access

### Why Initia Improves The UX

- InterwovenKit makes wallet and transaction flow native to Initia
- `.init` usernames make borrower identity more readable
- MiniMove rollup execution keeps the credit logic inside the appchain instead of a loose offchain mock
- session UX helps repeated supported actions feel less painful
- the bridge surface can show route truth from the rollup instead of pretending `LEND` exit liquidity is already fully live

### UX Strength

The strongest product decision is that the app is trying to stay legible as a borrower console first, not a giant protocol control panel.

That makes it easier for judges to understand quickly.

Related docs:

- [Architecture](/guide/architecture)
- [Frontend](/app/frontend)
- [Quickstart](/guide/quickstart)

## 4. Working Demo And Completeness (`20%`)

This category is about judge speed.

A good submission should not force judges to reverse-engineer the project.

### What Judges Need Quickly

- how to run it
- what the main flow is
- what evidence proves the rollup and package are real
- what artifacts exist in the repo

### Current LendPay Strength

The project already has:

- `README.md`
- `.initia/submission.json`
- docs site
- quickstart flow
- testnet evidence page
- end-to-end borrower demo path

### What Makes The Demo Strong

The demo story is narrow enough to verify:

- connect wallet
- analyze borrower
- request credit
- approve request
- use it in the live destination flow
- repay installments

That is much easier to judge than a wide but shallow feature list.

Related docs:

- [Quickstart](/guide/quickstart)
- [Hackathon Readiness](/guide/hackathon-readiness)
- [Testnet Evidence](/reference/testnet)

## 5. Market Understanding (`10%`)

This is the smallest category by weight, but it still matters because it tells judges whether the team understands where the product belongs.

### LendPay's Market Position

The cleanest market position is:

- target user: onchain users who want small, reputation-aware app credit
- distribution path: partner apps and merchant-like app routes
- business model: origination fee, interest spread, and partner integration fees

### Why This Is Credible

- the product is not pretending to replace a bank on day one
- the roadmap keeps growth behind repayment quality
- merchant-tied credit is treated as both a usage engine and a risk-control tool
- tokenomics are positioned as utility, not as the main business

### What Judges Should Hear

- the team understands that credit quality matters more than vanity growth
- the team has a believable path from hackathon demo to partner-integrated checkout credit

Related docs:

- [Business Model](/guide/business-model)
- [Risk And Growth](/guide/risk-growth)
- [LEND Tokenomics](/guide/lend-tokenomics)

## The Practical Scoring Story

If the team needs one concise framing for the judges, this is the best version:

1. LendPay is a credit infrastructure layer for Initia apps, not just a generic lending UI.
2. It already runs on its own MiniMove rollup with real transaction evidence.
3. It uses InterwovenKit, `.init` identity, and session UX in a real borrower flow.
4. The bridge route registry is already provable onchain locally, even though the destination sell mapping is still pending.
5. The market story is credible because growth, risk, and token utility are already separated clearly.
