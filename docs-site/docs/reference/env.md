# Environment Reference

Environment variables for the full LendPay stack.

## Frontend

Source:
```bash
frontend/.env
frontend/.env.example
frontend/.env.production.example
```

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Backend base URL |
| `VITE_APPCHAIN_ID` | Chain ID for InterwovenKit and transaction submission |
| `VITE_CHAIN_RPC_URL` | Rollup RPC URL |
| `VITE_CHAIN_REST_URL` | Rollup REST URL |
| `VITE_CHAIN_INDEXER_URL` | Indexer URL used by wallet tooling |
| `VITE_PACKAGE_ADDRESS` | Published Move package address for `MsgExecute` calls |
| `VITE_LOAN_MODULE_NAME` | Usually `loan_book` |
| `VITE_REQUEST_FUNCTION_NAME` | Main request function, currently `request_profiled_loan` |
| `VITE_REQUEST_COLLATERAL_FUNCTION_NAME` | Collateral request function |
| `VITE_CANCEL_REQUEST_FUNCTION_NAME` | Cancel pending request function |
| `VITE_REPAY_FUNCTION_NAME` | Repayment function, currently `repay_installment` |
| `VITE_REQUEST_PROFILE_ID` | Default profile ID used when building request payloads |
| `VITE_PREVIEW_OPERATOR_TOKEN` | Preview or demo operator token (frontend-facing) |
| `VITE_ENABLE_DEMO_APPROVAL` | Enables preview self-review UX when supported by backend |

**Rule:** frontend package address and function names must match the deployed Move package on the rollup. Production builds must set real hosted URLs explicitly.

## Backend

Source:
```bash
backend-go/.env
backend-go/.env.example
```

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port, default `8080` |
| `APP_ENV` | `development` or `production` |
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_DATABASE_URL` | Optional direct connection for schema bootstrap when `DATABASE_URL` is pooled |
| `JWT_SECRET` | Session token signing secret |
| `JWT_TTL_SECONDS` | Session token TTL, default 7 days |
| `AUTH_ACCEPT_ANY_SIGNATURE` | Accept any signature for dev/testing |
| `ROLLUP_CHAIN_ID` | Chain ID the backend reads and writes against |
| `ROLLUP_RPC_URL` | Rollup RPC target |
| `ROLLUP_REST_URL` | Rollup REST target |
| `ROLLUP_GAS_PRICES` | Gas prices for live rollup writes |
| `ROLLUP_GAS_ADJUSTMENT` | Gas adjustment multiplier |
| `ROLLUP_HOME` | Local MiniMove home directory |
| `ROLLUP_KEY_NAME` | Key name for operator or backend broadcast actions |
| `ROLLUP_KEYRING_BACKEND` | Keyring backend for the configured key |
| `ROLLUP_OPERATOR_MNEMONIC` | Operator mnemonic for live write flows |
| `ROLLUP_NATIVE_DENOM` | Native denom, e.g. `ulend` |
| `ROLLUP_NATIVE_SYMBOL` | Human-readable symbol, e.g. `LEND` |
| `ROLLUP_NATIVE_DECIMALS` | Decimal places, default `6` |
| `PUBLIC_ROLLUP_REST_URL` | Public rollup REST URL exposed to clients |
| `PUBLIC_ROLLUP_RPC_URL` | Public rollup RPC URL exposed to clients |
| `ENABLE_LIVE_INITIA_READS` | Enables live L1 reads (usernames) |
| `ENABLE_LIVE_ROLLUP_WRITES` | Enables real chain writes instead of preview-only |
| `LENDPAY_PACKAGE_ADDRESS` | Move package address for backend reads and writes |
| `LOAN_MODULE_NAME` | Loan module name |
| `APPROVE_FUNCTION_NAME` | Approval function name |
| `INITIA_L1_REST_URL` | Initia L1 REST for username resolution |
| `INITIA_USERNAMES_MODULE_ADDRESS` | Usernames module address on L1 |
| `CONNECT_REST_URL` | Connect oracle pricing URL |
| `CONNECT_BASE_CURRENCY` | Base currency for oracle snapshot |
| `CONNECT_QUOTE_CURRENCY` | Quote currency for oracle snapshot |
| `MINIEVM_REST_URL` | MiniEVM route integration target |
| `MINIEVM_CHAIN_ID` | MiniEVM chain ID |
| `MINIEVM_CHAIN_NAME` | MiniEVM chain name |
| `AI_PROVIDER` | AI provider selector (`heuristic` or `ollama`) |
| `OLLAMA_BASE_URL` | Ollama API URL |
| `OLLAMA_MODEL` | Model for hybrid scoring |
| `OLLAMA_TIMEOUT_MS` | Timeout for AI scoring calls |
| `PREVIEW_APPROVAL_ENABLED` | Allow preview self-approval flow |
| `PREVIEW_OPERATOR_TOKEN` | Operator token for preview actions |
| `FAUCET_CLAIM_AMOUNT` | Faucet claim amount in base denom |
| `FAUCET_COOLDOWN_HOURS` | Hours between faucet claims |
| `CORS_ORIGIN` | Allowed CORS origin |
| `RATE_LIMIT_ENABLED` | Enable in-memory rate limiting |
| `RATE_LIMIT_GLOBAL_MAX_REQUESTS` | Global GET bucket limit |
| `RATE_LIMIT_MUTATION_MAX_REQUESTS` | Non-GET bucket limit |
| `RATE_LIMIT_AUTH_MAX_REQUESTS` | Auth route bucket limit |
| `RATE_LIMIT_AI_MAX_REQUESTS` | AI route bucket limit |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds |
| **`SEASON_ID`** | Current season number (default `1`) |
| **`SEASON_LEND_ALLOCATION`** | Total LEND allocated for this season (default `100000`) |
| **`SEASON_END_AT`** | Season end date, ISO format, e.g. `2026-06-30` (optional) |

## Smart Contract

Source:
```bash
smarcontract/scripts/rollup/.env.example
```

| Variable | Purpose |
| --- | --- |
| `MINITIAD_BIN` | Path to the `minitiad` binary |
| `ROLLUP_HOME` | Rollup home for key and transaction helpers |
| `ROLLUP_CHAIN_ID` | Chain ID for deployment scripts |
| `ROLLUP_RPC_URL` | RPC endpoint for deploy and bootstrap |
| `ROLLUP_KEY_NAME` | Key name for deploys and admin executions |
| `ROLLUP_KEYRING_BACKEND` | Keyring backend for scripts |
| `ROLLUP_GAS_PRICES` | Gas price string for contract transactions |
| `ROLLUP_GAS` | Gas mode, defaults to `auto` |
| `ROLLUP_GAS_ADJUSTMENT` | Gas adjustment multiplier |
| `ROLLUP_OUTPUT_DIR` | Directory for deploy and flow artifacts |
| `LENDPAY_PACKAGE_ADDRESS` | Package address override for `lendpay` named address |
| `TREASURY_ADMIN_ADDRESS` | Treasury admin address for bootstrap |
| `LOAN_ASSET_METADATA` | Metadata object address for loan principal and repayment |

`LENDPAY_PACKAGE_ADDRESS` controls which package address the build, deploy, and execute scripts target. If blank, scripts derive the address from the deployer key.

## Consistency Rules

These values must match across layers:

| Layer | Variable | Value |
| --- | --- | --- |
| Frontend | `VITE_APPCHAIN_ID` | same chain ID |
| Backend | `ROLLUP_CHAIN_ID` | same chain ID |
| Smart contract | `ROLLUP_CHAIN_ID` | same chain ID |
| Frontend | `VITE_PACKAGE_ADDRESS` | same package address |
| Backend | `LENDPAY_PACKAGE_ADDRESS` | same package address |
| Smart contract | `LENDPAY_PACKAGE_ADDRESS` | same package address |

If one layer points somewhere else: reads succeed but writes fail, the UI builds wrong Move calls, or the backend mirrors the wrong package.

## Railway Private Networking

When backend and rollup run in the same Railway project, use private networking for inter-service URLs:

```
ROLLUP_REST_URL=http://rollup-runtime.railway.internal:1317
ROLLUP_RPC_URL=http://rollup-runtime.railway.internal:26657
```

Set `PUBLIC_ROLLUP_REST_URL` and `PUBLIC_ROLLUP_RPC_URL` to the public HTTPS URLs that clients can reach.
