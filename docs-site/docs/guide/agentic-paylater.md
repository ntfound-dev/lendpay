# Agentic Paylater On Initia

This page describes a forward-looking design direction for LendPay. It is not a live feature.

The idea: extend the current borrower-approved agent layer into a narrower agentic paylater flow for AI-assisted checkout, agent-operated workflows, and app-linked spending inside the Initia environment.

## The Core Idea

- An agent gets an onchain identity handle
- The agent builds reputation through visible behavior
- Higher-risk actions require external validation
- Credit still settles through bounded `Move` execution

The agent trust layer and the money movement layer stay related but are not the same thing.

## Why Initia Fits

LendPay already leans on `Move` execution for request, approval, repayment, and default state; app-linked routes instead of open-ended cash-loan behavior; and InterwovenKit auto-sign for narrow, borrower-approved wallet autonomy. If credit is tied to a real app flow, the protocol can keep it inside a bounded path instead of treating it like unrestricted cash.

## Four Layers

### 1. Registration

An agent needs a stable onchain handle, a metadata file pointing to its operator and capabilities, and a wallet that LendPay can bind to a credit profile.

Rules: no registration means no credit request. No silent trust carryover if ownership changes. Identity opens the door — it is not collateral.

### 2. Reputation

An agent earns better access by completing valid app-linked work, repaying on time, maintaining clean route usage, and avoiding defaults or failed validations.

Starting limits are small. Line growth comes from repayment proof, not token holdings. Raw public feedback alone is not enough for underwriting.

### 3. Validation

A gatekeeper or risk service confirms that a requested action is real and acceptable before funds move. Validation answers: is the task real, is the destination valid, is there a signed quote or order proof?

Validation proves that a spend path is legitimate. It does not eliminate credit risk.

### 4. Credit Execution

LendPay stays `Move`-native here: request creation, approval policy, bounded disbursement, repayment and late-payment handling, default state, and reputation updates tied to actual onchain lifecycle events.

## Where `ERC-8004` Fits

`ERC-8004` is useful as a trust and discovery overlay — registration, discovery, and public reputation signals. It should not be treated as the credit engine.

For LendPay: `ERC-8004` describes who the agent is and what trust signals exist. Initia and `Move` handle request, approval, bounded disbursement, repayment, and default.

This distinction matters because `ERC-8004` is still draft-stage. It is better read as trust infrastructure than as a finished paylater standard.

## What LendPay Already Has

- A deterministic planner layer
- Narrow borrower-approved autonomy
- Onchain borrower reputation updates
- Merchant-linked and app-linked purchase rails

## What Is Still Missing

- Live identity resolution instead of preview-only assumptions
- A clearer agent identity model separate from generic borrower UI state
- A formal validation layer for task or route approval
- Policy for ownership change, operator delegation, and trust reset
- Risk logic built for agents, not only human wallet borrowers

## Constraints That Must Hold Even Later

- Autonomy stays narrow and revocable
- The borrower or operator wallet remains the permission anchor
- Larger approvals keep stronger review and validation
- Credit stays merchant-tied or route-tied before it becomes more general
- The chain remains the final source of truth for settlement state

## Suggested Build Order

1. Keep current borrower-approved autonomy narrow
2. Improve live identity reads and wallet-to-username verification
3. Formalize route validation and app acceptance proofs
4. Add agent-specific reputation inputs and trust downgrade rules
5. Only then test bounded agentic paylater with small limits

## Related Docs

- [Agentic Guide System](/guide/agentic-system)
- [Roadmap](/guide/roadmap)
- [Architecture](/guide/architecture)
- [Business Model](/guide/business-model)
