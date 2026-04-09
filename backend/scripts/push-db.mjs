import { pushPrismaSchema, resolveSchemaDatabaseUrl } from './db.mjs'

await pushPrismaSchema(resolveSchemaDatabaseUrl())
