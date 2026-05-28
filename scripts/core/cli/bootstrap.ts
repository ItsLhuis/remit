import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

export function loadCliEnvironment(): void {
  const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

  loadEnvConfig(process.cwd())
}
