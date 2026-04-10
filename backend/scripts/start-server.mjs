import { bootstrapPostgresSchema, resolveApplicationDatabaseUrl } from './bootstrap-postgres.mjs'
import {
  looksLikePooledPostgresUrl,
  resolveBootstrapDatabaseUrl,
  resolveDatabaseUrl,
  resolveRuntimeDatabaseUrl,
} from './db.mjs'

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
const configuredDatabaseUrl = resolveDatabaseUrl()
const runtimeBaseUrl = resolveRuntimeDatabaseUrl(configuredDatabaseUrl)
const schemaSourceLabel = schemaUrl === configuredDatabaseUrl ? 'DATABASE_URL' : 'DIRECT_DATABASE_URL'

console.log(`[startup] bootstrapping postgres schema via ${schemaSourceLabel}`)
console.log(`[startup] schema target: ${redactDatabaseUrl(schemaUrl)}`)

try {
  await bootstrapPostgresSchema(schemaUrl)
} catch (error) {
  console.error('[startup] postgres schema bootstrap failed')
  console.error(error)
  process.exit(1)
}

if (runtimeBaseUrl !== configuredDatabaseUrl) {
  console.log('[startup] using DIRECT_DATABASE_URL for Prisma runtime because DATABASE_URL points to a pooled Postgres endpoint')
} else if (looksLikePooledPostgresUrl(configuredDatabaseUrl)) {
  console.log('[startup] pooled DATABASE_URL detected without DIRECT_DATABASE_URL; falling back to Prisma pooler compatibility mode')
}

const runtimeUrl = await resolveApplicationDatabaseUrl(runtimeBaseUrl)
process.env.DATABASE_URL = runtimeUrl

console.log(`[startup] runtime target: ${redactDatabaseUrl(runtimeUrl)}`)
console.log('[startup] starting backend server')

await import('../dist/server.js')
