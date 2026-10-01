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
      // The suite's own Redis, published by docker-compose.test.yml on 6380. Most integration tests
      // stub `@/lib/jobs` and open no connection, but
      // `lib/jobs/__tests__/queueRoundTrip.integration.test.ts` deliberately does not — it runs a
      // real worker against a real queue, which is the only way to catch an id BullMQ rejects, and
      // it obliterates that queue between runs. Pointed at 6379 it obliterated whatever answered
      // there, which on a developer host is the development stack's own queue.
      REDIS_URL: "redis://localhost:6380",
      REMIT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      // Never the `data` default: `REMIT_DATA_DIR` is resolved relative to the working directory, so
      // a suite that writes backup archives would otherwise drop them into the developer's real data
      // volume beside their own uploads.
      REMIT_DATA_DIR: ".tmp/integration-data",
      BETTER_AUTH_SECRET: "test-secret-for-integration-tests-not-real",
      REMIT_PUBLIC_URL: "http://localhost:3000",
      // The test stack's own store, published by docker-compose.test.yml on 9020 and never the
      // development stack's 9000, with throwaway credentials that exist only there. Suites that are
      // about something other than storage still stub their writes; the storage, backup, restore and
      // migration suites write real objects here.
      S3_ENDPOINT: "http://localhost:9020",
      S3_ACCESS_KEY_ID: "remit-test",
      S3_SECRET_ACCESS_KEY: "remit-test-secret",
      // A bucket of its own, never the developer's `remit`: a suite that truncates its database
      // between tests must not be able to touch real uploads.
      S3_BUCKET: "remit-test"
    }
  }
})
