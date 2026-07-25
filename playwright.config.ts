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
  // The projects are a dependency chain, not a parallel set: `auth` is the only spec that may run
  // against an instance with no owner yet (it registers one), `provision` finishes that owner's
  // TOTP enrolment so `proxy.ts` stops redirecting to /setup, and only then is the authenticated
  // dashboard the editor specs need reachable. On a local instance that already has a finished
  // owner both earlier projects no-op.
  projects: [
    {
      name: "auth",
      testMatch: /(auth|health)\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "provision",
      testMatch: /ownerProvision\.setup\.ts$/,
      dependencies: ["auth"],
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "editor",
      testMatch: /templateEditor.*\.spec\.ts$/,
      dependencies: ["provision"],
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
