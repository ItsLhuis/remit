import { createRequire } from "node:module"

// Playwright runs these helpers in a plain Node process, outside Next.js, so nothing has loaded
// `.env` for them. `lib/config/env.ts` calls `process.exit(1)` on a missing variable, which
// surfaces as "worker process exited unexpectedly", so the environment must be loaded before any
// module that reads it is imported - hence the dynamic imports below. `@next/env` is CommonJS.
const require = createRequire(import.meta.url)

export async function loadAppContext() {
  const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

  loadEnvConfig(process.cwd())

  const [{ auth }, { database }, schema] = await Promise.all([
    import("@/lib/auth"),
    import("@/database"),
    import("@/database/schema")
  ])

  return { auth, database, schema }
}
