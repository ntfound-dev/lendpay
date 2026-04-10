import { execFileSync } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { Socket } from 'node:net'
import { dirname, resolve } from 'node:path'

export const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:55432/lendpay_dev?schema=public'

const SSLMODE_ALIAS_TO_VERIFY_FULL = new Set(['prefer', 'require', 'verify-ca'])
const POOLED_POSTGRES_PORTS = new Set(['6432', '6438', '6543'])
const POOLED_POSTGRES_HOST_MARKERS = ['pooler', 'pool', 'pgbouncer']

const isPostgresUrl = (databaseUrl) =>
  databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')

const resolvePrismaDatabaseUrl = (databaseUrl) => {
  if (!isPostgresUrl(databaseUrl)) {
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

    url.searchParams.set('pgbouncer', 'true')
    return url.toString()
  } catch {
    return databaseUrl
  }
}

export const normalizeDatabaseUrl = (databaseUrl) => {
  if (!isPostgresUrl(databaseUrl)) {
    return databaseUrl
  }

  try {
    const url = new URL(databaseUrl)
    const sslMode = url.searchParams.get('sslmode')
    const useLibpqCompat = url.searchParams.get('uselibpqcompat') === 'true'

    if (!sslMode || useLibpqCompat || !SSLMODE_ALIAS_TO_VERIFY_FULL.has(sslMode)) {
      return databaseUrl
    }

    url.searchParams.set('sslmode', 'verify-full')
    return url.toString()
  } catch {
    return databaseUrl
  }
}

export const resolveDatabaseUrl = () => {
  const value = process.env.DATABASE_URL?.trim()
  const resolved = value && value.length > 0 ? value : DEFAULT_DATABASE_URL
  return normalizeDatabaseUrl(resolved)
}

const resolveSqlitePath = (databaseUrl) => {
  if (!databaseUrl.startsWith('file:')) {
    return null
  }

  const target = databaseUrl.slice('file:'.length).split('?')[0]

  if (!target || target === ':memory:') {
    return null
  }

  return target.startsWith('/') ? target : resolve(process.cwd(), target)
}

export const prepareSqliteDatabase = (databaseUrl = resolveDatabaseUrl()) => {
  const normalizedDatabaseUrl = normalizeDatabaseUrl(databaseUrl)

  process.env.DATABASE_URL = normalizedDatabaseUrl

  const sqlitePath = resolveSqlitePath(normalizedDatabaseUrl)

  if (!sqlitePath) {
    return
  }

  mkdirSync(dirname(sqlitePath), { recursive: true })
  closeSync(openSync(sqlitePath, 'a'))
}

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms))

const waitForPostgresServer = async (databaseUrl) => {
  const parsed = new URL(databaseUrl)
  const hostname = parsed.hostname || '127.0.0.1'
  const port = Number(parsed.port || 5432)
  let lastError = null

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await new Promise((resolveConnect, rejectConnect) => {
        const socket = new Socket()
        socket.setTimeout(2000)
        socket.once('connect', () => {
          socket.destroy()
          resolveConnect()
        })
        socket.once('timeout', () => {
          socket.destroy()
          rejectConnect(new Error('connection timed out'))
        })
        socket.once('error', (error) => {
          socket.destroy()
          rejectConnect(error)
        })
        socket.connect(port, hostname)
      })
      return
    } catch (error) {
      lastError = error
      await wait(1000)
    }
  }

  throw new Error(
    `PostgreSQL at ${hostname}:${port} did not become ready in time. ${lastError instanceof Error ? lastError.message : ''}`.trim(),
  )
}

export const pushPrismaSchema = async (databaseUrl = resolveDatabaseUrl()) => {
  const prismaDatabaseUrl = resolvePrismaDatabaseUrl(databaseUrl)

  prepareSqliteDatabase(prismaDatabaseUrl)

  if (isPostgresUrl(databaseUrl)) {
    await waitForPostgresServer(databaseUrl)
  }

  execFileSync('./node_modules/.bin/prisma', ['db', 'push', '--skip-generate'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: prismaDatabaseUrl,
    },
    stdio: 'inherit',
  })
}
