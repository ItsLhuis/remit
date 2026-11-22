import path from "node:path"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { findWorkspaceRoot } from "../workspaceRoot"

const BASE_ENVIRONMENT = {
  DATABASE_URL: "postgresql://remit:remit@localhost:5432/remit",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_SECRET: "test-secret",
  REMIT_PUBLIC_URL: "http://localhost:3000",
  REMIT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  S3_ENDPOINT: "http://localhost:9000",
  S3_ACCESS_KEY_ID: "remit",
  S3_SECRET_ACCESS_KEY: "secret"
}

const workspaceRoot = findWorkspaceRoot()

// Host commands run with `apps/web` as the working directory (`pnpm --filter`), which is what
// would send a relative data directory somewhere other than the root `./data` Compose mounts.
beforeEach(() => {
  vi.resetModules()
  vi.spyOn(process, "cwd").mockReturnValue(path.join(workspaceRoot, "apps", "web"))

  for (const [name, value] of Object.entries(BASE_ENVIRONMENT)) vi.stubEnv(name, value)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

test("resolves a relative data directory against the workspace root when run from the app package", async () => {
  vi.stubEnv("REMIT_DATA_DIR", "./data")

  const { env } = await import("../env")

  expect(env.REMIT_DATA_DIR).toBe(path.join(workspaceRoot, "data"))
})

test("keeps an absolute data directory unchanged when one is configured", async () => {
  const absolute = path.resolve("/srv/remit-data")

  vi.stubEnv("REMIT_DATA_DIR", absolute)

  const { env } = await import("../env")

  expect(env.REMIT_DATA_DIR).toBe(absolute)
})
