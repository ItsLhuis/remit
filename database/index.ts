import { drizzle } from "drizzle-orm/postgres-js"

import postgres from "postgres"

import { env } from "@/lib/env"

import * as schema from "./schema"

export const client = postgres(env.DATABASE_URL)
export const database = drizzle(client, { schema })
