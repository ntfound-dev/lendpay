export const isPrismaMissingTableError = (error: unknown, tables?: string[]) => {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as {
    code?: unknown
    meta?: {
      table?: unknown
    }
  }

  if (candidate.code !== 'P2021') {
    return false
  }

  if (!tables || tables.length === 0) {
    return true
  }

  const table = typeof candidate.meta?.table === 'string' ? candidate.meta.table : ''
  return tables.includes(table)
}
