import { createRequire } from "node:module"

import { findWorkspaceRoot } from "@/lib/config/workspaceRoot"

const require = createRequire(import.meta.url)

export function loadCliEnvironment(): void {
  const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

  loadEnvConfig(findWorkspaceRoot())
}
