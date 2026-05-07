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
    testTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://remit_test:remit_test@localhost:5433/remit_test",
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
