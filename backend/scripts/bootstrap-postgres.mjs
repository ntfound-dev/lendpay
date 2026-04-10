import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import {
  looksLikePooledPostgresUrl,
  resolveBootstrapDatabaseUrl,
  resolveConfiguredDatabaseSchema,
  resolveDatabaseUrl,
  withDatabaseSchema,
} from './db.mjs'

const { Client } = pg

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = resolve(__dirname, 'sql/bootstrap-postgres.sql')
const BOOTSTRAP_LOCK_KEY = 80412026
const APP_TABLES = [
  'User',
  'Challenge',
  'Session',
  'OracleSnapshot',
  'CreditScore',
  'LoanRequest',
  'Loan',
  'Activity',
  'OperatorAction',
  'ReferralLink',
]

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

const detectExistingAppSchema = async (databaseUrl) => {
  const configuredSchema = resolveConfiguredDatabaseSchema()
  if (configuredSchema) {
    return configuredSchema
  }

  try {
    const url = new URL(databaseUrl)
    const existingSchema = url.searchParams.get('schema')
    if (existingSchema) {
      return existingSchema
    }
  } catch {
    return null
  }

  const client = new Client({
    connectionString: databaseUrl,
  })

  await client.connect()
  try {
    const result = await client.query(
      `
        SELECT table_schema, COUNT(*)::int AS hits
        FROM information_schema.tables
        WHERE table_name = ANY($1::text[])
          AND table_schema NOT IN ('pg_catalog', 'information_schema')
        GROUP BY table_schema
        ORDER BY hits DESC, table_schema ASC
      `,
      [APP_TABLES],
    )

    return result.rows[0]?.table_schema ?? null
  } finally {
    await client.end()
  }
}

export const bootstrapPostgresSchema = async (databaseUrl = resolveDatabaseUrl()) => {
  if (looksLikePooledPostgresUrl(databaseUrl) && !process.env.DIRECT_DATABASE_URL?.trim()) {
    console.warn(
      '[startup] skipping postgres schema bootstrap on pooled DATABASE_URL; set DIRECT_DATABASE_URL for direct DDL access',
    )
    return
  }

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

export const resolveApplicationDatabaseUrl = async (databaseUrl = resolveDatabaseUrl()) => {
  const schema = await detectExistingAppSchema(databaseUrl)

  if (!schema) {
    return databaseUrl
  }

  return withDatabaseSchema(databaseUrl, schema)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const databaseUrl = resolveBootstrapDatabaseUrl()
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
