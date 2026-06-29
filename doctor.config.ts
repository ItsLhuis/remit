// react-doctor configuration. Plain object export (not defineConfig) so the repo's tsc and eslint
// parse this file without resolving the un-installed `react-doctor/api` module — react-doctor runs
// via `pnpm dlx`, not as a dependency. Rule identifiers must be fully qualified with their plugin
// prefix (react-doctor/* or deslop/*); bare names are silently ignored in ignore.overrides.
const config = {
  ignore: {
    rules: [
      // Barrel imports are mandatory repo architecture (imports.md + featureBoundaryRule), not a smell.
      "react-doctor/no-barrel-import",
      // Unused exports and dependencies are owned by fallow (.fallowrc.json), which is entry-aware
      // (script roots, feature/lib barrels). deslop has no entry config and only false-positives here.
      "deslop/unused-export",
      "deslop/unused-dev-dependency"
    ],
    files: [],
    overrides: [
      {
        // Vendored shadcn primitives; structural false positives:
        // - only-export-components / no-multi-comp: cva variants and sub-components co-locate by design.
        // - js-combine-iterations: filter().map() chains that build JSX (recharts payload, country
        //   list); flatMap-with-conditional-array would obscure the JSX map.
        // - prefer-tag-over-role: role= is load-bearing where no native tag fits (role="group" has no
        //   element; role="separator" wraps an Icon so <hr> can't apply).
        // - click-events-have-key-events: InputGroup's decorative click-to-focus; the input stays
        //   keyboard accessible.
        files: ["components/ui/**"],
        rules: [
          "react-doctor/only-export-components",
          "react-doctor/no-multi-comp",
          "react-doctor/js-combine-iterations",
          "react-doctor/prefer-tag-over-role",
          "react-doctor/click-events-have-key-events"
        ]
      },
      {
        // Pagination ellipsis items are interchangeable, stateless placeholders with no stable domain
        // id; the array index is the correct key.
        files: ["components/ui/DataTable/DataTablePagination.tsx"],
        rules: ["react-doctor/no-array-index-as-key"]
      },
      {
        // useContext/forwardRef are not deprecated in React 19 (use()/ref-as-prop are additions, not
        // replacements); premature-migration advice on vendored shadcn primitives.
        files: ["components/ui/**"],
        rules: ["react-doctor/no-react19-deprecated-apis"]
      },
      {
        // Pre-paint no-flash appearance script must run synchronously before first paint; next/script
        // strategies run too late.
        files: ["app/layout.tsx"],
        rules: ["react-doctor/nextjs-no-native-script"]
      },
      {
        // Intentional mutual foreign keys declared with Drizzle's AnyPgColumn forward-ref pattern:
        // auth <-> organizations (session.activeOrganizationId <-> member/invitation user FKs) and the
        // invoices <-> proposals <-> contracts trio. Breaking the cycle means dropping real FK
        // constraints. ESLint's import/no-cycle does not scan database/.
        files: [
          "database/schema/auth.ts",
          "database/schema/organizations.ts",
          "database/schema/invoices.ts",
          "database/schema/proposals.ts",
          "database/schema/contracts.ts"
        ],
        rules: ["deslop/circular-dependency"]
      },
      {
        // Validity probe: isValidTimeZone constructs Intl.DateTimeFormat with the candidate timeZone
        // to throw on invalid input, so the constructor cannot be hoisted out of the function.
        files: ["features/settings/business/schemas.ts"],
        rules: ["react-doctor/js-hoist-intl"]
      },
      {
        // Ordered, dependent awaits: the auth gate must resolve before the writes, and the settings
        // write must complete before the organization mirror so a failed write never mirrors a stale
        // name. Promise.all would lose that ordering.
        files: ["features/settings/business/mutations.ts"],
        rules: ["react-doctor/async-parallel"]
      },
      {
        // JS-driven inline quick-add with local optimistic state in an authed dashboard;
        // e.preventDefault() is correct and progressive enhancement is a non-goal here.
        files: ["features/tasks/components/TaskBoardPage/TaskQuickAdd.tsx"],
        rules: ["react-doctor/no-prevent-default"]
      },
      {
        // Locally-editable optimistic copy seeded from the server prop and re-synced after
        // revalidatePath; removing the effect would discard local optimistic edits.
        files: [
          "features/settings/tax-rates/components/TaxRatesSettingsPage/TaxRatesSettingsForm.tsx"
        ],
        rules: ["react-doctor/no-mirror-prop-effect"]
      },
      {
        // Intentional derived-from-prop state:
        // - Fade: one-way mount latch for exit animations (stays mounted until exit).
        // - LogoSection / InvoicingSettingsForm / TaskKanban: optimistic copies seeded from a server
        //   prop and mutated by upload/save/drag handlers.
        files: [
          "components/ui/Fade.tsx",
          "features/settings/business/components/BusinessSettingsPage/LogoSection.tsx",
          "features/settings/invoicing/components/InvoicingSettingsPage/InvoicingSettingsForm.tsx",
          "features/tasks/components/TaskBoardPage/TaskKanban.tsx"
        ],
        rules: ["react-doctor/no-derived-useState"]
      },
      {
        // Effects reacting to external/UI state, not faked event handlers: Calendar focuses on the
        // day-picker focused modifier, TaskQuickAdd focuses its input on open, useDataTable snaps the
        // page back into range when the server row count shrinks.
        files: [
          "components/ui/Calendar.tsx",
          "features/tasks/components/TaskBoardPage/TaskQuickAdd.tsx",
          "hooks/useDataTable.ts"
        ],
        rules: ["react-doctor/no-event-handler"]
      },
      {
        // React's "adjust state when a prop changes during render" pattern: a prev-value tracker
        // compared in render that calls setState during render (no effect). The useRef rewrite the
        // rule suggests would not trigger the synchronous re-render of the dependent state.
        files: [
          "components/ui/DataTable/DataTableRangeFilter.tsx",
          "features/tasks/components/TaskBoardPage/TaskKanban.tsx"
        ],
        rules: ["react-doctor/rerender-state-only-in-handlers"]
      },
      {
        // Render-prop JSX passed to DataTable, which is not wrapped in memo, so there is no re-render
        // cost — a false positive of the memoized-child heuristic.
        files: [
          "features/clients/components/ClientsListPage/ClientsListPage.tsx",
          "features/leads/components/LeadsListPage/LeadsListPage.tsx",
          "features/projects/components/ClientProjectsPanel/ClientProjectsPanel.tsx",
          "features/projects/components/ProjectsListPage/ProjectsListPage.tsx"
        ],
        rules: ["react-doctor/jsx-no-jsx-as-prop"]
      },
      {
        // The cleanup reads timeoutRef.current on unmount precisely to clear the latest pending
        // timeout — the value the heuristic warns about is the intended one.
        files: ["hooks/useCopyWithFeedback.ts"],
        rules: ["react-doctor/exhaustive-deps"]
      },
      {
        // recharts is already code-split: every consumer loads these chart wrappers via
        // dynamic(() => import("./charts")), so recharts never ships in an initial bundle. The
        // heuristic only sees the static recharts import and cannot follow the consumer's next/dynamic.
        files: [
          "components/ui/Chart.tsx",
          "features/clients/components/ClientWorkspace/charts.tsx",
          "features/clients/components/ClientsListPage/HealthDonut.tsx",
          "features/clients/components/ClientsListPage/charts.tsx",
          "features/leads/components/LeadsListPage/charts.tsx",
          "features/projects/components/ProjectsListPage/charts.tsx"
        ],
        rules: ["react-doctor/prefer-dynamic-import"]
      },
      {
        // The Intl formatters are memoized at module scope via the dateTimeFormatters /
        // numberFormatters Maps; the new Intl.* calls sit inside those cache guards, which the
        // heuristic cannot see.
        files: ["lib/utils/format.ts"],
        rules: ["react-doctor/js-hoist-intl"]
      }
    ]
  },
  // Auth-gate helpers: each calls auth.api.getSession and throws on an unauthenticated or
  // under-privileged session before any DB access, so the server-action callers are protected.
  serverAuthFunctionNames: [
    "requireClientWrite",
    "requireClientDelete",
    "requireLeadWrite",
    "requireLeadDelete",
    "requireProjectWrite",
    "requireProjectDelete",
    "requireTaskWrite",
    "requireTaskDelete",
    "requireBusinessSettingsWrite",
    "requireEmailSettingsWrite",
    "requireInvoicingSettingsWrite",
    "requirePaymentSettingsWrite",
    "requireTaxRatesWrite"
  ],
  // The repo's eslint.config.mjs is JS/ESM, not JSON, so react-doctor does not actually adopt it; do
  // not rely on dedupe.
  adoptExistingLintConfig: true
}

export default config
