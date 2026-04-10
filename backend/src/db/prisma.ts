import { env } from '../config/env.js'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as { prisma?: PrismaClient }

const POOLED_POSTGRES_PORTS = new Set(['6432', '6438', '6543'])
const POOLED_POSTGRES_HOST_MARKERS = ['pooler', 'pool', 'pgbouncer']

const resolvePrismaDatabaseUrl = (databaseUrl: string) => {
  if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
    return databaseUrl
  }

  try {
    const url = new URL(databaseUrl)
    const hostname = url.hostname.toLowerCase()
    const alreadyConfigured = url.searchParams.has('pgbouncer')
    const looksLikePooler =
      POOLED_POSTGRES_PORTS.has(url.port) ||
      POOLED_POSTGRES_HOST_MARKERS.some((marker) => hostname.includes(marker))

    if (alreadyConfigured || !looksLikePooler) {
      return databaseUrl
    }

    // Prisma needs pooler compatibility when runtime traffic goes through a PgBouncer-like endpoint.
    url.searchParams.set('pgbouncer', 'true')
    return url.toString()
  } catch {
    return databaseUrl
  }
}

const prismaDatabaseUrl = resolvePrismaDatabaseUrl(env.DATABASE_URL)

process.env.DATABASE_URL = prismaDatabaseUrl

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: prismaDatabaseUrl,
      },
    },
    log: env.APP_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (env.APP_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
