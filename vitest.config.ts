import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Half the host's cores, not Vitest's default of all-but-one. Each worker runs happy-dom, React
    // and user-event, so on a twelve-core host eleven of them oversubscribe it: the same suite took
    // 159s at the default and 139s at six, and the slowest test in
    // scripts/host/__tests__/install.test.ts — which spawns real `bash` — went from 6.4s to 4.4s,
    // which is the difference between failing the five-second budget and passing it.
    maxWorkers: "50%",
    projects: [
      "apps/*",
      "packages/*",
      // The repository's own tooling: the guidance checks under `tests/docs`, the custom lint rules
      // and git guard under `tools/`, the release scripts and the host scripts under `scripts/`.
      {
        extends: true,
        // `scripts/host/__tests__/install.test.ts` imports the web app's env schema through `@/`,
        // and so do that module's own imports. Each import resolves through the tsconfig.json that
        // owns its file, so the root one maps `@/*` for the test and `apps/web/tsconfig.json` maps
        // it inside the app.
        resolve: {
          tsconfigPaths: true
        },
        test: {
          name: "repository",
          include: [
            "tests/docs/**/*.{test,spec}.?(c|m)[jt]s?(x)",
            "tools/**/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)",
            "scripts/**/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)"
          ],
          environment: "node"
        }
      }
    ],
    coverage: {
      provider: "v8",
      include: [
        "apps/web/features/**",
        "apps/web/lib/**",
        "apps/web/hooks/**",
        "apps/web/scripts/core/**",
        "apps/worker/core/**",
        "packages/core/**/*.ts",
        "scripts/core/**"
      ],
      exclude: [
        "**/__tests__/**",
        "apps/web/components/ui/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/*.md"
      ],
      // Checked only by a coverage run: `pnpm test` never reads it. The unit-tests job in
      // .github/workflows/ci.yml runs `pnpm test:coverage` for exactly that reason.
      thresholds: {
        "apps/web/features/**/services/**": {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        }
      }
    }
  }
})
