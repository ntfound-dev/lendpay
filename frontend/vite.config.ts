import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
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
  },
})
