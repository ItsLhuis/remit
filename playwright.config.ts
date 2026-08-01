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
  // The web server is `next dev`, which compiles a route the first time a worker asks for it. With
  // several workers hitting the editor at once, that first-hit compile lands inside the test body,
  // so the default 30s budget expires on work that has nothing to do with the assertion.
  timeout: 60_000,
  reporter: process.env.CI ? ciReporter : undefined,
  use: {
    baseURL,
    // Radix portals (menus, dialogs, popovers) animate in and out, and an animating element never
    // satisfies Playwright's stability check. A click that finally lands mid-animation on an item
    // that unmounts itself - every context menu item - detaches the node inside the action, which
    // Playwright retries against a menu that has already closed. Reduced motion collapses those
    // animations through the `prefers-reduced-motion` block in `app/globals.css`.
    contextOptions: { reducedMotion: "reduce" }
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
      testMatch: /templateEditor(?!FrameContinuity).*\.spec\.ts$/,
      dependencies: ["provision"],
      use: { ...devices["Desktop Chrome"] }
    },
    // The frame-continuity spec measures requestAnimationFrame intervals, so a worker competing for
    // the same CPU shows up as a dropped-frame burst that has nothing to do with the editor. It runs
    // alone, after the parallel editor specs have finished.
    {
      name: "editor-perf",
      testMatch: /templateEditorFrameContinuity\.spec\.ts$/,
      dependencies: ["editor"],
      workers: 1,
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
