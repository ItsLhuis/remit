import { fileURLToPath } from "node:url"

import nextEnv from "@next/env"

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url))

// Next.js reads `.env*` only from the project directory, but the one `.env` sits at the workspace
// root, where the Compose files read it too. Next.js has already loaded (and cached) the project
// directory's files before this module runs, so only a forced reload reads the root's; a standalone
// server never evaluates this file and takes its environment from the container. `next dev` watches
// only `apps/web/.env*`: an edit to the root `.env` needs a restart, and a reload Next.js forces
// later (a new `apps/web/.env.local`, say) drops the root's values until the next restart.
nextEnv.loadEnvConfig(workspaceRoot, process.env.NODE_ENV === "development", console, true)

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Tracing stops at the project directory by default, which would leave out every dependency pnpm
  // links from the workspace root's store. Rooting it at the workspace writes the server to
  // `.next/standalone/apps/web/server.js`, the path the Dockerfile's runner stage copies and starts.
  outputFileTracingRoot: workspaceRoot,
  images: {
    qualities: [70, 75, 90]
  }
}

export default nextConfig
