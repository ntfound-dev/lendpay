const required = (value: string | undefined, fallback: string) => value?.trim() || fallback

export const appEnv = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8080',
  appchainId: required(import.meta.env.VITE_APPCHAIN_ID, 'lendpay-local-1'),
  chainBech32Prefix: required(import.meta.env.VITE_CHAIN_BECH32_PREFIX, 'init'),
  chainIndexerUrl: required(import.meta.env.VITE_CHAIN_INDEXER_URL, 'http://localhost:8080'),
  chainName: required(import.meta.env.VITE_CHAIN_NAME, 'lendpay'),
  chainNetworkType: required(import.meta.env.VITE_CHAIN_NETWORK_TYPE, 'testnet'),
  chainPrettyName: required(import.meta.env.VITE_CHAIN_PRETTY_NAME, 'LendPay MiniMove'),
  chainRestUrl: required(import.meta.env.VITE_CHAIN_REST_URL, 'http://localhost:1317'),
  chainRpcUrl: required(import.meta.env.VITE_CHAIN_RPC_URL, 'http://localhost:26657'),
  enableDemoApproval: required(import.meta.env.VITE_ENABLE_DEMO_APPROVAL, 'true') === 'true',
  loanModuleName: required(import.meta.env.VITE_LOAN_MODULE_NAME, 'loan_book'),
  nativeDecimals: Number(required(import.meta.env.VITE_NATIVE_DECIMALS, '6')),
  nativeDenom: required(import.meta.env.VITE_NATIVE_DENOM, 'umin'),
  nativeSymbol: required(import.meta.env.VITE_NATIVE_SYMBOL, 'MIN'),
  packageAddress:
    import.meta.env.VITE_PACKAGE_ADDRESS?.trim() ||
    '0x52683DF957C5538C0FA362B068804A120E408D2B',
  previewOperatorToken: import.meta.env.VITE_PREVIEW_OPERATOR_TOKEN?.trim() || 'preview-operator',
  repayFunctionName: required(import.meta.env.VITE_REPAY_FUNCTION_NAME, 'repay_installment'),
  requestCollateralFunctionName: required(
    import.meta.env.VITE_REQUEST_COLLATERAL_FUNCTION_NAME,
    'request_collateralized_loan',
  ),
  requestFunctionName: required(import.meta.env.VITE_REQUEST_FUNCTION_NAME, 'request_profiled_loan'),
  requestProfileId: Number(required(import.meta.env.VITE_REQUEST_PROFILE_ID, '1')),
}

export const isChainWriteReady = Boolean(appEnv.packageAddress)
