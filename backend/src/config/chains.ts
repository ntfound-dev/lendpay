import { env } from './env.js'

export const chainConfig = {
  l1: {
    restUrl: env.INITIA_L1_REST_URL,
    rpcUrl: env.INITIA_L1_RPC_URL,
  },
  rollup: {
    chainId: env.ROLLUP_CHAIN_ID,
    restUrl: env.ROLLUP_REST_URL,
    rpcUrl: env.ROLLUP_RPC_URL,
    gasAdjustment: env.ROLLUP_GAS_ADJUSTMENT,
    gasPrices: env.ROLLUP_GAS_PRICES,
    packageAddress: env.LENDPAY_PACKAGE_ADDRESS,
    loanModuleName: env.LOAN_MODULE_NAME,
  },
} as const
