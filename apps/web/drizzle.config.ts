import { existsSync } from "node:fs"
import path from "node:path"

import { defineConfig } from "drizzle-kit"

import { findWorkspaceRoot } from "./lib/config/workspaceRoot"

// drizzle-kit loads `.env` from its working directory, `apps/web`, but the file sits at the workspace
// root. Like drizzle-kit's own loader, this never overrides a variable the shell already set.
const envFile = path.join(findWorkspaceRoot(), ".env")

if (existsSync(envFile)) process.loadEnvFile(envFile)

export default defineConfig({
  schema: "./database/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
})
