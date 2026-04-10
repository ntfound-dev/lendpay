import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { pushPrismaSchema, resolveDatabaseUrl } from './db.mjs'

const { Client } = pg

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = resolve(__dirname, 'sql/bootstrap-postgres.sql')
const REQUIRED_PUBLIC_TABLES = [
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

const findMissingTables = async (client) => {
  const result = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [REQUIRED_PUBLIC_TABLES],
  )

  const existingTables = new Set(result.rows.map((row) => row.table_name))
  return REQUIRED_PUBLIC_TABLES.filter((tableName) => !existingTables.has(tableName))
}

export const bootstrapPostgresSchema = async (databaseUrl = resolveDatabaseUrl()) => {
  const sql = await readFile(sqlPath, 'utf8')
  const client = new Client({
    connectionString: databaseUrl,
  })
  let missingTables = []

  await client.connect()
  try {
    await client.query(sql)
    missingTables = await findMissingTables(client)
  } finally {
    await client.end()
  }

  if (missingTables.length > 0) {
    console.warn(`[startup] bootstrap SQL left missing tables (${missingTables.join(', ')})`)
  }

  console.log('[startup] syncing Prisma schema via DATABASE_URL')
  await pushPrismaSchema(databaseUrl)

  const verificationClient = new Client({
    connectionString: databaseUrl,
  })

  await verificationClient.connect()
  try {
    missingTables = await findMissingTables(verificationClient)
  } finally {
    await verificationClient.end()
  }

  if (missingTables.length > 0) {
    throw new Error(
      `Database bootstrap finished but required tables are still missing: ${missingTables.join(', ')}`,
    )
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
