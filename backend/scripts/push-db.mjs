import { pushPrismaSchema, resolveBootstrapDatabaseUrl } from './db.mjs'

await pushPrismaSchema(resolveBootstrapDatabaseUrl())
