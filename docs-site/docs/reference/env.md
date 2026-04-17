# Environment Reference

This page highlights the most important environment variables across the stack.

The stack is split into:

- frontend runtime env
- backend service env
- smart contract deployment and rollup script env

## Frontend

Source file:

```bash
frontend/.env
frontend/.env.example
frontend/.env.production.example
```

Most important variables:

- `VITE_API_BASE_URL`
  Backend base URL used by the app.
- `VITE_APPCHAIN_ID`
  Chain ID used by InterwovenKit and transaction submission.
- `VITE_CHAIN_RPC_URL`
  Rollup RPC URL.
- `VITE_CHAIN_REST_URL`
  Rollup REST URL.
- `VITE_CHAIN_INDEXER_URL`
  Indexer-style URL used by wallet tooling.
- `VITE_PACKAGE_ADDRESS`
  Published Move package address used to build `MsgExecute` calls.
- `VITE_LOAN_MODULE_NAME`
  Usually `loan_book`.
- `VITE_REQUEST_FUNCTION_NAME`
  Main unsecured request function, currently `request_profiled_loan`.
- `VITE_REQUEST_COLLATERAL_FUNCTION_NAME`
  Collateral request function, currently `request_collateralized_loan`.
- `VITE_CANCEL_REQUEST_FUNCTION_NAME`
  Cancel pending request function.
- `VITE_REPAY_FUNCTION_NAME`
  Repayment function, currently `repay_installment`.
- `VITE_REQUEST_PROFILE_ID`
  Default profile used by the UI when building request payloads.
- `VITE_PREVIEW_OPERATOR_TOKEN`
  Only relevant for preview or demo operator flows when surfaced in the frontend.
- `VITE_ENABLE_DEMO_APPROVAL`
  Enables preview self-review UX when supported by backend.

Important rule:

- frontend package address and function names must match the deployed Move package actually running on the rollup
- production frontend builds should set real hosted URLs explicitly instead of relying on fallback defaults

## Backend

Source file:

```bash
backend-go/.env
backend-go/.env.example
```

Most important variables:

- `PORT`
  Backend HTTP port.
- `DATABASE_URL`
  Backend persistence database.
- `DIRECT_DATABASE_URL`
  Optional direct PostgreSQL connection used automatically for Go runtime and schema bootstrap when `DATABASE_URL` points at a pooled endpoint.
- `ROLLUP_CHAIN_ID`
  Chain ID the backend should read and write against.
- `ROLLUP_RPC_URL`
  Rollup RPC target.
- `ROLLUP_REST_URL`
  Rollup REST target.
- `ROLLUP_GAS_PRICES`
  Gas prices used for live rollup writes.
- `ROLLUP_GAS_ADJUSTMENT`
  Gas adjustment multiplier for backend broadcast flows.
- `MINITIAD_BIN`
  Path to the MiniMove binary when backend or local stack scripts need it.
- `ROLLUP_HOME`
  Rollup home directory, usually the local MiniMove home.
- `ROLLUP_KEY_NAME`
  Key used for operator or backend broadcast actions.
- `ROLLUP_KEYRING_BACKEND`
  Keyring backend for the configured key.
- `ROLLUP_OPERATOR_KEYRING_ARCHIVE_B64`
  Optional base64-encoded tar.gz of `keyring-test/` used by hosted backends to restore the operator key without baking secrets into the repo.
- `ROLLUP_OPERATOR_MNEMONIC`
  Optional operator mnemonic path for live write flows.
- `ROLLUP_NATIVE_DENOM`
  Native denom used by the rollup.
- `ROLLUP_NATIVE_SYMBOL`
  Human-readable native symbol shown by the app.
- `ENABLE_LIVE_INITIA_READS`
  Enables live L1 reads such as usernames integration.
- `ENABLE_LIVE_ROLLUP_WRITES`
  Enables real chain write behavior instead of preview-only behavior.
- `CONNECT_REST_URL`
  Connect or pricing source URL used by oracle integration.
- `CONNECT_BASE_CURRENCY`
  Base currency used by backend pricing snapshot.
- `CONNECT_QUOTE_CURRENCY`
  Quote currency used by backend pricing snapshot.
- `MINIEVM_REST_URL`
  MiniEVM route integration target when liquidity route checks are enabled.
- `AI_PROVIDER`
  AI provider selector, currently centered on local Ollama.
- `OLLAMA_BASE_URL`
  Ollama API URL.
- `OLLAMA_MODEL`
  Model used for hybrid scoring.
- `OLLAMA_TIMEOUT_MS`
  Timeout for AI scoring calls.
- `LENDPAY_PACKAGE_ADDRESS`
  The Move package address the backend expects to query or execute against.
- `LOAN_MODULE_NAME`
  Loan module name for backend transaction helpers.
- `REQUEST_FUNCTION_NAME`
  Request function name for backend integration helpers.
- `REQUEST_COLLATERAL_FUNCTION_NAME`
  Collateral request function name for backend integration helpers.
- `APPROVE_FUNCTION_NAME`
  Approval function name for backend operator path.
- `REPAY_FUNCTION_NAME`
  Repayment function name for backend integration helpers.

Operational notes:

- backend session creation depends on signed wallet challenges
- `GET /api/v1/score` can trigger first-time score generation if no cached score exists yet
- read and write chain targets must match the same deployed package
- if your hosted database exposes both pooled and direct URLs, set both so the Go backend can use direct connections for bootstrap and runtime when needed

## Smart Contract

Source file:

```bash
smarcontract/scripts/rollup/.env.example
```

Important context:

- the Move package itself is defined in `smarcontract/Move.toml`
- but deployment, bootstrap, funding, and local rollup scripts use shell env variables
- so yes, the smart contract layer has its own env surface and should be documented here

Most important variables:

- `MINITIAD_BIN`
  Path to the `minitiad` binary used for build, deploy, bootstrap, and live script execution.
- `ROLLUP_HOME`
  Rollup home used by key and transaction helpers.
- `ROLLUP_CHAIN_ID`
  Chain ID the smart contract deployment scripts target.
- `ROLLUP_RPC_URL`
  RPC endpoint used by deploy, bootstrap, and transaction scripts.
- `ROLLUP_KEY_NAME`
  Key name used for deploys and admin executions.
- `ROLLUP_KEYRING_BACKEND`
  Keyring backend used by the scripts.
- `ROLLUP_GAS_PRICES`
  Gas price string used for contract-side transactions.
- `ROLLUP_GAS`
  Gas mode used by helper scripts, defaulting to `auto` in common helpers.
- `ROLLUP_GAS_ADJUSTMENT`
  Gas adjustment multiplier for script broadcasts.
- `ROLLUP_OUTPUT_DIR`
  Directory where deploy and flow artifacts are written.
- `LENDPAY_PACKAGE_ADDRESS`
  Explicit package address override for the named address `lendpay`.
  If this is left blank, the scripts can derive the module address from the deploy key.
- `TREASURY_ADMIN_ADDRESS`
  Address passed into bootstrap for treasury administration.
- `LOAN_ASSET_METADATA`
  Metadata object address of the asset used for loan principal and repayment.

Important smart contract note:

- `LENDPAY_PACKAGE_ADDRESS` is not just cosmetic
- it controls which package address the build, deploy, and execute scripts target
- if it is missing, the scripts derive the address from the deployer key

This is why the package address across layers matters so much:

- frontend uses it to build Move calls
- backend uses it to read and write protocol state
- smart contract scripts use it to deploy, bootstrap, and administer the package

## Shared Consistency Rules

- Missing package addresses should disable live writes, not silently fake success.
- Read and write chain targets must match the same deployed package.
- Frontend, backend, and smart contract scripts should all point at the same chain ID.
- Frontend RPC and backend RPC should refer to the same rollup runtime.
- Backend and smart contract script gas settings should be compatible with the same chain.

## Practical Example

For a healthy local stack, these values should line up conceptually:

- frontend `VITE_APPCHAIN_ID=lendpay-4`
- backend `ROLLUP_CHAIN_ID=lendpay-4`
- smart contract `ROLLUP_CHAIN_ID=lendpay-4`
- frontend `VITE_PACKAGE_ADDRESS=0x...`
- backend `LENDPAY_PACKAGE_ADDRESS=0x...`
- smart contract `LENDPAY_PACKAGE_ADDRESS=0x...`

If one layer points somewhere else, the usual result is:

- read succeeds but write fails
- UI builds the wrong Move calls
- backend mirrors the wrong package
- deploy/bootstrap scripts operate on a different package than the app expects
