import { Buffer } from 'buffer'

type GlobalBufferShim = {
  Buffer?: typeof Buffer
}

type GlobalProcessShim = {
  process?: {
    env: {
      NODE_ENV?: string
    }
  }
}

if (typeof (globalThis as GlobalBufferShim).Buffer === 'undefined') {
  ;(globalThis as GlobalBufferShim).Buffer = Buffer
}

if (typeof (globalThis as unknown as GlobalProcessShim).process === 'undefined') {
  ;(globalThis as unknown as GlobalProcessShim).process = {
    env: { NODE_ENV: 'development' },
  }
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  injectStyles,
  initiaPrivyWalletConnector,
  initiaPrivyWalletOptions,
  InterwovenKitProvider,
  TESTNET,
} from '@initia/interwovenkit-react'
import InterwovenKitStyles from '@initia/interwovenkit-react/styles.js'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import App from './App'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { customChain } from './config/chain'
import { appEnv } from './config/env'
import './styles/globals.css'

if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
  const redirectUrl = new URL(window.location.href)
  redirectUrl.hostname = 'localhost'
  window.location.replace(redirectUrl.toString())
}

injectStyles(InterwovenKitStyles)

const queryClient = new QueryClient()
const localRollupRestOrigins = new Set(['http://127.0.0.1:1317', 'http://localhost:1317'])

const readStoredString = (rawValue: string | null) => {
  if (rawValue === null) {
    return null
  }

  try {
    return JSON.parse(rawValue) as string | null
  } catch {
    return rawValue
  }
}

const readConnectorIdFromPersistedWagmiStore = (rawStore: string | null) => {
  if (rawStore === null) {
    return null
  }

  try {
    const parsedStore = JSON.parse(rawStore) as {
      state?: {
        current?: string | null
        connections?: {
          value?: Array<
            [
              string,
              {
                connector?: {
                  id?: string
                }
              },
            ]
          >
        }
      }
    }

    const currentConnectionUid = parsedStore.state?.current
    const connections = parsedStore.state?.connections?.value ?? []
    const activeConnection = connections.find(([uid]) => uid === currentConnectionUid)
    return activeConnection?.[1]?.connector?.id ?? null
  } catch {
    return null
  }
}

try {
  localRollupRestOrigins.add(new URL(appEnv.chainRestUrl).origin)
} catch {
  // Ignore malformed env and keep the well-known local fallbacks.
}

const responseJSON = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  })

const readRequestOrigin = (requestUrl: string) => {
  try {
    return new URL(requestUrl, window.location.origin).origin
  } catch {
    return null
  }
}

const originalFetch = globalThis.fetch?.bind(globalThis)
if (originalFetch) {
  globalThis.fetch = async (input, init) => {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : String(input)

    if (requestUrl.startsWith(`https://indexer.initia.xyz/initia/${customChain.chain_id}/assets`)) {
      return responseJSON([])
    }

    if (
      requestUrl.startsWith('https://registry.testnet.initia.xyz/errors/lendpay/') &&
      requestUrl.endsWith('.json')
    ) {
      return responseJSON({})
    }

    if (
      requestUrl.startsWith('https://rest.testnet.initia.xyz/cosmos/auth/v1beta1/account_info/')
    ) {
      // InterwovenKit probes Initia L1 account_info to reuse an existing pubkey,
      // but local LendPay borrowers often only exist on the rollup. Returning a
      // neutral response keeps the wallet flow on its built-in sign-message fallback
      // without noisy 404 console errors.
      return responseJSON({ info: null })
    }

    if (requestUrl.includes('/cosmos/feegrant/v1beta1/allowance/')) {
      const response = await originalFetch(input, init)
      if (response.status === 404 || response.status === 500) {
        return responseJSON({ allowance: null })
      }

      return response
    }

    return originalFetch(input, init)
  }
}

if (typeof window !== 'undefined') {
  try {
    const parsedRecentConnector = readStoredString(
      window.localStorage.getItem('wagmi.recentConnectorId'),
    )
    const activePersistedConnector = readConnectorIdFromPersistedWagmiStore(
      window.localStorage.getItem('wagmi.store'),
    )

    if (
      (parsedRecentConnector !== null &&
        parsedRecentConnector !== initiaPrivyWalletOptions.id) ||
      (activePersistedConnector !== null &&
        activePersistedConnector !== initiaPrivyWalletOptions.id)
    ) {
      window.localStorage.removeItem('wagmi.recentConnectorId')
      window.localStorage.removeItem('wagmi.store')
    }
  } catch {
    // Ignore storage parsing/security errors and continue with a clean boot.
  }
}

const wagmiConfig = createConfig({
  connectors: [initiaPrivyWalletConnector],
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig} reconnectOnMount>
        <InterwovenKitProvider
          {...TESTNET}
          defaultChainId={customChain.chain_id}
          customChain={customChain}
          enableAutoSign={{
            [customChain.chain_id]: ['/initia.move.v1.MsgExecute'],
          }}
        >
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </InterwovenKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
