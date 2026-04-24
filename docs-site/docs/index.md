---
layout: home

hero:
  name: "LendPay"
  text: "A Move-native credit rail for real Initia app usage"
  tagline: "Turn wallet reputation, `.init` identity, and repayment behavior into reusable pay-later credit across Initia apps, with a live credit flow and a reference demo app integration."
  image:
    src: /favicon.svg
    alt: LendPay
  actions:
    - theme: brand
      text: Judge Quick Scan
      link: /guide/hackathon-readiness
    - theme: alt
      text: Quickstart
      link: /guide/quickstart
    - theme: alt
      text: Scoring Criteria
      link: /guide/scoring-criteria

features:
  - title: App-native credit
    details: Borrowers connect a wallet, refresh analysis, and unlock credit tied to actual Initia app usage instead of a detached loan marketplace.
  - title: Initia-native execution
    details: Requests, approvals, repayments, rewards, campaigns, and app-linked purchases execute on a dedicated MiniMove rollup.
  - title: Full-stack architecture
    details: React frontend, Go backend, and Move contracts work together to keep UI state synced with the chain.
  - title: Proof, not promises
    details: The repo includes testnet transactions, hackathon readiness mapping, and judge-friendly evidence for the end-to-end borrower flow.
---

## Judge Quick Scan

- LendPay is a credit infrastructure layer for Initia apps, not a generic lending UI.
- The live story is simple: connect, analyze, request credit, get approved, use the funded balance through the reference demo app route, and repay.
- The Initia-native proof is visible and defensible: InterwovenKit, `.init` usernames, session UX, and a dedicated MiniMove rollup.
- The fastest supporting pages are [Hackathon Readiness](/guide/hackathon-readiness), [Scoring Criteria](/guide/scoring-criteria), and [Testnet Evidence](/reference/testnet).

## What You Will Find Here

- product and architecture docs for the LendPay stack
- quickstart steps for local development
- frontend, backend, and Move package references
- API and environment documentation
- testnet deployment and proof references

## Stack Overview

LendPay combines:

- a React frontend for borrower onboarding, requests, repayment, rewards, and ecosystem views
- a Go backend for wallet auth, scoring, mirrored state, and operator actions
- a Move package for protocol execution on a MiniMove rollup

## Why It Fits Initia

- It uses InterwovenKit as the actual wallet and transaction layer, not as a badge in the README.
- It makes `.init` identity part of borrower trust and product readability.
- It keeps credit, receipts, and repayment on a dedicated rollup instead of reducing the hackathon entry to a mock frontend.
- It treats bridge support honestly by surfacing route truth and current preview status instead of overselling incomplete liquidity paths.
- It shows the current spend target through a reference demo app integration while keeping the underlying credit flow live and verifiable.

## Core Borrower Flow

1. Connect wallet with InterwovenKit.
2. Refresh borrower profile and score.
3. Request credit for an Initia app.
4. Approve and fund the request.
5. Use the funded balance in the reference demo app route.
6. Repay on schedule and improve reputation.
