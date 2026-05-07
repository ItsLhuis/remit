import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "tests/e2e/results",
  use: {
    baseURL: "http://localhost:3100"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: "pnpm exec next dev --turbopack --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000
  }
})
