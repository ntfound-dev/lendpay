import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { resolveDatabaseUrl } from './db.mjs'

const { Client } = pg

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = resolve(__dirname, 'sql/bootstrap-postgres.sql')

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
  const sql = await readFile(sqlPath, 'utf8')
  const client = new Client({
    connectionString: databaseUrl,
  })

  await client.connect()
  try {
    await client.query(sql)
  } finally {
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
