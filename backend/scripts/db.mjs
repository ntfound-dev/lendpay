import { execFileSync } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export const DEFAULT_DATABASE_URL = 'file:/tmp/lendpay-dev.db'

export const resolveDatabaseUrl = () => {
  const value = process.env.DATABASE_URL?.trim()
  return value && value.length > 0 ? value : DEFAULT_DATABASE_URL
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
  process.env.DATABASE_URL = databaseUrl

  const sqlitePath = resolveSqlitePath(databaseUrl)

  if (!sqlitePath) {
    return
  }

  mkdirSync(dirname(sqlitePath), { recursive: true })
  closeSync(openSync(sqlitePath, 'a'))
}

export const pushPrismaSchema = (databaseUrl = resolveDatabaseUrl()) => {
  prepareSqliteDatabase(databaseUrl)

  execFileSync('./node_modules/.bin/prisma', ['db', 'push', '--skip-generate'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'inherit',
  })
}
