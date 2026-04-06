const required = (value: string | undefined, fallback: string) => value?.trim() || fallback

const warnMissingEnvVar = (key: string, value: string | undefined) => {
  if (import.meta.env.DEV && !value?.trim()) {
    console.warn(`Missing env var: ${key}`)
  }
}

warnMissingEnvVar('VITE_ENABLE_DEMO_APPROVAL', import.meta.env.VITE_ENABLE_DEMO_APPROVAL)
warnMissingEnvVar('VITE_PREVIEW_OPERATOR_TOKEN', import.meta.env.VITE_PREVIEW_OPERATOR_TOKEN)
warnMissingEnvVar(
  'VITE_REQUEST_COLLATERAL_FUNCTION_NAME',
  import.meta.env.VITE_REQUEST_COLLATERAL_FUNCTION_NAME,
)

export const appEnv = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8080',
  appchainId: required(import.meta.env.VITE_APPCHAIN_ID, 'lendpay-4'),
  chainBech32Prefix: required(import.meta.env.VITE_CHAIN_BECH32_PREFIX, 'init'),
  chainIndexerUrl: required(import.meta.env.VITE_CHAIN_INDEXER_URL, 'http://localhost:8080'),
  chainName: required(import.meta.env.VITE_CHAIN_NAME, 'lendpay'),
  chainNetworkType: required(import.meta.env.VITE_CHAIN_NETWORK_TYPE, 'testnet'),
  chainPrettyName: required(import.meta.env.VITE_CHAIN_PRETTY_NAME, 'LendPay Testnet'),
  chainRestUrl: required(import.meta.env.VITE_CHAIN_REST_URL, 'http://localhost:1317'),
  chainRpcUrl: required(import.meta.env.VITE_CHAIN_RPC_URL, 'http://localhost:26657'),
  enableDemoApproval: import.meta.env.VITE_ENABLE_DEMO_APPROVAL?.trim() === 'true',
  loanModuleName: required(import.meta.env.VITE_LOAN_MODULE_NAME, 'loan_book'),
  nativeDecimals: Number(required(import.meta.env.VITE_NATIVE_DECIMALS, '6')),
  nativeDenom: required(import.meta.env.VITE_NATIVE_DENOM, 'ulend'),
  nativeSymbol: required(import.meta.env.VITE_NATIVE_SYMBOL, 'LEND'),
  packageAddress:
    import.meta.env.VITE_PACKAGE_ADDRESS?.trim() ||
    '0x5972A1C7118A8977852DC3307621535D5C1CDA63',
  previewOperatorToken: import.meta.env.VITE_PREVIEW_OPERATOR_TOKEN?.trim(),
  repayFunctionName: required(import.meta.env.VITE_REPAY_FUNCTION_NAME, 'repay_installment'),
  requestCollateralFunctionName: required(
    import.meta.env.VITE_REQUEST_COLLATERAL_FUNCTION_NAME,
    'request_collateralized_loan',
  ),
  requestFunctionName: required(import.meta.env.VITE_REQUEST_FUNCTION_NAME, 'request_profiled_loan'),
  requestProfileId: Number(required(import.meta.env.VITE_REQUEST_PROFILE_ID, '1')),
}

export const isChainWriteReady = Boolean(appEnv.packageAddress)
