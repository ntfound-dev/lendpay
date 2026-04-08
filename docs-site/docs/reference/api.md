# API Reference

This page summarizes the most important backend routes exposed by LendPay.

## Auth

- `POST /api/v1/auth/challenge`
- `POST /api/v1/auth/verify`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

## Borrower

- `GET /api/v1/me`
- `GET /api/v1/me/username`
- `POST /api/v1/me/username/refresh`
- `GET /api/v1/me/points`
- `POST /api/v1/me/rewards/sync`
- `GET /api/v1/me/activity`

## Score

- `GET /api/v1/score`
- `POST /api/v1/score/analyze`
- `GET /api/v1/score/history`

## Requests and Loans

- `GET /api/v1/loan-requests`
- `POST /api/v1/loan-requests`
- `POST /api/v1/loan-requests/:id/approve`
- `GET /api/v1/loans`
- `GET /api/v1/loans/:id`
- `GET /api/v1/loans/:id/schedule`
- `GET /api/v1/loans/:id/fees`
- `POST /api/v1/loans/:id/repay`

## Protocol

- `GET /api/v1/protocol/profiles`
- `GET /api/v1/protocol/campaigns`
- `GET /api/v1/protocol/governance`
- `GET /api/v1/protocol/merchants`
- `GET /api/v1/protocol/viral-drop/items`
- `GET /api/v1/protocol/viral-drop/purchases`
- `GET /api/v1/protocol/liquidity/lend`

## Operator-Gated

- `POST /api/v1/protocol/campaigns`
- `POST /api/v1/protocol/campaigns/:id/allocations`
- `POST /api/v1/protocol/campaigns/:id/close`
- `POST /api/v1/protocol/governance/proposals`
- `POST /api/v1/protocol/governance/:id/vote`
- `POST /api/v1/protocol/governance/:id/finalize`
- `POST /api/v1/protocol/merchants`
- `POST /api/v1/protocol/merchants/:id/active`

## Meta

- `GET /api/v1/health`
- `GET /api/v1/meta/connect-feeds`
- `GET /api/v1/meta/treasury`
- `GET /api/v1/meta/ai`
- `GET /api/v1/meta/chains`
