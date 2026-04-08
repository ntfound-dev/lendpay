import { createHash, randomBytes, randomUUID } from 'node:crypto'

const normalizePrefix = (prefix: string) => {
  const normalized = prefix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'id'
}

export const createPrefixedId = (prefix: string) => `${normalizePrefix(prefix)}-${randomUUID()}`

export const createPreviewTxHash = (prefix: string) => {
  const prefixHex = createHash('sha256').update(prefix).digest('hex').slice(0, 8)
  const randomHex = randomBytes(28).toString('hex')
  return `0x${(prefixHex + randomHex).slice(0, 64)}`
}
