export const extractTxHash = (value: unknown) => {
  if (!value || typeof value !== 'object') return ''

  const candidate = value as Record<string, unknown>
  const hashKeys = ['txhash', 'txHash', 'transactionHash']

  for (const key of hashKeys) {
    const txHash = candidate[key]
    if (typeof txHash === 'string' && txHash.length > 0) return txHash
  }

  return ''
}
