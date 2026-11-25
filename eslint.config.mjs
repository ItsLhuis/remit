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

const require = createRequire(import.meta.url)
const manifests = [
  require("./package.json"),
  require("./apps/web/package.json"),
  require("./apps/worker/package.json")
]

// React is a dependency of `apps/web` only, so the plugin's "detect", which resolves `react` from the
// working directory, finds nothing at the workspace root. The version is read where it is installed.
const reactVersion = createRequire(new URL("./apps/web/package.json", import.meta.url))(
  "react/package.json"
).version

// Each external npm origin (scope for @scope/x, bare package name otherwise) becomes its own
// perfectionist group, so imports from different packages sit in separate paragraphs while
// same-origin imports stay together. Generated from the workspace's package.json files so new
// dependencies are covered without editing this file. The form triad (@hookform/resolvers +
// react-hook-form) shares one paragraph per imports.md.
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
    manifests
      .flatMap((manifest) => Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }))
      .map((name) => name.split("/")[0])
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
// together. Generated from the apps/web/features/ directory so new features are covered without
// editing this file.
const featureOrigins = readdirSync(new URL("./apps/web/features", import.meta.url), {
  withFileTypes: true
})
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
      { groupName: "remit-core", elementNamePattern: "^@remit/core$" },
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
      "remit-core",
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

// `systemWrites` is a second sanctioned cross-feature door, and it exists because `server.ts` cannot
// serve the background worker: that barrel re-exports the feature's `"use server"` actions, which
// pull `next/headers` and `next/cache` into whatever imports it. Those resolve inside Next and fail
// outright in the standalone worker process. A `systemWrites` module is the session-free
// write path — plain async functions, no request context — so a job may import it directly.
//
// `services` is the third, for a pure domain rule: a pure module reaches no component, no `"use
// server"` module and no other feature's server graph, so importing one can never close a cycle that
// the root or server barrel would. `services/` files already import each other this way under
// `pureServicesRule`, which replaces this rule for them.
const featureBoundaryRule = [
  "error",
  {
    patterns: [
      {
        group: [
          "@/features/*/*",
          "!@/features/*/server",
          "!@/features/*/systemWrites",
          "!@/features/*/services"
        ],
        message:
          "Import feature code through the feature root barrel (@/features/<feature>), its server barrel, its systemWrites module or its services barrel. Use relative imports within the same feature."
      },
      // Carried by the boundary rule because it applies to the same files: the reporter's callers
      // are the two boundaries in `instrumentation.ts` and `lib/jobs/worker.ts`, and a
      // capture call in a feature is the second, rule-less error path `errors.md` forbids.
      {
        group: ["@/lib/errorTracking", "@/lib/errorTracking/*"],
        message:
          "Features and routes do not report errors. Let the failure escape to a request or job boundary, or catch and log it (.agents/rules/errors.md, Reported versus logged)."
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

// `packages/core` runs wherever its callers do: the browser, the Next.js server, the worker bundle and
// a unit test. So it imports no framework, database driver, IO module or application code, and reads
// no process or DOM state; its callers pass everything in. The Node built-ins listed are the ones
// that reach a file, the network, a process or the host, in either spelling (`fs`, `node:fs`).
const nodeIoModules = [
  "child_process",
  "cluster",
  "dgram",
  "dns",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "net",
  "os",
  "process",
  "readline",
  "repl",
  "tls",
  "tty",
  "worker_threads"
]

const appPackageNames = manifests
  .map((manifest) => manifest.name)
  .filter((name) => name.startsWith("@remit/"))

const coreForbiddenImportPattern = new RegExp(
  [
    `^(${["next", "react", "react-dom", "drizzle-orm", "postgres", ...appPackageNames].map(escapeRegex).join("|")})(/|$)`,
    `^(node:)?(${nodeIoModules.join("|")})(/|$)`,
    "^@/",
    /^(\.\.\/)+apps\//.source
  ].join("|")
)

const pureCoreImportRule = [
  "error",
  {
    patterns: [
      {
        regex: coreForbiddenImportPattern.source,
        message:
          "packages/core stays pure: no framework, database, IO or application import (.agents/rules/architecture.md, packages/core)."
      }
    ]
  }
]

const pureCoreGlobalsRule = [
  "error",
  {
    name: "process",
    message: "packages/core reads no environment or process state. Take the value as an argument."
  },
  {
    name: "document",
    message: "packages/core touches no DOM. Keep DOM work in apps/web."
  }
]

// The worker reaches `apps/web` only through the `@remit/web` exports map. `pnpm typecheck` rejects
// an `@remit/web/...` path the map does not name, but it accepts `@/`, which
// apps/worker/tsconfig.json maps for the web modules it checks, and a relative path into apps/web,
// which needs no mapping. These two rules reject `@/` and a `../`-prefixed path into apps/web, not
// every relative spelling of one: `no-restricted-imports` for static imports and re-exports, and
// selectors for `import()`, which that rule never inspects and through which the worker loads
// nearly all of its web code.
const webDeepImportPattern = /^(@\/|(\.\.\/)+(apps\/)?web\/)/

const webDeepImportMessage =
  "Import web code through an @remit/web export (apps/web/package.json), never through @/ or a relative path."

const forbidWebDeepImportRule = [
  "error",
  { patterns: [{ regex: webDeepImportPattern.source, message: webDeepImportMessage }] }
]

const forbidDynamicWebDeepImportSelectors = [
  {
    selector: `ImportExpression[source.value=${webDeepImportPattern}]`,
    message: webDeepImportMessage
  },
  {
    selector: `ImportExpression[source.quasis.0.value.cooked=${webDeepImportPattern}]`,
    message: webDeepImportMessage
  }
]

const forbidFocusedTestsSelector = {
  selector:
    "CallExpression[callee.object.name=/^(describe|test|it|suite|bench)$/][callee.property.name=/^(only|skip)$/]",
  message:
    "Do not commit focused or skipped tests (.only/.skip). Remove the modifier before committing (see testing.md)."
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: {
      react: { version: reactVersion },
      next: { rootDir: "apps/web/" }
    }
  },
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
      "@typescript-eslint/no-deprecated": "error",
      // `nextVitals` enables these six at `warn`; restated here so the whole `jsx-a11y/*` category
      // fails the build, like the ten the component block below adds (`accessibility.md`).
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
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
      "@typescript-eslint/switch-exhaustiveness-check": "error",
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
      "apps/web/features/**/*.{ts,tsx}",
      "apps/web/app/**/*.{ts,tsx}",
      "apps/web/components/**/*.{ts,tsx}",
      "apps/web/hooks/**/*.{ts,tsx}",
      "apps/web/lib/**/*.{ts,tsx}",
      "apps/web/providers/**/*.{ts,tsx}",
      "packages/core/**/*.ts"
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
    files: ["apps/web/features/**/*.{ts,tsx}", "apps/web/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": featureBoundaryRule
    }
  },
  {
    files: ["apps/web/features/**/services/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": pureServicesRule
    }
  },
  {
    // Tests are left out: they run only under Vitest in Node, and one pins the process time zone
    // (packages/core/__tests__/format.test.ts).
    files: ["packages/core/**/*.ts"],
    ignores: ["packages/core/**/__tests__/**"],
    rules: {
      "no-restricted-imports": pureCoreImportRule,
      "no-restricted-globals": pureCoreGlobalsRule
    }
  },
  {
    files: ["apps/worker/**/*.ts"],
    rules: {
      "no-restricted-imports": forbidWebDeepImportRule,
      "no-restricted-syntax": ["error", ...forbidDynamicWebDeepImportSelectors]
    }
  },
  {
    files: [
      "apps/web/features/**/*.{ts,tsx}",
      "apps/web/components/**/*.{ts,tsx}",
      "apps/web/hooks/**/*.{ts,tsx}",
      "apps/web/lib/**/*.{ts,tsx}",
      "apps/web/providers/**/*.{ts,tsx}",
      "packages/core/**/*.ts"
    ],
    ignores: ["packages/core/vitest.config.ts"],
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
      "apps/web/features/**/*.{ts,tsx}",
      "apps/web/app/**/*.{ts,tsx}",
      "apps/web/components/**/*.{ts,tsx}",
      "apps/web/hooks/**/*.{ts,tsx}",
      "apps/web/lib/**/*.{ts,tsx}",
      "apps/web/providers/**/*.{ts,tsx}",
      "packages/core/**/*.ts"
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
      "apps/web/features/**/*.tsx",
      "apps/web/app/**/*.tsx",
      "apps/web/components/**/*.tsx",
      "apps/web/hooks/**/*.tsx",
      "apps/web/providers/**/*.tsx"
    ],
    ignores: ["**/__tests__/**", "**/*.test.tsx"],
    plugins: {
      i18next
    },
    rules: {
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/mouse-events-have-key-events": "error",
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/tabindex-no-positive": "error",
      "jsx-a11y/img-redundant-alt": "error",
      "i18next/no-literal-string": ["error", { mode: "jsx-text-only" }]
    }
  },
  {
    files: [
      "apps/web/lib/i18n/locales/**/*.{ts,tsx}",
      "apps/web/lib/i18n/types.ts",
      "apps/web/components/ui/**/*.{ts,tsx}"
    ],
    rules: {
      "max-lines": "off"
    }
  },
  {
    files: ["apps/web/lib/utils/request.ts"],
    rules: {
      "no-restricted-syntax": "off"
    }
  },
  {
    files: ["apps/web/components/**/index.ts", "apps/web/features/**/components/**/index.ts"],
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
    // Vitest unit/integration tests only — Playwright e2e (apps/web/tests/e2e) legitimately uses
    // test.skip for conditional skips, so it is excluded.
    files: ["**/*.{test,spec}.{ts,tsx}"],
    ignores: ["apps/web/tests/e2e/**"],
    rules: {
      "no-restricted-syntax": ["error", forbidFocusedTestsSelector]
    }
  },
  {
    // A later `no-restricted-syntax` replaces an earlier one rather than adding to it, so without
    // this block the test block above would drop the worker's `import()` selectors from its tests.
    files: ["apps/worker/**/*.{test,spec}.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        forbidFocusedTestsSelector,
        ...forbidDynamicWebDeepImportSelectors
      ]
    }
  },
  {
    // `public*.ts` covers the anonymous read/write modules a `/{letter}/[token]` surface owns
    // (`features/proposals/publicQueries.ts`, `publicResponse.ts`). They are not named
    // `queries.ts`/`mutations.ts` because they answer to a different contract, but they take
    // untrusted input from a public route and must clear the same guard. `*Mutations.ts` covers the
    // concern-named siblings a large `mutations.ts` splits into (`actions.md`), which are the same
    // server actions under another name.
    files: [
      "apps/web/features/**/mutations.ts",
      "apps/web/features/**/*Mutations.ts",
      "apps/web/features/**/queries.ts",
      "apps/web/features/**/public*.ts",
      "apps/web/app/**/route.ts"
    ],
    plugins: {
      remit: remitRules
    },
    rules: {
      "remit/validate-before-io": "error"
    }
  },
  {
    files: ["apps/web/features/**/components/**/*.{ts,tsx}"],
    plugins: {
      remit: remitRules
    },
    rules: {
      "remit/no-hook-in-components": "error",
      "remit/no-unnamed-use-watch": "error"
    }
  },
  {
    files: ["apps/web/hooks/**/*.{ts,tsx}", "apps/web/features/**/hooks/**/*.{ts,tsx}"],
    plugins: {
      remit: remitRules
    },
    rules: {
      "remit/hook-file-exports-its-hook": "error"
    }
  },
  globalIgnores([
    "**/.next/**",
    ".cache/**",
    ".corepack/**",
    ".agents/**",
    ".claude/**",
    ".github/**",
    ".impeccable/**",
    "coverage/**",
    "out/**",
    "build/**",
    "**/scripts/dist/**",
    "apps/worker/dist/**",
    "**/next-env.d.ts"
  ])
])

export default eslintConfig
