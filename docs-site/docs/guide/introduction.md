# Introduction

LendPay is an Initia MiniMove appchain for agent-guided credit across Initia apps.

It is best understood as a credit infrastructure layer, not just a loan screen.

LendPay combines:

- a React frontend for credit requests, live app usage, repayment, rewards, and ecosystem activity
- a Go backend for authentication, underwriting, state sync, and operator actions
- Move smart contracts for requests, approvals, repayments, collateral, rewards, campaigns, governance, and app rails

Together, these layers turn one borrower journey into something the wider Initia ecosystem can actually reuse.

For the new server-side agent guide and how it is used in the UI, see [Agentic System](/guide/agentic-system).

## What Problem LendPay Solves

Onchain users can already bridge, trade, and interact with apps, but they still cannot easily access simple consumer credit for real app experiences.

Today, the missing piece is not another wallet or another DEX route. The missing piece is a clean credit rail that can sit between user reputation and actual app usage.

LendPay turns:

- wallet activity
- `.init` identity
- repayment behavior

into ecosystem-aware installment credit.

That means the product is trying to answer a practical question:

How can an Initia user with a real wallet history get lightweight pay-later access inside apps without relying on offchain banks, hidden manual underwriting, or a generic speculative lending flow?

## Product Direction

LendPay is intentionally focused on one clean borrower journey first:

1. connect wallet
2. refresh borrower profile
3. request app credit
4. receive approval and funded balance
5. use credit in an Initia app
6. repay over time

This narrow flow matters because it keeps the product honest.

The goal is not to pretend every future feature is already shipped. The goal is to make one real checkout-credit path work clearly enough that users, partners, and judges can understand it without guesswork.

## Why This Matters

If LendPay works as intended:

- borrowers get easier access to responsible app credit
- partner apps get a reusable checkout credit rail
- repayment history becomes a meaningful onchain reputation signal
- the ecosystem gets a stronger commerce layer instead of only trading and bridging activity

In other words, LendPay is trying to make wallet reputation useful in real consumer app flows, not just visible in dashboards.

## How To Read These Docs

This documentation site explains each layer of that flow in a way that is easier to browse than repo README files.

You can read it in three passes:

- `Guide`
  For product direction, terminology, business model, roadmap, and risk logic.
- `App Stack`
  For frontend, backend, rollup, and contract-layer responsibilities.
- `Reference`
  For API routes, environment variables, and operational details.

For shared language across product, finance, and growth discussions, see [Terminology](/guide/terminology).
