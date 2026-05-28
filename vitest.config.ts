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
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: [
            "features/**/services/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)",
            "lib/**/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)",
            "hooks/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)",
            "scripts/core/**/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)"
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
