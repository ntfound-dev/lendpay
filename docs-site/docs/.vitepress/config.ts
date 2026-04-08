import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'LendPay Docs',
  description: 'Agent-guided pay-later credit across Initia apps.',
  lang: 'en-US',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#2563eb' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'LendPay Docs',
    search: {
      provider: 'local',
    },
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'App', link: '/app/frontend' },
      { text: 'Protocol', link: '/protocol/move-package' },
      { text: 'Reference', link: '/reference/api' },
      { text: 'GitHub', link: 'https://github.com/ntfound-dev/lendpay' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Quickstart', link: '/guide/quickstart' },
          { text: 'Architecture', link: '/guide/architecture' },
        ],
      },
      {
        text: 'Application',
        items: [
          { text: 'Frontend', link: '/app/frontend' },
          { text: 'Backend', link: '/app/backend' },
        ],
      },
      {
        text: 'Protocol',
        items: [
          { text: 'Move Package', link: '/protocol/move-package' },
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
