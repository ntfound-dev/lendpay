import { bootstrapPostgresSchema, resolveApplicationDatabaseUrl } from './bootstrap-postgres.mjs'
import { resolveBootstrapDatabaseUrl, resolveDatabaseUrl } from './db.mjs'

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

const schemaUrl = resolveBootstrapDatabaseUrl()

console.log('[startup] bootstrapping postgres schema via DATABASE_URL')
console.log(`[startup] schema target: ${redactDatabaseUrl(schemaUrl)}`)

try {
  await bootstrapPostgresSchema(schemaUrl)
} catch (error) {
  console.error('[startup] postgres schema bootstrap failed')
  console.error(error)
  process.exit(1)
}

const runtimeUrl = await resolveApplicationDatabaseUrl(resolveDatabaseUrl())
process.env.DATABASE_URL = runtimeUrl

console.log(`[startup] runtime target: ${redactDatabaseUrl(runtimeUrl)}`)
console.log('[startup] starting backend server')

await import('../dist/server.js')
