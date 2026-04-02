export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 1000 ? 2 : 0,
  }).format(value)

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)

export const formatTokenAmount = (value: number, decimals = 0) => {
  const normalized = decimals > 0 ? value / 10 ** decimals : value
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: normalized < 10 && normalized !== 0 ? 2 : 0,
    maximumFractionDigits: decimals > 0 ? Math.min(6, decimals) : 2,
  }).format(normalized)
}

export const formatPoints = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))

export const formatRelative = (value: string) => {
  const diffMs = new Date(value).getTime() - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'in 1 day'
  if (diffDays > 1) return `in ${diffDays} days`
  if (diffDays === -1) return '1 day ago'
  return `${Math.abs(diffDays)} days ago`
}

export const shortenAddress = (address?: string | null) => {
  if (!address) return 'Not connected'
  if (address.length <= 16) return address
  return `${address.slice(0, 10)}...${address.slice(-6)}`
}

export const formatTxHash = (value?: string) => {
  if (!value) return 'Pending'
  if (value.length <= 14) return value
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}
