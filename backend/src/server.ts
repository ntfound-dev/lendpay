import { buildApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './db/prisma.js'

try {
  await prisma.$connect()
  console.log('[startup] prisma connected')
} catch (error) {
  console.error('[startup] prisma failed to connect')
  console.error(error)
  process.exit(1)
}

const app = await buildApp()

try {
  await app.listen({
    host: '0.0.0.0',
    port: env.PORT,
  })
  console.log(`[startup] backend listening on 0.0.0.0:${env.PORT}`)
} catch (error) {
  console.error('[startup] backend failed to start')
  console.error(error)
  app.log.error(error)
  process.exit(1)
}
