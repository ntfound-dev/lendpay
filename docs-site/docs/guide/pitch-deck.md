# Pitch Deck

This is the final `8-slide` judge-first deck for LendPay.

It is designed for a short hackathon presentation, not a long investor pitch.

The rule is simple:

- every slide should earn its place
- every slide should help a judge understand the product faster
- nothing should be included only because it sounds impressive

## Deck Goal

By the end of the deck, a judge should understand five things:

1. what problem LendPay solves
2. why the solution is distinct
3. why it belongs on Initia
4. how the product actually works
5. why the business and rollout logic are credible

## Final 8-Slide Structure

## Slide 1: Title

### Slide Title

- `LendPay`

### On-Slide Copy

- `Credit infrastructure for Initia apps`
- `MiniMove rollup`
- `InterwovenKit`
- `.init identity`

### What To Show

- clean product screenshot or brand slide
- keep this slide visually simple

### Presenter Line

> LendPay is a credit infrastructure layer for Initia apps, built on its own MiniMove rollup to turn wallet identity and repayment behavior into app-native credit.

## Slide 2: Problem

### Slide Title

- `Onchain users can trade, but they still cannot access simple app credit`

### On-Slide Copy

- users can hold assets, but still lack responsible pay-later access
- apps can attract users, but do not have native checkout credit rails
- generic cash-like lending creates weaker repayment intent

### What To Show

- simple problem graphic or 3 short pain-point blocks

### Presenter Line

> The gap is not only access to capital. The real gap is usable credit inside actual ecosystem experiences, where users want to spend and apps want better conversion.

## Slide 3: Solution

### Slide Title

- `LendPay turns onchain behavior into reusable credit`

### On-Slide Copy

- wallet + identity-aware borrower analysis
- request -> approve -> use -> repay flow
- credit designed for app usage, not generic wallet cash

### What To Show

- one product screenshot or one clean flow visual

### Presenter Line

> LendPay is not just another lender. It is a reusable credit rail that apps can plug into, starting with one clear borrower flow and expanding into embedded checkout credit.

## Slide 4: Product Flow

### Slide Title

- `One borrower path judges can verify quickly`

### On-Slide Copy

1. connect wallet
2. analyze borrower
3. request credit
4. approve and fund
5. use in app
6. repay and improve access

### What To Show

- borrower flow visual from the docs
- or one stitched UI sequence across 2-3 screenshots

### Presenter Line

> The product is intentionally narrow. That makes it understandable, demoable, and verifiable onchain without forcing judges to decode a complicated protocol story.

## Slide 5: Why Initia

### Slide Title

- `Built natively for Initia, not just deployed on it`

### On-Slide Copy

- own MiniMove rollup
- InterwovenKit for wallet and transaction flow
- `.init` usernames for identity
- session UX for supported repeat actions
- Interwoven Bridge surface with onchain route registry

### What To Show

- architecture visual or 4 proof cards

### Presenter Line

> This project is shaped by Initia-native execution and UX. The rollup is real, the wallet flow is real, and the identity and session surfaces are part of the actual borrower experience. Even the `LEND` exit path is now represented onchain through a bridge route registry, while the final sell step still waits for the official MiniEVM mapping.

## Slide 6: Business Model And Market

### Slide Title

- `A credible business model for app-native credit`

### On-Slide Copy

- revenue: origination fee, interest spread, partner fee
- target user: onchain users needing small app credit
- distribution: partner apps and merchant-like flows

### What To Show

- simple table with `user`, `distribution`, `revenue`

### Presenter Line

> LendPay is positioned as credit infrastructure, not just a loan marketplace. That makes the go-to-market more credible because distribution comes from partner apps, not only from direct borrower acquisition.

## Slide 7: LEND Utility And Risk Discipline

### Slide Title

- `Utility first, with risk discipline built in`

### On-Slide Copy

- `POINTS` = loyalty and perks
- `LEND` = tier, collateral, staking, utility
- growth stays behind repayment quality
- reserve first, burn later if default risk is unstable

### What To Show

- one simple token and risk flywheel
- do not overload this slide with dense tokenomics tables

### Presenter Line

> The economic model is separated clearly. Points support behavior, LEND supports utility, and credit line remains the product. Just as importantly, the protocol is designed to prioritize repayment quality and reserve strength before aggressive growth optics.

## Slide 8: Roadmap And Close

### Slide Title

- `Prove the core first, then expand carefully`

### On-Slide Copy

- prove Move borrower flow
- harden risk and merchant-tied usage
- grow loyalty, treasury, and liquidity
- expand bridge and multi-VM only when justified

### What To Show

- one clean roadmap line with `Now`, `Next`, `Later`

### Presenter Line

> LendPay shows how Initia apps can move from wallet activity to real app-native credit with a rollup-first architecture, real wallet UX, and a credible path to reusable onchain commerce infrastructure.

## Best Order For Live Presentation

If you present this deck live, keep the order exactly like this:

1. title
2. problem
3. solution
4. product flow
5. why Initia
6. business model and market
7. token utility and risk discipline
8. roadmap and close

That order works because it moves from:

- what the problem is
- to why LendPay exists
- to proof that it is real
- to why it can become a credible business

## Design Guidance

Keep the deck visually disciplined:

- one message per slide
- one visual anchor per slide
- no paragraph blocks on the slide itself
- keep the spoken explanation in your narration, not the slide body

Best visual mix:

- `2-3` product screenshots
- `1-2` clean diagrams
- `1` simple business model slide
- `1` very light roadmap slide

## What To Avoid

- do not spend a whole slide on bridge if it is not the live core
- do not make tokenomics look like the product itself
- do not present AI as fully autonomous credit authority
- do not overload one slide with product, business model, and roadmap at once
- do not turn the deck into a protocol specification

## Short Presenter Version

If you need one short pitch to open or close the deck, use this:

> LendPay is a credit infrastructure layer for Initia apps. Built on its own MiniMove rollup, it uses wallet identity, borrower behavior, and repayment history to power app-native credit. InterwovenKit, `.init` identity, and session UX make the experience native to Initia, while the business model, token utility, and roadmap stay grounded in repayment quality and real app usage.

## Related Docs

- [Demo Video Script](/guide/demo-video-script)
- [Business Model](/guide/business-model)
- [Scoring Criteria](/guide/scoring-criteria)
- [Hackathon Readiness](/guide/hackathon-readiness)
