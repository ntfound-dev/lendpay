# Roadmap

This roadmap is intentionally practical.

It follows one rule:

- do not expand faster than the credit engine, repayment quality, and treasury discipline can support

## Status Snapshot

- `Move` rollup borrower flow: already the active core
- frontend + backend console: already the active core
- merchant-linked Move routes: already present in the prototype
- `LEND -> MiniEVM` bridge helper route: already published locally as onchain metadata, still preview for the sell step
- `EVM` contract layer: not live yet
- `Wasm` contract layer: not live yet

## Roadmap Principles

- prove the borrower flow first
- harden risk before scale
- make merchant checkout credit the main product
- treat full bridge sell readiness and multi-VM as later expansion, not phase-one identity

## Phase 1: Prove The Core

Goal:

- make the MiniMove credit flow real, verifiable, and easy to demo

What should ship here:

- live Move package on the rollup
- wallet connect with InterwovenKit
- signed backend session
- borrower score and limit view
- request -> approve -> repay onchain flow
- visible points and `LEND` state
- at least one merchant-linked route that makes the credit use case concrete
- docs, demo, and submission materials

What success looks like:

- one borrower journey can be verified end to end
- the product reads as checkout credit infrastructure, not a generic lending dashboard
- judges or partners can understand the flow without a long explanation

What stays out of scope:

- live `EVM` contract path
- live `Wasm` contract path
- production `LEND` sell route beyond the current onchain preview metadata

## Phase 2: Harden Risk And Operations

Goal:

- make the protocol safer before trying to grow volume

What should ship here:

- segmented risk policy for new, active, and established wallets
- repayment-led line growth
- better late-payment and default handling
- reserve-first treasury policy
- operator tooling, monitoring, and recovery flows
- cleaner borrower status and payment visibility in the app

What success looks like:

- default behavior is measurable and understandable
- bigger limits are earned through repayment, not marketing
- the team can operate the system without manual confusion

## Phase 3: Launch Merchant-Tied Credit

Goal:

- turn the demo flow into a controlled real usage loop

What should ship here:

- onboard 2-3 real partner apps or merchants
- make merchant-tied checkout credit the primary product
- introduce origination fee and interest spread as the live business rails
- measure repeat borrowing, repayment quality, and partner usage
- keep generic cash-loan behavior secondary to merchant checkout usage

What success looks like:

- default rate remains controlled
- real credit demand comes from partner usage
- partner integrations start becoming the first defensible moat
- revenue starts coming from real protocol activity, even if still small

## Phase 4: Grow Treasury, Loyalty, And Liquidity

Goal:

- grow only after the unit economics and borrower quality are credible

What should ship here:

- campaign and referral expansion
- stronger loyalty loops for on-time repayment
- treasury reserve target reached before aggressive burn
- staking rewards backed by actual fee activity
- broader ecosystem route coverage
- better data reporting for business and risk reviews

What success looks like:

- default rate stays below the growth threshold
- fee flows support reserve building and staking incentives
- loyalty mechanics reinforce repayment behavior instead of distracting from it
- `LEND` utility feels real because it is connected to live protocol usage

## Phase 5: Expand To Multi-VM Only When Justified

Goal:

- expand beyond Move only when there is a real product reason

What should happen before this phase:

- Move core is stable
- partner usage exists
- treasury policy is clear
- liquidity route assumptions are not hand-wavy

What should ship here:

- define `EVM` contract layer responsibilities
- define `Wasm` contract layer responsibilities
- document shared liquidity, message flow, and governance assumptions across VMs
- activate cross-VM routes only when mapping and execution are real
- only introduce bridge-based user stories after they are testable and understandable

What success looks like:

- `EVM` and `Wasm` stop being placeholders and become real scoped modules
- the multi-VM story makes LendPay easier to distribute, not harder to explain
- users do not need to understand VM complexity to use the product

## What Is Explicitly "Soon", Not Live

- `EVM` contract docs are placeholders
- `Wasm` contract docs are placeholders
- bridge-driven `LEND` liquidity expansion beyond the current local preview route is future work
- multi-VM messaging should not be used as if it were already shipped

## The Short Version

The sensible order is:

1. prove Move credit flow
2. harden risk and treasury discipline
3. launch merchant-tied usage
4. grow loyalty and liquidity
5. expand to `EVM` and `Wasm` only after the core is stable

## Related Docs

- [Business Model](/guide/business-model)
- [Risk And Growth](/guide/risk-growth)
- [Move Contract](/app/smartcontract)
- [EVM Contract (Soon)](/app/evm-contract)
- [Wasm Contract (Soon)](/app/wasm-contract)
