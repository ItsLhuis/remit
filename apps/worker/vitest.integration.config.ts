import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },
  test: {
    include: ["**/*.integration.test.ts"],
    exclude: ["**/node_modules/**", "dist/**"],
    environment: "node",
    testTimeout: 30_000,
    // The variables `lib/config/env.ts` validates when the job modules load, pointed at the test
    // stack docker-compose.test.yml publishes, with the values that
    // apps/web/vitest.integration.config.ts gives them. Loading the modules opens no connection, so
    // nothing here is reached.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://remit_test:remit_test@localhost:5433/remit_test",
      REDIS_URL: "redis://localhost:6380",
      REMIT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      REMIT_DATA_DIR: ".tmp/integration-data",
      BETTER_AUTH_SECRET: "test-secret-for-integration-tests-not-real",
      REMIT_PUBLIC_URL: "http://localhost:3000",
      S3_ENDPOINT: "http://localhost:9020",
      S3_ACCESS_KEY_ID: "remit-test",
      S3_SECRET_ACCESS_KEY: "remit-test-secret",
      S3_BUCKET: "remit-test"
    }
  }
})
