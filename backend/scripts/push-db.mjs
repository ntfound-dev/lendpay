import { pushPrismaSchema, resolveDatabaseUrl } from './db.mjs'

pushPrismaSchema(resolveDatabaseUrl())
