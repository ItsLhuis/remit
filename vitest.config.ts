import { fileURLToPath } from "url"

import { defineConfig } from "vitest/config"

// The `node` and `happy-dom` projects partition `apps/web` by environment, so the `node` project's
// `include` and the `happy-dom` project's `exclude` have to stay exact complements: a `__tests__`
// root added to one and not the other either runs twice, once per environment, or stops running at
// all.
const webNodeTests = [
  "features/**/services/__tests__/**",
  "lib/**/__tests__/**",
  "hooks/__tests__/**",
  "scripts/core/**/__tests__/**"
]

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/web", import.meta.url))
    }
  },
  test: {
    // Half the host's cores, not Vitest's default of all-but-one. Each worker runs happy-dom, React
    // and user-event, so on a twelve-core host eleven of them oversubscribe it: the same suite took
    // 159s at the default and 139s at six, and the slowest test in
    // scripts/host/__tests__/install.test.ts — which spawns real `bash` — went from 6.4s to 4.4s,
    // which is the difference between failing the five-second budget and passing it.
    maxWorkers: "50%",
    projects: [
      {
        extends: true,
        test: {
          name: "web:node",
          root: "apps/web",
          include: webNodeTests.map((pattern) => `${pattern}/*.{test,spec}.?(c|m)[jt]s?(x)`),
          exclude: ["**/*.integration.test.ts", "**/node_modules/**"],
          environment: "node",
          setupFiles: ["tests/setup.ts"]
        }
      },
      {
        extends: true,
        test: {
          name: "web:happy-dom",
          root: "apps/web",
          include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)"],
          exclude: [
            ...webNodeTests,
            "**/*.integration.test.ts",
            "tests/e2e/**",
            "**/node_modules/**"
          ],
          environment: "happy-dom",
          setupFiles: ["tests/setup.ts"]
        }
      },
      // The repository's own tooling: the guidance checks under `tests/docs`, the custom lint rules
      // and git guard under `tools/`, the release scripts and the host scripts under `scripts/`.
      {
        extends: true,
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
        "apps/web/scripts/core/**"
      ],
      exclude: ["**/__tests__/**", "apps/web/components/ui/**", "**/*.d.ts", "**/*.config.*"],
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
