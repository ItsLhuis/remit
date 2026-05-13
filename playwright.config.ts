import { defineConfig, devices, type ReporterDescription } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100"

const useExternalServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "true"

const ciReporter: ReporterDescription[] = [
  ["html", { open: "never", outputFolder: "playwright-report" }],
  ["list"]
]

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "tests/e2e/results",
  reporter: process.env.CI ? ciReporter : undefined,
  use: {
    baseURL
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: useExternalServer
    ? undefined
    : {
        command: "pnpm exec next dev --turbopack --port 3100",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000
      }
})
