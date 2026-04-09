import { bootstrapPostgresSchema } from './bootstrap-postgres.mjs'
import { resolveDatabaseUrl } from './db.mjs'

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

const schemaUrl = resolveDatabaseUrl()

console.log('[startup] bootstrapping postgres schema via DATABASE_URL')
console.log(`[startup] schema target: ${redactDatabaseUrl(schemaUrl)}`)

try {
  await bootstrapPostgresSchema(schemaUrl)
} catch (error) {
  console.error('[startup] postgres schema bootstrap failed')
  console.error(error)
  process.exit(1)
}

console.log('[startup] starting backend server')

await import('../dist/server.js')
