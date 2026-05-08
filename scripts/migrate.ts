import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"

import postgres from "postgres"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error("[migrate] ERROR: DATABASE_URL environment variable is not set")
  process.exit(1)
}

const client = postgres(databaseUrl, { max: 1 })
const database = drizzle(client)

try {
  console.log("[migrate] Applying pending migrations...")
  await migrate(database, { migrationsFolder: "./drizzle/migrations" })
  console.log("[migrate] Migrations applied successfully")
} catch (error: unknown) {
  console.error("[migrate] Migration failed:", error)
  process.exitCode = 1
} finally {
  await client.end()
}
