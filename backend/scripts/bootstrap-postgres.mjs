import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { resolveDatabaseUrl } from './db.mjs'

const { Client } = pg

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = resolve(__dirname, 'sql/bootstrap-postgres.sql')
const BOOTSTRAP_LOCK_KEY = 80412026

const redactDatabaseUrl = (value) => {
  try {
    const url = new URL(value)
    if (url.password) {
      url.password = '***'
    }
    return url.toString()
  } catch {
    return value
  }
}

export const bootstrapPostgresSchema = async (databaseUrl = resolveDatabaseUrl()) => {
  const rawSql = await readFile(sqlPath, 'utf8')
  const sql = [`CREATE SCHEMA IF NOT EXISTS "public";`, `SET search_path TO public;`, rawSql].join('\n')
  const client = new Client({
    connectionString: databaseUrl,
  })

  await client.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [BOOTSTRAP_LOCK_KEY])
    await client.query(sql)
    const verification = await client.query(`SELECT to_regclass('public."User"') AS user_table`)

    if (!verification.rows[0]?.user_table) {
      throw new Error('Bootstrap SQL completed but public."User" is still missing.')
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [BOOTSTRAP_LOCK_KEY])
    } catch {
      // Connection close also releases advisory locks.
    }
    await client.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const databaseUrl = resolveDatabaseUrl()
  console.log('[startup] bootstrapping postgres schema via DATABASE_URL')
  console.log(`[startup] schema target: ${redactDatabaseUrl(databaseUrl)}`)

  try {
    await bootstrapPostgresSchema(databaseUrl)
  } catch (error) {
    console.error('[startup] postgres schema bootstrap failed')
    console.error(error)
    process.exit(1)
  }

  console.log('[startup] postgres schema bootstrap complete')
}
