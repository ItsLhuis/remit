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
      // Database 1, never 0: most integration tests stub `@/lib/jobs` and open no connection, but
      // `lib/jobs/__tests__/queueRoundTrip.integration.test.ts` deliberately does not — it runs a
      // real worker against a real queue, which is the only way to catch an id BullMQ rejects. That
      // test obliterates the queue between runs, so it must not share a database with the developer
      // stack's own `remit` queue on db 0.
      REDIS_URL: "redis://localhost:6379/1",
      REMIT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      BETTER_AUTH_SECRET: "test-secret-for-integration-tests-not-real",
      BETTER_AUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_STORAGE_BASE_URL: "http://localhost:9000/remit-test",
      // Placeholders. Real object-storage credentials are operator-chosen secrets and must never be
      // committed (`security.md`), and `.env.test` — which `NODE_ENV=test` makes the authority —
      // carries its own. Tests that would otherwise write real objects stub the PUT instead, so the
      // suite never depends on these reaching a live MinIO.
      MINIO_ENDPOINT: "http://localhost:9000",
      MINIO_ROOT_USER: "minioadmin",
      MINIO_ROOT_PASSWORD: "minioadmin",
      // A bucket of its own, never the developer's `remit`: the PDF tests write real objects, and a
      // suite that truncates its database between tests must not be able to touch real uploads.
      MINIO_BUCKET: "remit-test",
      MINIO_PUBLIC_URL: "http://localhost:9000/remit-test"
    }
  }
})
