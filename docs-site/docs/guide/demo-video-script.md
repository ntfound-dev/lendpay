# Demo Video Script

This page is the practical script for a `3-minute` LendPay demo video.

The goal is simple:

- keep the story narrow
- show one real end-to-end flow
- make judges understand the product without extra explanation

## Demo Principle

Do not try to show everything.

The strongest demo is:

1. connect wallet
2. show borrower context
3. request credit
4. approve and fund
5. use the credit in the live destination
6. repay and close with the product thesis

That is enough.

## Recording Setup

Recommended format:

- one clean screen recording
- one narrator voice track, either live or added after
- browser zoom at `110%` to `125%` if needed
- avoid switching tabs too much
- keep terminal proof ready, but only show it briefly if needed

Before recording:

- run the local stack and confirm it is stable
- make sure the wallet is already unlocked
- connect once before recording if you want to avoid dead time
- prepare the account so the demo flow completes cleanly

## 3-Minute Structure

### `0:00 - 0:20` Opening

What to show:

- LendPay landing view or overview screen

Suggested narration:

> LendPay is a credit infrastructure layer for Initia apps. It runs on its own MiniMove rollup and turns wallet identity, borrower behavior, and repayment history into app-native credit.

### `0:20 - 0:40` Initia Fit

What to show:

- wallet connected
- visible `.init` or wallet identity surface
- quick glance at the app UI

Suggested narration:

> This is not a mock dashboard. LendPay uses InterwovenKit for wallet and transaction handling, runs on its own rollup, and integrates Initia-native identity and session UX into the borrower flow.

### `0:40 - 1:10` Borrower Context

What to show:

- overview or profile page
- borrower score, limit, points, or rewards state

Suggested narration:

> After the wallet connects, the app loads borrower context from the backend and the rollup. The borrower can see score output, available credit, rewards, and current account state before taking any action.

### `1:10 - 1:40` Request Credit

What to show:

- request page
- choose app or merchant-like route
- submit credit request
- InterwovenKit wallet approval

Suggested narration:

> Here the borrower requests app credit through the live LendPay flow. The request is submitted as a real Move transaction through InterwovenKit, so the approval path is part of the actual Initia user experience.

### `1:40 - 2:00` Approval And Funding

What to show:

- operator approval path or approved state
- funded balance reflected in the UI

Suggested narration:

> Once the request is approved, the borrower receives funded credit inside the LendPay flow. This is where the product becomes more than a credit score screen: the approved line becomes usable purchasing power.

### `2:00 - 2:25` Use Credit In App

What to show:

- ecosystem or live destination route
- the funded balance being used in the live app path

Suggested narration:

> The borrower can now use the approved balance in the live destination flow. This is the key product point: LendPay is not only issuing a loan, it is acting as credit infrastructure for actual app usage inside the Initia ecosystem.

### `2:25 - 2:50` Repayment

What to show:

- repay page
- installment action
- if possible, show success state and updated borrower status

Suggested narration:

> Repayment also happens through the onchain flow. As repayments are completed, borrower reputation, rewards, and future access can improve. That creates a cleaner onchain credit loop than generic wallet borrowing.

### `2:50 - 3:00` Close

What to show:

- back to overview or architecture summary

Suggested narration:

> LendPay shows how Initia apps can support reusable, identity-aware credit on a dedicated MiniMove rollup, with real wallet UX, real borrower flow, and a clear path toward app-integrated checkout credit.

## Full Script Version

If you want one continuous script to read with minimal improvisation, use this:

> LendPay is a credit infrastructure layer for Initia apps. It runs on its own MiniMove rollup and turns wallet identity, borrower behavior, and repayment history into app-native credit. This is not a mock dashboard. LendPay uses InterwovenKit for wallet and transaction handling, runs on its own rollup, and integrates Initia-native identity and session UX into the borrower flow. After the wallet connects, the app loads borrower context from the backend and the rollup. The borrower can see score output, available credit, rewards, and current account state before taking any action. Here the borrower requests app credit through the live LendPay flow. The request is submitted as a real Move transaction through InterwovenKit, so the approval path is part of the actual Initia user experience. Once the request is approved, the borrower receives funded credit inside the LendPay flow. This is where the product becomes more than a credit score screen: the approved line becomes usable purchasing power. The borrower can now use the approved balance in the live destination flow. This is the key product point: LendPay is not only issuing a loan, it is acting as credit infrastructure for actual app usage inside the Initia ecosystem. Repayment also happens through the onchain flow. As repayments are completed, borrower reputation, rewards, and future access can improve. That creates a cleaner onchain credit loop than generic wallet borrowing. LendPay shows how Initia apps can support reusable, identity-aware credit on a dedicated MiniMove rollup, with real wallet UX, real borrower flow, and a clear path toward app-integrated checkout credit.

## What Not To Do In The Video

- do not explain every page
- do not open too many technical panels
- do not spend too long on tokenomics
- do not rely on future bridge or multi-VM features
- do not let wallet unlock steps consume half the video

## Backup Cut If Something Breaks

If the full flow becomes unstable during recording, keep this fallback structure:

1. show connected wallet and borrower overview
2. show testnet evidence page or terminal proof
3. show request flow
4. show approved or funded state
5. show repayment state
6. close with architecture and product thesis

That is still much better than a chaotic full-length recording.

## Related Docs

- [Hackathon Readiness](/guide/hackathon-readiness)
- [Scoring Criteria](/guide/scoring-criteria)
- [Quickstart](/guide/quickstart)
- [Architecture](/guide/architecture)
