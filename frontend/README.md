# LendPay Frontend

Move-native React frontend for the LendPay hackathon app.

## What is included

- InterwovenKit provider wiring for a custom MiniMove rollup
- dashboard, score, request, loan, rewards, and optional admin views
- backend-aware borrower state loading for auth, score, request, approval, and repayment
- Move message helpers for `request_loan` and `repay_installment`

## Local setup

1. Use Node `20.20.2` or newer. The repo includes `.nvmrc` and the root `.tool-versions`.
2. Copy `.env.example` to `.env`
3. Set `VITE_API_BASE_URL` to the backend, usually `http://localhost:8080`
4. Fill in your rollup and package values
5. Run `npm install`
6. Run `npm run dev`

## Runtime notes

- If `VITE_PACKAGE_ADDRESS` is not set, loan requests and repayments stay in preview mode while still syncing backend state.
- If `VITE_ENABLE_DEMO_APPROVAL=true`, the frontend can trigger preview approval through the backend using `VITE_PREVIEW_OPERATOR_TOKEN`.
- Vite is configured with `vite-plugin-node-polyfills` because `@initia/initia.js` and InterwovenKit need browser polyfills for Node globals.

## Important envs

- `VITE_APPCHAIN_ID`
- `VITE_CHAIN_RPC_URL`
- `VITE_CHAIN_REST_URL`
- `VITE_CHAIN_INDEXER_URL`
- `VITE_API_BASE_URL`
- `VITE_NATIVE_DENOM`
- `VITE_NATIVE_SYMBOL`
- `VITE_PACKAGE_ADDRESS`
- `VITE_PREVIEW_OPERATOR_TOKEN`
- `VITE_LOAN_MODULE_NAME`
- `VITE_REQUEST_FUNCTION_NAME`
- `VITE_REPAY_FUNCTION_NAME`
