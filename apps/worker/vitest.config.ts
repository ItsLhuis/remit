import { defineProject } from "vitest/config"

export default defineProject({
  // The `@remit/web` modules a test reaches import each other through `@/`, which each file's own
  // tsconfig.json maps: apps/web/tsconfig.json for the web modules.
  resolve: {
    tsconfigPaths: true
  },
  test: {
    name: "worker",
    // Vitest reads `maxWorkers` per project, and projects that run together must agree on it or the
    // run refuses to start, so this restates the root vitest.config.ts value, which says why it is
    // half the host's cores.
    maxWorkers: "50%",
    include: ["**/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["**/*.integration.test.ts", "**/node_modules/**", "dist/**"],
    environment: "node"
  }
})
