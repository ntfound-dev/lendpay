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
      { icon: 'discord', link: 'https://discord.gg/qhbTQEqA' },
      { icon: 'x', link: 'https://x.com/lendpay1' },
      { icon: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.48 14.051l-2.95-.924c-.642-.204-.657-.642.136-.953l11.57-4.461c.537-.194 1.006.131.326.535z"/></svg>' }, link: 'https://t.me/lenpay12' },
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
