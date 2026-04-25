# Frontend

The frontend is a React + Vite borrower console at `frontend/`. It is the wallet-facing execution layer for identity, borrower state, transaction approval, and ecosystem interactions.

## Responsibilities

- connect wallet through InterwovenKit
- authenticate against the backend with a signed challenge
- load borrower, rewards, loan, campaign, governance, and ecosystem state
- submit Move transactions for request, repay, rewards, campaigns, and governance
- surface the `LEND → MiniEVM` bridge path with honest route and liquidity status
- manage timeout, retry, and wallet recovery UX

## Entry Points

| File | Purpose |
| --- | --- |
| `src/main.tsx` | app bootstrap, QueryClient, Wagmi, InterwovenKit provider wiring |
| `src/App.tsx` | top-level orchestration: borrower sync, toasts, transaction flow, routing |
| `src/hooks/useBackendSession.ts` | login challenge flow, session creation, local session reuse per wallet |
| `src/hooks/useAutoSignPermission.ts` | temporary auto-sign permission flow |
| `src/config/env.ts` | runtime config from Vite env variables |
| `src/config/chain.ts` | custom chain config for InterwovenKit |
| `src/lib/api.ts` | backend API client |
| `src/lib/move.ts` | Move `MsgExecute` builders |
| `src/lib/appHelpers.ts` | merchant banners, showcase items, drop artwork, scoring helpers |

## Product Surfaces

| Surface | What it shows |
| --- | --- |
| Overview | account status, agent guide panel, tier and rewards summary |
| Profile | identity steps (L1 username + rollup attestation), credit score, LEND holdings |
| Request | app selector, credit product picker, checkout card with merchant banner |
| Loan | active loan, installment schedule, repayment flow |
| Loyalty Hub | points tier, leaderboard, season airdrop estimate, convert and spend |
| Ecosystem | live app cards, merchant detail modal, viral drop purchases, protocol tools |
| Bridge | LEND exit route status from the rollup registry |

## Wallet And Session Flow

The frontend does not treat wallet connection alone as authenticated access.

1. Request a login challenge from the backend.
2. Ask the wallet to sign the challenge.
3. Send the signed payload to the backend.
4. Receive a session token.
5. Reuse that token for all borrower data reads and protocol actions.

The login signature is not an onchain transaction — it is only a wallet-authenticated API login step. The session token is stored locally per connected wallet so refreshes do not always force a new login.

## Transaction Model

Primary path:

- prepare one or more Move `MsgExecute` messages
- open the wallet approval drawer via `requestTxBlock`
- after broadcast, ask the backend to resync borrower state
- if the backend returns pending confirmation, show "submitted" not "confirmed"

Fallback path:

- `submitTxBlock` with timeout and recovery logic handles cases where the wallet provider becomes slow or unresponsive

## Auto-Sign Session

Auto-sign is a temporary wallet-managed permission session for supported Move actions. It reduces repeated wallet prompts without replacing backend authentication or wallet ownership checks.

- only attempted for supported `/initia.move.v1.MsgExecute` messages
- if rejected, unavailable, expired, or still syncing, the app falls back to normal wallet approval
- the borrower can disable it at any time

## Identity Card

The Profile page shows borrower identity as a two-step checklist:

- Step 1: L1 username — checks whether a `.init` name is registered on Initia L1
- Step 2: Rollup attestation — checks whether that username is attested on the LendPay rollup

Step 2 is locked until Step 1 is complete. A +25 pts bonus is shown when identity is unverified, making it clear what is at stake.

## Ecosystem And Merchant Modal

The Ecosystem page shows live app cards (Initia Atelier, Arcade Mile, and others) as clickable buttons. Clicking an app opens a merchant detail modal that shows:

- the app's drop items filtered to that merchant
- buy button wired to the live viral drop purchase flow

The alert bar at the top of the Ecosystem page is dynamic — it appears only when there is an upcoming due item and hides otherwise.

## Loyalty Hub Season Allocation

The "Convert and spend points" card in Loyalty Hub shows a season allocation banner when season data is available:

- Season N with total LEND allocated
- a progress bar showing the user's percentage of total platform points
- an estimated airdrop amount: `(user_points / total_platform_points) * season_allocation`

Below the banner, the existing fixed-rate conversion form (1000 pts = 10 LEND) remains for on-chain redemption.

## Bridge Surface

- loads normalized bridge route state from the backend
- shows route source (onchain registry or derived fallback), destination denom, venue, pool, and liquidity status
- opens the Interwoven Bridge when the route is actionable

Current `lendpay-4` state: route is registered onchain (`ulend → evm-1/erc20/LEND`, InitiaDEX, LEND/INIT pool) but stays preview-only until the official MiniEVM mapping is live.

## Data Loading

Most borrower state is loaded from the backend API in one parallel batch on login:

- profile, score, requests, loans, activity
- rewards, campaigns, governance, merchants, faucet, referral, leaderboard
- viral drop items and purchases
- season allocation data (public, no auth required)

This keeps the UI from rebuilding everything from raw chain calls and makes error handling consistent — the app can show retry and recovery states when a section fails to load.

## Trust Boundary

The frontend is responsible for:
- building transaction payloads
- presenting score, limit, reward, and loan state
- managing wallet prompts and recovery states

It is not responsible for:
- verifying signed login payloads
- computing canonical borrower data
- authorizing treasury-sensitive or operator-only flows

## Developer Modes

- `?operator=1` or `#operator` — surfaces operator tooling
- `?technical=1` or `#technical` — surfaces technical diagnostics

These modes add extra panels without changing the main borrower journey.
