import { pushPrismaSchema, resolveDatabaseUrl } from './db.mjs'

await pushPrismaSchema(resolveDatabaseUrl())
