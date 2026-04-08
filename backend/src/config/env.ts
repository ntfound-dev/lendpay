import { config as loadEnv } from 'dotenv'
import { z } from 'zod'

loadEnv()

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@127.0.0.1:55432/lendpay_dev?schema=public'),
  JWT_SECRET: z.string().min(8).default('change-me-now'),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_GLOBAL_MAX_REQUESTS: z.coerce.number().int().positive().default(240),
  RATE_LIMIT_MUTATION_MAX_REQUESTS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AUTH_MAX_REQUESTS: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_AI_MAX_REQUESTS: z.coerce.number().int().positive().default(10),
  AUTH_ACCEPT_ANY_SIGNATURE: z.coerce.boolean().default(false),
  PREVIEW_OPERATOR_TOKEN: z.string().min(4).default('preview-operator'),

  ROLLUP_CHAIN_ID: z.string().default('lendpay-4'),
  ROLLUP_RPC_URL: z.string().url().default('http://localhost:26657'),
  ROLLUP_REST_URL: z.string().url().default('http://localhost:1317'),
  ROLLUP_GAS_PRICES: z.string().default('0.015ulend'),
  ROLLUP_GAS_ADJUSTMENT: z.coerce.number().default(1.4),
  MINITIAD_BIN: z.string().optional(),
  ROLLUP_HOME: z.string().optional(),
  ROLLUP_KEY_NAME: z.string().default('operator'),
  ROLLUP_KEYRING_BACKEND: z.string().default('test'),
  ROLLUP_OPERATOR_MNEMONIC: z.string().optional(),
  ROLLUP_NATIVE_DENOM: z.string().default('ulend'),
  ROLLUP_NATIVE_SYMBOL: z.string().default('LEND'),
  FAUCET_CLAIM_AMOUNT: z.coerce.number().int().positive().default(100_000_000),
  FAUCET_COOLDOWN_HOURS: z.coerce.number().int().positive().default(24),

  INITIA_L1_REST_URL: z.string().url().default('https://rest.testnet.initia.xyz'),
  INITIA_L1_RPC_URL: z.string().url().default('https://rpc.testnet.initia.xyz'),
  ENABLE_LIVE_INITIA_READS: z.coerce.boolean().default(false),
  ENABLE_LIVE_ROLLUP_WRITES: z.coerce.boolean().default(false),

  CONNECT_REST_URL: z.string().url().default('https://rest.testnet.initia.xyz'),
  CONNECT_BASE_CURRENCY: z.string().default('INIT'),
  CONNECT_QUOTE_CURRENCY: z.string().default('USD'),
  MINIEVM_REST_URL: z
    .string()
    .url()
    .default('https://rest-evm-1.anvil.asia-southeast.initia.xyz'),
  MINIEVM_CHAIN_ID: z.string().default('evm-1'),
  MINIEVM_CHAIN_NAME: z.string().default('Initia MiniEVM'),
  MINIEVM_LOOKUP_DENOM: z.string().optional(),

  AI_PROVIDER: z.enum(['heuristic', 'ollama']).default('ollama'),
  OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().default('llama3.2:3b'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(12000),
  OLLAMA_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.15),

  LENDPAY_PACKAGE_ADDRESS: z
    .string()
    .default('0x5972A1C7118A8977852DC3307621535D5C1CDA63'),
  LOAN_MODULE_NAME: z.string().default('loan_book'),
  REQUEST_FUNCTION_NAME: z.string().default('request_profiled_loan'),
  APPROVE_FUNCTION_NAME: z.string().default('approve_request'),
  REPAY_FUNCTION_NAME: z.string().default('repay_installment'),

  USERNAMES_MODULE_ADDRESS: z
    .string()
    .default('0x42cd8467b1c86e59bf319e5664a09b6b5840bb3fac64f5ce690b5041c530565a'),
  USERNAMES_MODULE_NAME: z.string().default('usernames'),
  PREVIEW_APPROVAL_ENABLED: z.coerce.boolean().default(true),
})

export type AppEnv = z.infer<typeof schema>
export const env = schema.parse(process.env)

if (env.APP_ENV === 'production' && env.DATABASE_URL.startsWith('file:')) {
  throw new Error('SQLite file databases are not supported for production traffic. Move the backend to PostgreSQL before launch.')
}

process.env.DATABASE_URL = process.env.DATABASE_URL || env.DATABASE_URL
