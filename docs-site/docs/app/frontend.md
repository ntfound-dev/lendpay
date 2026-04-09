# Frontend

The frontend is a React + Vite borrower console for the LendPay MiniMove appchain.

It is not only a UI shell. It is the wallet-facing execution layer that coordinates identity, borrower state, transaction approval, and operator or technical surfaces.

## Responsibilities

- connect the wallet through InterwovenKit
- authenticate against the backend with a signed challenge
- load borrower, rewards, loan, campaign, governance, and ecosystem state
- submit Move transactions for request, repay, rewards, campaign, and governance actions
- surface the `LEND -> MiniEVM` bridge path with honest route and liquidity status
- manage timeout, retry, and wallet recovery UX
- present borrower, operator, and technical surfaces without exposing raw protocol complexity

## Main Entry Points

- `src/main.tsx`: app bootstrap, QueryClient, Wagmi, and InterwovenKit provider wiring
- `src/App.tsx`: top-level orchestration for borrower sync, toasts, transaction flow, and page routing
- `src/hooks/useBackendSession.ts`: login challenge flow, session creation, and local session reuse per wallet
- `src/hooks/useAutoSignPermission.ts`: temporary auto-sign permission flow for supported Move actions
- `src/config/env.ts`: runtime config from Vite env variables
- `src/config/chain.ts`: custom chain config for InterwovenKit
- `src/lib/api.ts`: backend API client
- `src/lib/move.ts`: Move `MsgExecute` builders

## Product Surfaces

- `Overview`
- `Profile`
- `Request`
- `Repay`
- `Loyalty Hub`
- `Ecosystem`

## Wallet And Backend Session Flow

The frontend does not treat wallet connection alone as authenticated application access.

The flow is:

1. request a login challenge from the backend
2. ask the wallet to sign the challenge
3. send the signed payload back to backend
4. receive a backend session token
5. reuse that token for borrower data and live protocol actions

Important detail:

- the login signature is not an onchain transaction
- it is only a wallet-authenticated API login step
- the frontend stores the session token locally per connected wallet so refreshes do not always force a new login

## Transaction Model

InterwovenKit is the main transaction handler, but the frontend uses multiple submission paths to keep the UX resilient.

Primary path:

- prepare one or more Move `MsgExecute` messages
- open the standard wallet approval drawer with `requestTxBlock`
- after broadcast, ask the backend to resync borrower state

Fallback path:

- if the drawer path is slow or unstable, the frontend can fall back to direct submission with `submitTxBlock`
- this is wrapped with timeout and recovery logic so a stuck wallet provider does not trap the user in infinite loading

Practical meaning:

- the frontend owns wallet interaction UX
- the backend still owns authenticated API access and normalized borrower state

## Auto-Sign Session

Auto-sign is a temporary wallet-managed permission session, not a permanent blanket approval.

What it is for:

- reducing repeated wallet prompts for supported actions on the same chain
- making repeated borrower actions feel smoother when the wallet already trusts the session window

What it is not:

- not a replacement for backend authentication
- not a replacement for wallet ownership checks
- not permission for every transaction type

Current implementation scope:

- auto-sign is only attempted for supported `/initia.move.v1.MsgExecute` messages
- the wallet may show setup prompts to create the helper signer and grant temporary permission
- the frontend stores a short-lived local hint of the expiry so refresh behavior is less confusing
- if auto-sign is rejected, unavailable, expired, or still syncing, the app falls back to normal wallet approval

So in practice:

- auto-sign improves UX for supported Move actions
- it does not remove the need for the backend session
- it does not guarantee every action becomes one-click

## Interwoven Bridge Surface

The frontend also exposes the `LEND` exit route through Interwoven Bridge.

What the UI does:

- loads the normalized bridge route state from the backend
- shows whether the route came from the onchain registry or a derived fallback
- displays destination denom, venue, pool, liquidity status, and whether swap is actually ready
- opens the Interwoven Bridge surface when the route is actionable

Current local behavior on `lendpay-4`:

- the route registry is already onchain
- the route points to `evm-1 / erc20/LEND`
- the published venue metadata is `InitiaDEX` with pool `LEND/INIT`
- the route still stays preview-only until the official MiniEVM mapping is live

## Data Loading Model

The frontend coordinates more than one kind of state at once:

- borrower identity and authentication state
- score and underwriting state
- requests and live loans
- rewards and loyalty state
- campaign and ecosystem state
- operator and technical diagnostics

Most of this is loaded from the backend API rather than by querying the chain directly from every component.

Why that design exists:

- the backend can merge rollup reads, Prisma mirrors, oracle snapshots, and identity data
- the frontend receives one normalized borrower model instead of rebuilding everything client-side
- error handling becomes easier because the UI can present retry and recovery states when first-load hydration is slow

## Trust Boundary

The frontend is not the final credit authority.

It is responsible for:

- building borrower-facing transaction payloads
- presenting score, limit, reward, and loan state
- managing wallet prompts and recovery states
- deciding which surface or mode the user sees

It is not responsible for:

- verifying signed login payloads
- computing canonical mirrored borrower data
- deciding whether AI output should become the final stored score record
- authorizing treasury-sensitive or operator-only flows by itself

## Modes

- `Operator mode`: `?operator=1` or `#operator`
- `Technical mode`: `?technical=1` or `#technical`

These surface extra tooling without changing the main borrower journey.
