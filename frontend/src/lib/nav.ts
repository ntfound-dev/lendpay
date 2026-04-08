import type { NavKey } from '../types/domain'

export const NAV_ITEMS: Array<{ key: NavKey; label: string; index: string; mobileLabel?: string }> = [
  { key: 'overview', label: 'Overview', index: '01' },
  { key: 'analyze', label: 'Profile', index: '02' },
  { key: 'request', label: 'Request', index: '03' },
  { key: 'loan', label: 'Repay', index: '04' },
  { key: 'rewards', label: 'Loyalty Hub', index: '05', mobileLabel: 'Loyalty' },
  { key: 'admin', label: 'Ecosystem', index: '06' },
]
