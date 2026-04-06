/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_APPCHAIN_ID: string
  readonly VITE_CHAIN_BECH32_PREFIX?: string
  readonly VITE_CHAIN_INDEXER_URL?: string
  readonly VITE_CHAIN_NAME?: string
  readonly VITE_CHAIN_NETWORK_TYPE?: string
  readonly VITE_CHAIN_PRETTY_NAME?: string
  readonly VITE_CHAIN_REST_URL?: string
  readonly VITE_CHAIN_RPC_URL?: string
  readonly VITE_ENABLE_DEMO_APPROVAL?: string
  readonly VITE_LOAN_MODULE_NAME?: string
  readonly VITE_NATIVE_DECIMALS?: string
  readonly VITE_NATIVE_DENOM?: string
  readonly VITE_NATIVE_SYMBOL?: string
  readonly VITE_PACKAGE_ADDRESS?: string
  readonly VITE_PREVIEW_OPERATOR_TOKEN?: string
  readonly VITE_REPAY_FUNCTION_NAME?: string
  readonly VITE_REQUEST_COLLATERAL_FUNCTION_NAME?: string
  readonly VITE_REQUEST_FUNCTION_NAME?: string
  readonly VITE_REQUEST_PROFILE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
