# Roadmap

One rule: do not expand faster than the credit engine, repayment quality, and treasury discipline can support.

## Current Status

| Layer | Status |
| --- | --- |
| Move rollup borrower flow | live |
| Frontend + backend console | live |
| Merchant-linked Move routes | live (prototype) |
| `LEND → MiniEVM` bridge helper route | onchain metadata published, sell step preview-only |
| EVM contract layer | not live, docs placeholder |
| Wasm contract layer | not live, docs placeholder |

## Phase 1 — Prove The Core

**Goal:** make the MiniMove credit flow real, verifiable, and demo-ready.

Ships:
- live Move package on the rollup
- wallet connect with InterwovenKit
- signed backend session
- borrower score and limit view
- request → approve → repay onchain flow
- visible points and `LEND` state
- at least one merchant-linked route that makes the credit use case concrete
- season airdrop allocation display in Loyalty Hub
- docs, demo, and submission materials

Success: one borrower journey verifiable end to end; the product reads as checkout credit infrastructure, not a generic lending dashboard.

Out of scope: live EVM path, live Wasm path, production `LEND` sell route beyond current onchain preview metadata.

## Phase 2 — Harden Risk And Operations

**Goal:** make the protocol safer before growing volume.

Ships:
- segmented risk policy for new, active, and established wallets
- repayment-led line growth
- better late-payment and default handling
- reserve-first treasury policy
- operator tooling, monitoring, and recovery flows
- cleaner borrower payment visibility

Success: default behavior is measurable; bigger limits are earned through repayment, not marketing.

## Phase 3 — Launch Merchant-Tied Credit

**Goal:** turn the demo flow into a controlled real usage loop.

Ships:
- onboard 2–3 real partner apps or merchants
- merchant-tied checkout credit as the primary product
- live origination fee and interest spread rails
- measure repeat borrowing, repayment quality, and partner usage

Success: default rate stays controlled; real credit demand comes from partner usage; revenue comes from real protocol activity.

## Phase 4 — Grow Treasury, Loyalty, And Liquidity

**Goal:** grow only after unit economics and borrower quality are credible.

Ships:
- campaign and referral expansion
- stronger loyalty loops for on-time repayment
- treasury reserve target reached before aggressive burn
- staking rewards backed by actual fee activity
- broader ecosystem route coverage

Success: default rate below growth threshold; fee flows support reserve and staking incentives; LEND utility feels real because it is connected to live protocol usage.

## Phase 5 — Expand To Multi-VM Only When Justified

**Goal:** expand beyond Move only when there is a real product reason.

Requirements before this phase:
- Move core is stable
- partner usage exists
- treasury policy is clear
- liquidity route assumptions are not hand-wavy

Ships:
- define EVM contract layer responsibilities
- define Wasm contract layer responsibilities
- document shared liquidity, message flow, and governance assumptions across VMs
- activate cross-VM routes only when mapping and execution are real

Success: EVM and Wasm stop being placeholders; the multi-VM story makes LendPay easier to distribute, not harder to explain.

## What Is Explicitly "Soon", Not Live

- EVM contract docs are placeholders
- Wasm contract docs are placeholders
- bridge-driven `LEND` liquidity expansion beyond current local preview route is future work
- agentic paylater for AI agents is a forward-looking design direction, not a live product claim
- multi-VM messaging should not be described as already shipped

## The Short Version

1. prove Move credit flow
2. harden risk and treasury discipline
3. launch merchant-tied usage
4. grow loyalty and liquidity
5. expand to EVM and Wasm only after the core is stable

## Related

- [Business Model](/guide/business-model)
- [Agentic Paylater On Initia](/guide/agentic-paylater)
- [Risk And Growth](/guide/risk-growth)
- [Move Contract](/app/smartcontract)
