import { fileURLToPath } from "url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url))
    }
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["tests/setup.ts"],
    // Half the host's cores, not Vitest's default of all-but-one. Each worker runs happy-dom, React
    // and user-event, so on a twelve-core host eleven of them oversubscribe it: the same suite took
    // 159s at the default and 139s at six, and the slowest test in
    // scripts/host/__tests__/install.test.ts — which spawns real `bash` — went from 6.4s to 4.4s,
    // which is the difference between failing the five-second budget and passing it.
    maxWorkers: "50%",
    // The two projects partition the suite by environment, so the `node` project's `include` and
    // the `happy-dom` project's `exclude` have to stay exact complements: a `__tests__` root added
    // to one and not the other either runs twice, once per environment, or stops running at all.
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: [
            "features/**/services/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)",
            "lib/**/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)",
            "hooks/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)",
            "scripts/core/**/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)",
            "scripts/host/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)"
          ],
          exclude: ["**/*.integration.test.ts"],
          environment: "node"
        }
      },
      {
        extends: true,
        test: {
          name: "happy-dom",
          include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)"],
          exclude: [
            "features/**/services/__tests__/**",
            "lib/**/__tests__/**",
            "hooks/__tests__/**",
            "scripts/core/**/__tests__/**",
            "scripts/host/__tests__/**",
            "**/*.integration.test.ts",
            "tests/e2e/**",
            "**/node_modules/**"
          ],
          environment: "happy-dom"
        }
      }
    ],
    coverage: {
      provider: "v8",
      include: ["features/**", "lib/**", "hooks/**", "scripts/core/**"],
      exclude: ["**/__tests__/**", "components/ui/**", "**/*.d.ts", "**/*.config.*"],
      thresholds: {
        "features/**/services/**": {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        }
      }
    }
  }
})
