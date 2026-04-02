import { appEnv } from './env'

export const customChain = {
  chain_id: appEnv.appchainId,
  chain_name: appEnv.chainName,
  pretty_name: appEnv.chainPrettyName,
  network_type: appEnv.chainNetworkType,
  bech32_prefix: appEnv.chainBech32Prefix,
  logo_URIs: {
    png: 'https://raw.githubusercontent.com/initia-labs/initia-registry/main/testnets/initia/images/initia.png',
    svg: 'https://raw.githubusercontent.com/initia-labs/initia-registry/main/testnets/initia/images/initia.svg',
  },
  apis: {
    rpc: [{ address: appEnv.chainRpcUrl }],
    rest: [{ address: appEnv.chainRestUrl }],
    indexer: [{ address: appEnv.chainIndexerUrl }],
  },
  fees: {
    fee_tokens: [
      {
        denom: appEnv.nativeDenom,
        fixed_min_gas_price: 0,
        low_gas_price: 0,
        average_gas_price: 0,
        high_gas_price: 0,
      },
    ],
  },
  staking: {
    staking_tokens: [{ denom: appEnv.nativeDenom }],
  },
  metadata: {
    is_l1: false,
    minitia: {
      type: 'minimove',
    },
  },
  native_assets: [
    {
      denom: appEnv.nativeDenom,
      name: 'Native Token',
      symbol: appEnv.nativeSymbol,
      decimals: appEnv.nativeDecimals,
    },
  ],
}
