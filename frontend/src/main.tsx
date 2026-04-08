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
import './styles/globals.css'

injectStyles(InterwovenKitStyles)

const queryClient = new QueryClient()
const hiddenWalletSuggestionUrls = new Set([
  'https://metamask.io',
  'https://phantom.com',
  'https://rabby.io',
  'https://keplr.app',
  'https://leapwallet.io',
])

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

const normalizeHref = (href: string | null) => href?.replace(/\/+$/, '') ?? null

const pruneInterwovenWalletSuggestions = (root: Document | ShadowRoot) => {
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const href = normalizeHref(anchor.getAttribute('href'))
    if (!href || !hiddenWalletSuggestionUrls.has(href)) {
      return
    }

    anchor.style.display = 'none'
    const itemContainer = anchor.closest<HTMLElement>('a, button, [role="button"]')
    if (itemContainer) {
      itemContainer.style.display = 'none'
    }
  })

  root.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() ?? ''
    if (button.disabled && ariaLabel.includes('(not installed)')) {
      button.style.display = 'none'
    }
  })
}

const installInterwovenWalletSuggestionPruner = () => {
  if (typeof window === 'undefined') {
    return
  }

  const observedRoots = new WeakSet<Document | ShadowRoot>()

  const scanRoot = (root: Document | ShadowRoot) => {
    pruneInterwovenWalletSuggestions(root)

    if (!observedRoots.has(root)) {
      const observer = new MutationObserver(() => {
        pruneInterwovenWalletSuggestions(root)
        root.querySelectorAll<HTMLElement>('*').forEach((element) => {
          if (element.shadowRoot) {
            scanRoot(element.shadowRoot)
          }
        })
      })

      observer.observe(root, {
        childList: true,
        subtree: true,
      })
      observedRoots.add(root)
    }

    root.querySelectorAll<HTMLElement>('*').forEach((element) => {
      if (element.shadowRoot) {
        scanRoot(element.shadowRoot)
      }
    })
  }

  scanRoot(document)
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
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    }

    if (
      requestUrl.startsWith('https://registry.testnet.initia.xyz/errors/lendpay/') &&
      requestUrl.endsWith('.json')
    ) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    }

    if (requestUrl.includes('/cosmos/feegrant/v1beta1/allowance/')) {
      const response = await originalFetch(input, init)
      if (response.status === 404 || response.status === 500) {
        return new Response(JSON.stringify({ allowance: null }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        })
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

  installInterwovenWalletSuggestionPruner()
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
