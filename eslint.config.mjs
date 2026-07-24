import { defineConfig, globalIgnores } from "eslint/config"

import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

import tseslint from "typescript-eslint"

import importPlugin from "eslint-plugin-import"
import i18next from "eslint-plugin-i18next"
import perfectionist from "eslint-plugin-perfectionist"
import sonarjs from "eslint-plugin-sonarjs"

import remitRules from "./tools/eslint-rules/index.mjs"

import { readdirSync } from "node:fs"
import { createRequire } from "node:module"

const pkg = createRequire(import.meta.url)("./package.json")

// Each external npm origin (scope for @scope/x, bare package name otherwise) becomes its own
// perfectionist group, so imports from different packages sit in separate paragraphs while
// same-origin imports stay together. Generated from package.json so new dependencies are covered
// without editing this file. The form triad (@hookform/resolvers + react-hook-form) shares one
// paragraph per imports.md.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const externalOriginsHandledElsewhere = new Set([
  "react",
  "react-dom",
  "next",
  "@hookform",
  "react-hook-form"
])

const externalOrigins = [
  ...new Set(
    Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).map((name) => name.split("/")[0])
  )
]
  .filter((origin) => !externalOriginsHandledElsewhere.has(origin))
  .sort()

const externalOriginCustomGroups = externalOrigins.map((origin) => ({
  groupName: `external:${origin}`,
  elementNamePattern: origin.startsWith("@")
    ? `^${escapeRegex(origin)}/`
    : `^${escapeRegex(origin)}(/.*)?$`
}))

const formTriadGroup = {
  groupName: "external:form-triad",
  elementNamePattern: "^(@hookform/.+|react-hook-form)$"
}

// Ordered external tier: the form triad sorts at its scope position (@hookform), the rest
// alphabetically, then a catch-all "external" for anything not declared in package.json.
const externalTierGroups = [
  ...[
    { key: "@hookform", name: "external:form-triad" },
    ...externalOrigins.map((origin) => ({ key: origin, name: `external:${origin}` }))
  ]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((entry) => entry.name),
  "external"
]

// Each feature under features/ becomes its own perfectionist group, so imports from different
// features sit in separate paragraphs while same-feature imports (root barrel + /server) stay
// together. Generated from the features/ directory so new features are covered without editing
// this file.
const featureOrigins = readdirSync(new URL("./features", import.meta.url), { withFileTypes: true })
  .flatMap((entry) => (entry.isDirectory() ? [entry.name] : []))
  .sort()

const featureOriginCustomGroups = featureOrigins.map((name) => ({
  groupName: `features:${name}`,
  elementNamePattern: `^@/features/${escapeRegex(name)}(/.*)?$`
}))

const forbidInlineForwardedHeaderRule = [
  "error",
  {
    selector:
      "CallExpression[callee.property.name='get'][arguments.0.value=/^x-(forwarded-for|real-ip)$/i]",
    message:
      "Do not parse forwarded headers inline. Use getIpAddress(headers) from @/lib/utils (see security.md)."
  }
]

const importOrderRule = [
  "error",
  {
    type: "natural",
    order: "asc",
    newlinesBetween: 1,
    internalPattern: ["^@/"],
    customGroups: [
      { groupName: "react", elementNamePattern: "^react(-dom)?(/.*)?$" },
      { groupName: "next-cache", elementNamePattern: "^next/cache$" },
      { groupName: "next-headers", elementNamePattern: "^next/headers$" },
      { groupName: "next-navigation", elementNamePattern: "^next/navigation$" },
      { groupName: "next-other", elementNamePattern: "^next(/.*)?$" },
      { groupName: "i18n", elementNamePattern: "^@/lib/i18n(/.*)?$" },
      { groupName: "lib-auth", elementNamePattern: "^@/lib/auth(/.*)?$" },
      { groupName: "lib-audit", elementNamePattern: "^@/lib/audit(/.*)?$" },
      { groupName: "lib-events", elementNamePattern: "^@/lib/events(/.*)?$" },
      { groupName: "lib-logger", elementNamePattern: "^@/lib/logger(/.*)?$" },
      { groupName: "lib-utils", elementNamePattern: "^@/lib/utils(/.*)?$" },
      { groupName: "lib-other", elementNamePattern: "^@/lib/.*" },
      { groupName: "database", elementNamePattern: "^@/database(/.*)?$" },
      { groupName: "components-ui", elementNamePattern: "^@/components/ui(/.*)?$" },
      { groupName: "components-layout", elementNamePattern: "^@/components/layout(/.*)?$" },
      { groupName: "components-other", elementNamePattern: "^@/components(/.*)?$" },
      ...featureOriginCustomGroups,
      { groupName: "features", elementNamePattern: "^@/features(/.*)?$" },
      { groupName: "hooks", elementNamePattern: "^@/hooks(/.*)?$" },
      { groupName: "providers", elementNamePattern: "^@/providers(/.*)?$" },
      formTriadGroup,
      ...externalOriginCustomGroups
    ],
    groups: [
      "react",
      "next-cache",
      "next-headers",
      "next-navigation",
      "next-other",
      "builtin",
      ...externalTierGroups,
      "i18n",
      "lib-auth",
      "lib-audit",
      "lib-events",
      "lib-logger",
      "lib-utils",
      "lib-other",
      "database",
      "components-ui",
      "components-layout",
      "components-other",
      ...featureOrigins.map((name) => `features:${name}`),
      "features",
      "hooks",
      "providers",
      "internal",
      "parent",
      ["sibling", "index"],
      "side-effect",
      "unknown"
    ]
  }
]

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
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      perfectionist
    },
    rules: {
      "@typescript-eslint/no-deprecated": "warn",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports", disallowTypeAnnotations: false }
      ],
      "@typescript-eslint/consistent-type-exports": [
        "error",
        { fixMixedExportsWithInlineTypeSpecifier: true }
      ],
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true
        }
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "warn",
      "perfectionist/sort-imports": importOrderRule,
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "directive", next: "*" },
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "any", prev: "import", next: "import" }
      ]
    }
  },
  {
    files: [
      "features/**/*.{ts,tsx}",
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "providers/**/*.{ts,tsx}"
    ],
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } }
      ],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "no-console": "error",
      "no-restricted-syntax": forbidInlineForwardedHeaderRule,
      "max-params": ["warn", 4],
      "max-lines": ["warn", { max: 500, skipBlankLines: true, skipComments: true }]
    }
  },
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
  {
    files: [
      "features/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "providers/**/*.{ts,tsx}"
    ],
    plugins: {
      import: importPlugin
    },
    rules: {
      // import/no-cycle is NOT here: it costs ~315s of a ~375s ESLint run because it walks the
      // whole module graph per file. The identical check runs in oxlint (.oxlintrc.json) in ~1s
      // with the same options (ignoreExternal, ignoreTypes matching this plugin's type-import
      // behavior). `pnpm lint` runs both; do not re-add it here.
      "import/no-default-export": "error",
      "import/no-duplicates": "error"
    }
  },
  {
    files: [
      "features/**/*.{ts,tsx}",
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "providers/**/*.{ts,tsx}"
    ],
    plugins: {
      sonarjs
    },
    rules: {
      "sonarjs/cognitive-complexity": ["warn", 15],
      "sonarjs/no-identical-functions": "warn"
    }
  },
  {
    files: [
      "features/**/*.tsx",
      "app/**/*.tsx",
      "components/**/*.tsx",
      "hooks/**/*.tsx",
      "providers/**/*.tsx"
    ],
    ignores: ["**/__tests__/**", "**/*.test.tsx"],
    plugins: {
      i18next
    },
    rules: {
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/mouse-events-have-key-events": "warn",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/tabindex-no-positive": "warn",
      "jsx-a11y/img-redundant-alt": "warn",
      "i18next/no-literal-string": ["warn", { mode: "jsx-text-only" }]
    }
  },
  {
    files: ["lib/i18n/locales/**/*.{ts,tsx}", "lib/i18n/types.ts", "components/ui/**/*.{ts,tsx}"],
    rules: {
      "max-lines": "off"
    }
  },
  {
    files: ["lib/utils/request.ts"],
    rules: {
      "no-restricted-syntax": "off"
    }
  },
  {
    files: ["components/**/index.ts", "features/**/components/**/index.ts"],
    rules: {
      "perfectionist/sort-exports": ["error", { type: "natural", order: "asc" }]
    }
  },
  {
    files: ["**/*.tsx"],
    plugins: {
      remit: remitRules
    },
    rules: {
      "remit/helper-placement": "error",
      "remit/no-blank-lines-in-jsx-return": "error"
    }
  },
  {
    // Vitest unit/integration tests only — Playwright e2e (tests/e2e) legitimately uses test.skip
    // for conditional skips, so it is excluded.
    files: ["**/*.{test,spec}.{ts,tsx}"],
    ignores: ["tests/e2e/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name=/^(describe|test|it|suite|bench)$/][callee.property.name=/^(only|skip)$/]",
          message:
            "Do not commit focused or skipped tests (.only/.skip). Remove the modifier before committing (see testing.md)."
        }
      ]
    }
  },
  {
    files: ["features/**/mutations.ts", "features/**/queries.ts", "app/**/route.ts"],
    plugins: {
      remit: remitRules
    },
    rules: {
      "remit/validate-before-io": "error"
    }
  },
  {
    files: ["features/**/components/**/*.{ts,tsx}"],
    plugins: {
      remit: remitRules
    },
    rules: {
      "remit/no-hook-in-components": "error"
    }
  },
  {
    files: ["hooks/**/*.{ts,tsx}", "features/**/hooks/**/*.{ts,tsx}"],
    plugins: {
      remit: remitRules
    },
    rules: {
      "remit/hook-file-exports-its-hook": "error"
    }
  },
  globalIgnores([
    ".next/**",
    ".cache/**",
    ".corepack/**",
    ".agents/**",
    ".claude/**",
    ".github/**",
    ".impeccable/**",
    "coverage/**",
    "out/**",
    "build/**",
    "scripts/dist/**",
    "next-env.d.ts"
  ])
])

export default eslintConfig
