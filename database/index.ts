import { drizzle } from "drizzle-orm/postgres-js"

import postgres from "postgres"

import * as schema from "./schema"

export const client = postgres(process.env.DATABASE_URL!)
export const database = drizzle(client, { schema })
