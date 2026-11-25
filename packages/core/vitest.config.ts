import { defineProject } from "vitest/config"

export default defineProject({
  test: {
    name: "core",
    // Vitest reads `maxWorkers` per project, and projects that run together must agree on it or the
    // run refuses to start, so this restates the root vitest.config.ts value, which says why it is
    // half the host's cores.
    maxWorkers: "50%",
    include: ["**/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["**/node_modules/**"],
    environment: "node"
  }
})
