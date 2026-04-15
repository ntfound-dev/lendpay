import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const invalidMarkers = [
  'rollup-rest-domain',
  'rollup-rpc-domain',
  'backend-domain',
  'example.com',
  'your-domain',
]

const localOnlyMarkers = ['localhost', '127.0.0.1', '0.0.0.0', '.railway.internal']

const requireProductionUrl = (env: Record<string, string>, key: string) => {
  const value = env[key]?.trim() || ''
  if (!value || invalidMarkers.some((marker) => value.includes(marker))) {
    throw new Error(`Missing required production env var: ${key}`)
  }
  if (!value.startsWith('https://') || localOnlyMarkers.some((marker) => value.includes(marker))) {
    throw new Error(`Invalid production env var: ${key}`)
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (command === 'build' && mode !== 'development') {
    requireProductionUrl(env, 'VITE_API_BASE_URL')
    requireProductionUrl(env, 'VITE_CHAIN_INDEXER_URL')
    requireProductionUrl(env, 'VITE_CHAIN_REST_URL')
    requireProductionUrl(env, 'VITE_CHAIN_RPC_URL')
  }

  return {
    build: {
      chunkSizeWarningLimit: 8000,
      rollupOptions: {
        onwarn(warning, warn) {
          if (
            warning.code === 'INVALID_ANNOTATION' ||
            warning.message.includes('contains an annotation that Rollup cannot interpret')
          ) {
            return
          }
          warn(warning)
        },
      },
    },
    resolve: {
      dedupe: ['react', 'react-dom', 'wagmi', '@tanstack/react-query', 'viem'],
    },
    optimizeDeps: {
      include: ['wagmi', '@tanstack/react-query', 'viem'],
    },
    plugins: [
      tailwindcss(),
      react(),
      nodePolyfills({
        globals: {
          Buffer: true,
          process: true,
        },
      }),
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/scan-api': {
          target: 'http://localhost:1317',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/scan-api/, ''),
        },
      },
    },
  }
})
