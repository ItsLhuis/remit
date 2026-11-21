import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./database/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: "postgresql://remit_test:remit_test@localhost:5433/remit_test"
  }
})
