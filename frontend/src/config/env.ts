const invalidMarkers = [
  'rollup-rest-domain',
  'rollup-rpc-domain',
  'backend-domain',
  'example.com',
  'your-domain',
]

const localOnlyMarkers = ['localhost', '127.0.0.1', '0.0.0.0', '.railway.internal']

const normalizeEnvUrl = (value: string | undefined) => {
  const normalized = value?.trim()
  if (!normalized) {
    return ''
  }

  if (invalidMarkers.some((marker) => normalized.includes(marker))) {
    return ''
  }

  return normalized
}

const isDev = import.meta.env.DEV

const required = (value: string | undefined, fallback: string) => value?.trim() || fallback

const resolveUrl = (key: string, value: string | undefined, devFallback: string) => {
  const normalized = normalizeEnvUrl(value)
  if (normalized) {
    if (!isDev && (!normalized.startsWith('https://') || localOnlyMarkers.some((marker) => normalized.includes(marker)))) {
      throw new Error(`Invalid production env var: ${key}`)
    }
    return normalized
  }

  if (isDev) {
    return devFallback
  }

  throw new Error(`Missing required production env var: ${key}`)
}

const warnMissingEnvVar = (key: string, value: string | undefined) => {
  if (import.meta.env.DEV && !value?.trim()) {
    console.warn(`Missing env var: ${key}`)
  }
}

warnMissingEnvVar('VITE_ENABLE_DEMO_APPROVAL', import.meta.env.VITE_ENABLE_DEMO_APPROVAL)
warnMissingEnvVar(
  'VITE_REQUEST_COLLATERAL_FUNCTION_NAME',
  import.meta.env.VITE_REQUEST_COLLATERAL_FUNCTION_NAME,
)
warnMissingEnvVar('VITE_CANCEL_REQUEST_FUNCTION_NAME', import.meta.env.VITE_CANCEL_REQUEST_FUNCTION_NAME)

export const appEnv = {
  apiBaseUrl: resolveUrl('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL, 'http://localhost:8080'),
  appchainId: required(import.meta.env.VITE_APPCHAIN_ID, 'lendpay-4'),
  chainBech32Prefix: required(import.meta.env.VITE_CHAIN_BECH32_PREFIX, 'init'),
  chainIndexerUrl: resolveUrl(
    'VITE_CHAIN_INDEXER_URL',
    import.meta.env.VITE_CHAIN_INDEXER_URL,
    'http://localhost:8080',
  ),
  chainName: required(import.meta.env.VITE_CHAIN_NAME, 'lendpay'),
  chainNetworkType: required(import.meta.env.VITE_CHAIN_NETWORK_TYPE, 'testnet'),
  chainPrettyName: required(import.meta.env.VITE_CHAIN_PRETTY_NAME, 'LendPay Testnet'),
  chainRestUrl: resolveUrl(
    'VITE_CHAIN_REST_URL',
    import.meta.env.VITE_CHAIN_REST_URL,
    'http://localhost:1317',
  ),
  chainRpcUrl: resolveUrl(
    'VITE_CHAIN_RPC_URL',
    import.meta.env.VITE_CHAIN_RPC_URL,
    'http://localhost:26657',
  ),
  enableDemoApproval: import.meta.env.VITE_ENABLE_DEMO_APPROVAL?.trim() === 'true',
  loanModuleName: required(import.meta.env.VITE_LOAN_MODULE_NAME, 'loan_book'),
  nativeDecimals: Number(required(import.meta.env.VITE_NATIVE_DECIMALS, '6')),
  nativeDenom: required(import.meta.env.VITE_NATIVE_DENOM, 'ulend'),
  nativeSymbol: required(import.meta.env.VITE_NATIVE_SYMBOL, 'LEND'),
  packageAddress:
    import.meta.env.VITE_PACKAGE_ADDRESS?.trim() ||
    '0x5972A1C7118A8977852DC3307621535D5C1CDA63',
  cancelRequestFunctionName: required(
    import.meta.env.VITE_CANCEL_REQUEST_FUNCTION_NAME,
    'cancel_request',
  ),
  repayFunctionName: required(import.meta.env.VITE_REPAY_FUNCTION_NAME, 'repay_installment'),
  requestCollateralFunctionName: required(
    import.meta.env.VITE_REQUEST_COLLATERAL_FUNCTION_NAME,
    'request_collateralized_loan',
  ),
  requestFunctionName: required(import.meta.env.VITE_REQUEST_FUNCTION_NAME, 'request_profiled_loan'),
  requestProfileId: Number(required(import.meta.env.VITE_REQUEST_PROFILE_ID, '1')),
}

export const isChainWriteReady = Boolean(appEnv.packageAddress)
