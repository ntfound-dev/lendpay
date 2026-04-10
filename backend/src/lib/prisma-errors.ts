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

export const isPrismaPreparedStatementError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as {
    message?: unknown
  }

  const message = typeof candidate.message === 'string' ? candidate.message : ''

  return (
    message.includes('prepared statement') &&
    message.includes('does not exist') &&
    (message.includes('PGCAT_') || message.includes('code: "26000"'))
  )
}

export const isPrismaRecoverableStorageError = (error: unknown, tables?: string[]) =>
  isPrismaMissingTableError(error, tables) || isPrismaPreparedStatementError(error)
