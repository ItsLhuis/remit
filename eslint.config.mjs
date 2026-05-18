import { defineConfig, globalIgnores } from "eslint/config"

import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const featureBoundaryRule = [
  "error",
  {
    patterns: [
      {
        group: ["@/features/*/*", "!@/features/*/server"],
        message:
          "Import feature code through the feature root barrel (@/features/<feature>). Use relative imports within the same feature."
      }
    ]
  }
]

const pureServicesRule = [
  "error",
  {
    paths: [
      { name: "next", message: "Services must stay pure. Move Next.js usage out of services/." },
      { name: "react", message: "Services must stay pure. Move React usage out of services/." },
      {
        name: "drizzle-orm",
        message: "Services must stay pure. Move Drizzle usage out of services/."
      },
      {
        name: "@/database",
        message: "Services must stay pure. Move database access out of services/."
      }
    ],
    patterns: [
      {
        group: ["next/*"],
        message: "Services must stay pure. Move Next.js usage out of services/."
      },
      {
        group: ["drizzle-orm/*"],
        message: "Services must stay pure. Move Drizzle usage out of services/."
      },
      {
        group: ["@/database/*"],
        message: "Services must stay pure. Move database access out of services/."
      },
      {
        group: ["@/features/*/queries", "@/features/*/queries/*"],
        message: "Services must not depend on feature queries."
      },
      {
        group: ["@/features/*/mutations", "@/features/*/mutations/*"],
        message: "Services must not depend on feature mutations."
      }
    ]
  }
]

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["features/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": featureBoundaryRule
    }
  },
  {
    files: ["features/**/services/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": pureServicesRule
    }
  },
  globalIgnores([
    ".next/**",
    ".corepack/**",
    "coverage/**",
    "out/**",
    "build/**",
    "scripts/dist/**",
    "next-env.d.ts"
  ])
])

export default eslintConfig
