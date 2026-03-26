import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"

import postgres from "postgres"

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("[migrate] ERROR: DATABASE_URL environment variable is not set")
  process.exit(1)
}

const client = postgres(DATABASE_URL, { max: 1 })
const database = drizzle(client)

try {
  console.log("[migrate] Applying pending migrations...")
  await migrate(database, { migrationsFolder: "./drizzle/migrations" })
  console.log("[migrate] Migrations applied successfully")
} catch (error) {
  console.error("[migrate] Migration failed:", error)
  process.exit(1)
} finally {
  await client.end()
}
