---
layout: home

hero:
  name: "LendPay"
  text: "Open credit infrastructure for Initia apps"
  tagline: "Turn wallet reputation, identity, and repayment behavior into pay-later credit across NFT, gaming, and DeFi experiences on Initia."
  image:
    src: /favicon.svg
    alt: LendPay
  actions:
    - theme: brand
      text: Read the docs
      link: /guide/introduction
    - theme: alt
      text: Quickstart
      link: /guide/quickstart

features:
  - title: Reputation-based credit
    details: Borrowers connect a wallet, refresh analysis, and unlock score-based credit products tied to their onchain behavior.
  - title: Initia-native execution
    details: Requests, approvals, repayments, rewards, campaigns, and app-linked purchases execute on a MiniMove rollup.
  - title: Full-stack architecture
    details: React frontend, Fastify backend, and Move contracts work together to keep UI state synced with the chain.
  - title: Real app flows
    details: LendPay is designed around a truthful borrower lifecycle, not just a dashboard mockup.
---

## What You Will Find Here

- product and architecture docs for the LendPay stack
- quickstart steps for local development
- frontend, backend, and Move package references
- API and environment documentation
- testnet deployment and proof references

## Stack Overview

LendPay combines:

- a React frontend for borrower onboarding, requests, repayment, rewards, and ecosystem views
- a TypeScript backend for wallet auth, scoring, mirrored state, and operator actions
- a Move package for protocol execution on a MiniMove rollup

## Core Borrower Flow

1. Connect wallet with InterwovenKit.
2. Refresh borrower profile and score.
3. Request credit for an Initia app.
4. Approve and fund the request.
5. Use the funded balance in an app route.
6. Repay on schedule and improve reputation.
