# Environment Reference

This page highlights the most important variables across the stack.

## Frontend

- `VITE_API_BASE_URL`
- `VITE_APPCHAIN_ID`
- `VITE_CHAIN_RPC_URL`
- `VITE_CHAIN_REST_URL`
- `VITE_CHAIN_INDEXER_URL`
- `VITE_PACKAGE_ADDRESS`
- `VITE_LOAN_MODULE_NAME`
- `VITE_REQUEST_FUNCTION_NAME`
- `VITE_REQUEST_COLLATERAL_FUNCTION_NAME`
- `VITE_REPAY_FUNCTION_NAME`
- `VITE_PREVIEW_OPERATOR_TOKEN`

## Backend

- `PORT`
- `DATABASE_URL`
- `ROLLUP_CHAIN_ID`
- `ROLLUP_RPC_URL`
- `ROLLUP_REST_URL`
- `ROLLUP_GAS_PRICES`
- `ROLLUP_OPERATOR_MNEMONIC`
- `ENABLE_LIVE_INITIA_READS`
- `ENABLE_LIVE_ROLLUP_WRITES`
- `CONNECT_REST_URL`
- `MINIEVM_REST_URL`
- `LENDPAY_PACKAGE_ADDRESS`

## Operational Notes

- Missing package addresses should disable live writes, not silently fake success.
- Backend session creation depends on signed wallet challenges.
- Read and write chain targets must match the same deployed package.
