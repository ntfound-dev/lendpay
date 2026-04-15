import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'LendPay Docs',
  description: 'Agent-guided pay-later credit across Initia apps.',
  lang: 'en-US',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    ['meta', { name: 'theme-color', content: '#2563eb' }],
  ],
  themeConfig: {
    logo: '/favicon.svg',
    siteTitle: 'LendPay Docs',
    search: {
      provider: 'local',
    },
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'App Stack', link: '/app/frontend' },
      { text: 'Onchain Protocol', link: '/protocol/move-package' },
      { text: 'Reference', link: '/reference/api' },
      { text: 'GitHub', link: 'https://github.com/ntfound-dev/lendpay' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Quickstart', link: '/guide/quickstart' },
          { text: 'Hackathon Readiness', link: '/guide/hackathon-readiness' },
          { text: 'Agentic System', link: '/guide/agentic-system' },
          { text: 'Scoring Criteria', link: '/guide/scoring-criteria' },
          { text: 'Demo Video Script', link: '/guide/demo-video-script' },
          { text: 'Pitch Deck', link: '/guide/pitch-deck' },
          { text: 'Architecture', link: '/guide/architecture' },
          { text: 'Terminology', link: '/guide/terminology' },
          { text: 'Business Model', link: '/guide/business-model' },
          { text: 'LEND Tokenomics', link: '/guide/lend-tokenomics' },
          { text: 'Roadmap', link: '/guide/roadmap' },
          { text: 'Risk And Growth', link: '/guide/risk-growth' },
        ],
      },
      {
        text: 'App Stack',
        items: [
          { text: 'Frontend', link: '/app/frontend' },
          { text: 'Scan Explorer', link: '/app/scan-explorer' },
          { text: 'Backend', link: '/app/backend' },
          { text: 'Rollup', link: '/app/rollup' },
          { text: 'Move Contract', link: '/app/smartcontract' },
          { text: 'EVM Contract (Soon)', link: '/app/evm-contract' },
          { text: 'Wasm Contract (Soon)', link: '/app/wasm-contract' },
        ],
      },
      {
        text: 'Onchain Protocol',
        items: [
          { text: 'Onchain Modules', link: '/protocol/move-package' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'API', link: '/reference/api' },
          { text: 'Environment', link: '/reference/env' },
          { text: 'Testnet Evidence', link: '/reference/testnet' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ntfound-dev/lendpay' },
      { icon: 'discord', link: 'https://discord.gg/initia' },
    ],
    outline: {
      level: [2, 3],
    },
    footer: {
      message: 'Built for Initia Hackathon Season 1.',
      copyright: 'Copyright © 2026 Ntfound-dev',
    },
    editLink: {
      pattern: 'https://github.com/ntfound-dev/lendpay/edit/main/docs-site/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
