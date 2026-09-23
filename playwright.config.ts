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
  // Twice the default because `recurringGeneration.spec.ts` starts a real worker process and waits on
  // real jobs: 35s against a production build on a twelve-core host, where the default 30s expires
  // on process start-up rather than on anything asserted.
  timeout: 60_000,
  // Half the host's cores, pinned rather than left to Playwright's default so the ceiling is a
  // measured decision. Against a production build on a twelve-core host the suite was green at six
  // workers twice and at twelve three times. Its earlier starvation "above two workers" was `next
  // dev` compiling routes inside the tests, which failed the flows at every count down to two.
  workers: "50%",
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
    // The canonical money flow (.agents/rules/testing.md's flow 3) needs the same authenticated
    // owner the editor specs do, and nothing else, so it hangs off `provision` rather than off them.
    {
      name: "flows",
      testMatch: /timeToInvoice\.spec\.ts$/,
      dependencies: ["provision"],
      use: { ...devices["Desktop Chrome"] }
    },
    // The proposal flow points the instance's own email settings at the mail sink for the length of
    // the run, so it must not overlap anything that reads them: `auth.spec.ts` asserts the
    // unconfigured-instance branch of the login page and would silently skip itself if it saw a
    // configured provider. Running after `provision` puts it past that assertion.
    {
      name: "flows-email",
      testMatch: /proposalToPaid\.spec\.ts$/,
      dependencies: ["provision"],
      workers: 1,
      use: { ...devices["Desktop Chrome"] }
    },
    // The recurring-generation flow starts a real BullMQ worker in the Playwright process, which
    // consumes whatever else is on the shared queue while it runs. It therefore runs alone and after
    // the other flows, so a PDF render another spec enqueued cannot land in its worker and hold up
    // the shutdown that waits for in-flight jobs.
    {
      name: "flows-jobs",
      testMatch: /recurringGeneration\.spec\.ts$/,
      dependencies: ["flows"],
      workers: 1,
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
  // A production build, never `next dev`, which is what the E2E workflow runs against too. `next dev`
  // compiles each route the first time a test reaches it and serves development React, so the flows
  // spent their budget on compiles — the proposal flow timed out at 44–60s under it and passes in
  // 7s against a build — and the frame-continuity spec measured a development renderer. `next build`
  // writes `.next` while `next dev` writes `.next/dev`, so this can run beside a developer's own
  // `pnpm dev`. The five minutes cover the build: 100s on a twelve-core host.
  webServer: useExternalServer
    ? undefined
    : {
        command: "pnpm exec next build && pnpm exec next start --port 3100",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 300_000
      }
})
