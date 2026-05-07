import { drizzle } from "drizzle-orm/postgres-js"

import postgres from "postgres"

import * as schema from "@/database/schema"

const url =
  process.env.DATABASE_URL ?? "postgresql://remit_test:remit_test@localhost:5433/remit_test"

export const client = postgres(url)
export const database = drizzle(client, { schema })
