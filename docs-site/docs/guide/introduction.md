# Introduction

LendPay is an Initia MiniMove appchain for app-native installment credit.

It combines:
- a React frontend for credit requests, repayment, rewards, loyalty, and ecosystem activity
- a Go backend for authentication, underwriting, state sync, and operator flows
- Move smart contracts for requests, approvals, repayments, collateral, rewards, campaigns, governance, and merchant rails

These layers turn one borrower journey into a credit rail that the wider Initia ecosystem can reuse.

## The Problem

Onchain users can already bridge, trade, and interact with apps. What is missing is a clean credit rail between user reputation and actual app usage.

The gap is not another wallet or DEX route. The gap is lightweight pay-later credit that:
- is tied to real app checkout intent
- is shaped by wallet activity and repayment behavior
- does not rely on offchain banks or manual underwriting

## What LendPay Does

LendPay turns wallet activity, `.init` identity, and repayment history into ecosystem-aware installment credit.

The borrower journey:
1. connect wallet
2. refresh borrower profile
3. request app credit
4. receive approval and funded balance
5. use credit inside an Initia app
6. repay over time and earn stronger future access

## Why It Matters

If LendPay works:
- borrowers get responsible app credit without relying on offchain finance
- partner apps get a reusable checkout credit rail instead of building their own
- repayment history becomes a meaningful onchain reputation signal
- the ecosystem gets a commerce layer beyond trading and bridging

## How To Read These Docs

Three sections:

- **Guide** — product direction, business model, tokenomics, roadmap, risk policy
- **App Stack** — frontend, backend, rollup, and contract responsibilities
- **Reference** — API routes, environment variables, testnet evidence

For shared language across product and engineering discussions, see [Terminology](/guide/terminology).

For the agentic guide system, see [Agentic System](/guide/agentic-system).
