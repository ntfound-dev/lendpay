import { pushPrismaSchema, resolveSchemaDatabaseUrl } from './db.mjs'

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

const schemaUrl = resolveSchemaDatabaseUrl()
const schemaSource = process.env.DIRECT_DATABASE_URL?.trim() ? 'DIRECT_DATABASE_URL' : 'DATABASE_URL'

console.log(`[startup] syncing prisma schema via ${schemaSource}`)
console.log(`[startup] schema target: ${redactDatabaseUrl(schemaUrl)}`)

try {
  await pushPrismaSchema(schemaUrl)
} catch (error) {
  console.error('[startup] prisma schema sync failed')
  console.error(error)
  process.exit(1)
}

console.log('[startup] starting backend server')

await import('../dist/server.js')
