# Agentic Paylater On Initia

This page describes a possible next-stage direction for LendPay.

It is not a live feature claim.

The idea is to extend the current borrower-approved agent layer into a narrower kind of agentic paylater flow for AI-assisted checkout, agent-operated workflows, and app-linked spending inside the Initia environment.

## The Core Idea

The sharp version of the concept is:

- an agent gets an onchain identity handle
- the agent builds reputation through visible behavior
- higher-risk actions can require external validation
- the credit rail still settles through bounded `Move` execution

This means the agent trust layer and the money movement layer stay related, but they are not the same thing.

## Why Initia Fits This Well

Initia is a strong fit for this direction because LendPay already leans on:

- `Move` execution for request, approval, repayment, and default state
- app-linked or merchant-linked routes instead of open-ended cash-loan behavior
- `InitiaJS` for contract reads and transaction construction
- InterwovenKit auto-sign for narrow, borrower-approved wallet autonomy

The big advantage is control.

If credit is meant for a real app flow, the protocol can keep that credit inside a bounded path instead of treating it like unrestricted cash.

## Where `ERC-8004` Fits

`ERC-8004` is useful here as a trust and discovery overlay for agents.

It is a good conceptual fit for:

- registration and agent discovery
- public reputation signals
- external validation records

It should not be treated as the credit engine itself.

For LendPay, the cleaner framing is:

- `ERC-8004` can describe who the agent is, how it is discovered, and what trust signals exist around it
- Initia and `Move` still handle the actual request, approval, bounded disbursement, repayment, and default lifecycle

This distinction matters because `ERC-8004` is still draft-stage and is better read as trust infrastructure than as a finished paylater standard.

## Four Working Layers

The future design can be thought of as four layers.

### 1. Registration

Registration is the account-opening layer.

An agent should have:

- a stable onchain handle
- a registration file or metadata that points to its operator, service endpoints, and supported capabilities
- a concrete wallet or delegated wallet that LendPay can bind to a credit profile

For LendPay, this should mean:

- no registration, no credit request
- no silent carryover of trust if ownership or operator control changes
- no assumption that identity alone is enough to justify large limits

Identity helps open the door.

It should not be treated as hard collateral.

### 2. Reputation

Reputation is the credit-scoring input layer.

An agent should earn better access by:

- completing valid app-linked work
- repaying on time
- maintaining clean route usage
- avoiding defaults, abusive behavior, or failed validations

In practice, the limit logic can grow from:

- low starting limits
- repayment-led line growth
- stricter caps for new or weakly verified agents
- stronger trust only after repeated healthy behavior

The important nuance is that reputation should stay filterable and reviewable.

Raw public feedback alone is not enough for underwriting.

### 3. Validation

Validation is the reality-check layer.

This is where a gatekeeper, validator set, or app-specific risk service can confirm that a requested action is real and acceptable before funds move.

Validation can help answer questions like:

- is the task real
- is the merchant or destination valid
- is there a signed quote, order, or proof of acceptance
- is there a plausible revenue path or settlement path attached to this action

Validation should not be confused with guaranteed repayment.

It proves that a task or spend path is legitimate.

It does not eliminate credit risk.

### 4. Credit Execution

Credit execution is where LendPay should remain opinionated and `Move`-native.

This layer should handle:

- request creation
- approval policy
- bounded disbursement
- repayment and late-payment handling
- default state
- reputation updates tied to actual onchain lifecycle events

This is the layer that turns agent trust into usable but constrained purchasing power.

## Bounded Spending Is The Real Product Edge

The strongest version of this concept is not "an AI agent gets free cash."

The stronger version is:

- the agent gets access to a bounded credit object
- that credit can only move through approved routes
- usage leaves an auditable trail
- successful use improves future access

This is more defensible than generic wallet borrowing because it keeps the credit tied to productive or app-valid activity.

## Relationship To The Current LendPay System

LendPay already has some of the right ingredients:

- a deterministic planner layer
- a narrow borrower-approved autonomy path
- onchain borrower reputation updates
- merchant-linked and app-linked purchase rails

What is still missing for a stronger agentic paylater model is:

- live identity resolution instead of preview-only identity assumptions
- a clearer agent identity model separate from generic borrower UI state
- a formal validation layer for task or route approval
- policy for ownership change, operator delegation, and trust reset
- risk logic built for agents, not only human wallet borrowers

## What Should Stay True Even Later

Even if LendPay expands into agentic paylater, a few constraints should remain non-negotiable:

- autonomy stays narrow and revocable
- the borrower or operator wallet remains the permission anchor
- larger approvals still keep stronger review and validation
- credit should stay merchant-tied or route-tied before it becomes more general
- the chain remains the final source of truth for settlement state

## Suggested Next Build Order

If this direction is pursued, the safest order is:

1. keep the current borrower-approved autonomy narrow
2. improve live identity reads and wallet-to-username verification
3. formalize route validation and app acceptance proofs
4. add agent-specific reputation inputs and trust downgrade rules
5. only then test bounded agentic paylater with small limits

## Short Version

The concept makes sense if LendPay treats agent identity, reputation, and validation as trust inputs while keeping credit execution, repayment, and bounded spending inside the Initia `Move` rail.

That is the version that feels disciplined instead of hand-wavy.

## Related Docs

- [Agentic Guide System](/guide/agentic-system)
- [Roadmap](/guide/roadmap)
- [Architecture](/guide/architecture)
- [Business Model](/guide/business-model)
