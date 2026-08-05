import { fileURLToPath } from "url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url))
    }
  },
  test: {
    include: ["**/*.integration.test.ts"],
    environment: "node",
    setupFiles: ["tests/integration/setup.ts"],
    // One file at a time, because `tests/integration/setup.ts` truncates every public table before
    // each test against a single shared database. Two files in flight would delete each other's
    // fixtures mid-assertion, and the failures would land in whichever file lost the race rather
    // than in the one that caused it.
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://remit_test:remit_test@localhost:5433/remit_test",
      // Never dialled: integration tests stub `@/lib/jobs` at the module boundary, so no queue
      // connection is opened. It is present only because `lib/config/env.ts` validates it at import
      // time and exits the process when it is missing, which would surface here as a worker crash.
      REDIS_URL: "redis://localhost:6379",
      REMIT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      BETTER_AUTH_SECRET: "test-secret-for-integration-tests-not-real",
      BETTER_AUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_STORAGE_BASE_URL: "http://localhost:9000/remit-test",
      MINIO_ENDPOINT: "http://localhost:9000",
      MINIO_ROOT_USER: "minioadmin",
      MINIO_ROOT_PASSWORD: "minioadmin",
      MINIO_BUCKET: "remit-test",
      MINIO_PUBLIC_URL: "http://localhost:9000/remit-test"
    }
  }
})
