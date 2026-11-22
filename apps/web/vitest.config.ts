import { fileURLToPath } from "url"

import { defineProject } from "vitest/config"

// The `node` and `happy-dom` projects partition `apps/web` by environment, so the `node` project's
// `include` and the `happy-dom` project's `exclude` have to stay exact complements: a `__tests__`
// root added to one and not the other either runs twice, once per environment, or stops running at
// all.
const nodeTests = [
  "features/**/services/__tests__/**",
  "lib/**/__tests__/**",
  "hooks/__tests__/**",
  "scripts/core/**/__tests__/**"
]

export default defineProject({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url))
    }
  },
  test: {
    name: "web",
    // Vitest reads `maxWorkers` per project, and projects that run together must agree on it or the
    // run refuses to start, so this restates the root vitest.config.ts value, which says why it is
    // half the host's cores.
    maxWorkers: "50%",
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: nodeTests.map((pattern) => `${pattern}/*.{test,spec}.?(c|m)[jt]s?(x)`),
          exclude: ["**/*.integration.test.ts", "**/node_modules/**"],
          environment: "node",
          setupFiles: ["tests/setup.ts"]
        }
      },
      {
        extends: true,
        test: {
          name: "happy-dom",
          include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)"],
          exclude: [
            ...nodeTests,
            "**/*.integration.test.ts",
            "tests/e2e/**",
            "**/node_modules/**",
            "**/.next/**"
          ],
          environment: "happy-dom",
          setupFiles: ["tests/setup.ts"]
        }
      }
    ]
  }
})
