// react-doctor configuration. Every entry traces to a justified finding in the audit report
// (.react-doctor/audit-report.md, sections 4 and 8). Plain object export (no defineConfig import)
// so the repo's tsc and eslint can both parse this file without resolving an un-installed
// `react-doctor/api` module (react-doctor is run via `pnpm dlx`, not a project dependency).
//
// Rule identifiers are FULLY QUALIFIED with their plugin prefix (react-doctor/* or deslop/*).
// react-doctor 0.5.8 only honors qualified names in ignore.overrides; bare names are silently
// ignored there. deslop owns unused-export, unused-dev-dependency, and circular-dependency.
const config = {
  ignore: {
    // Global classes — true for every file the rule fires on (see report 4.2).
    rules: [
      // Conflicts with enforced repo architecture (imports.md + featureBoundaryRule in
      // eslint.config.mjs): barrel imports are MANDATORY here, not a smell.
      "react-doctor/no-barrel-import",
      // Inline {renderField(...)} helpers are function calls, not <Component/> — no remount.
      // Established form-helper pattern; matches remit/helper-placement.
      "react-doctor/no-render-in-render",
      // .map().filter()/.flatMap micro-passes over tiny fixed config arrays; no real cost.
      "react-doctor/js-combine-iterations",
      // Style preference; repo forms use react-hook-form + discrete flags by design.
      "react-doctor/prefer-useReducer",
      // The repo's own ESLint max-lines ceiling is 500 (warn) and every flagged component is under
      // it — honor the team's chosen threshold instead of react-doctor's stricter default.
      "react-doctor/no-giant-component"
    ],
    files: [],
    overrides: [
      {
        // shadcn/design-system primitives. Several rules are structural false positives on these
        // stateless vendored primitives (components.md):
        // - only-export-components / no-multi-comp: cva variants + sub-components co-locate by design.
        // - js-flatmap-filter: micro-passes over tiny chart/config arrays, no measurable cost.
        // - prefer-tag-over-role: role= is load-bearing where no native tag fits (role="group" has
        //   no element; role="separator" wraps an Icon so <hr> can't apply; role="link"+aria-disabled).
        // - no-array-index-as-key: keys over static, non-reordering lists (skeleton rows, fixed
        //   thumbs, backup-code grid) where the index is stable.
        // - click-events-have-key-events: InputGroup's decorative click-to-focus; the input stays
        //   keyboard accessible (already eslint-disabled with the same rationale).
        // - anchor-has-content: Pagination's <a> receives aria-label/children via spread at each call.
        files: ["components/ui/**"],
        rules: [
          "react-doctor/only-export-components",
          "react-doctor/no-multi-comp",
          "react-doctor/js-flatmap-filter",
          "react-doctor/prefer-tag-over-role",
          "react-doctor/no-array-index-as-key",
          "react-doctor/click-events-have-key-events",
          "react-doctor/anchor-has-content"
        ]
      },
      {
        // useContext/forwardRef are not deprecated in React 19 (use()/ref-as-prop are additions, not
        // replacements); premature-migration advice on vendored shadcn primitives and the appearance
        // provider.
        files: ["components/ui/**", "providers/AppearanceProvider.tsx"],
        rules: ["react-doctor/no-react19-deprecated-apis"]
      },
      {
        // Pre-paint appearance/no-flash script must run synchronously before first paint;
        // next/script strategies run too late. Standard Next.js pattern.
        files: ["app/layout.tsx"],
        rules: ["react-doctor/nextjs-no-native-script"]
      },
      {
        // Residual circular dependencies after the relations() extraction into
        // database/schema/relations.ts. These are intentional MUTUAL FOREIGN KEYS declared with
        // Drizzle's AnyPgColumn forward-ref pattern, not relations() smells: auth <-> organizations
        // (better-auth-owned session.activeOrganizationId <-> member/invitation user FKs) and the
        // invoices <-> proposals <-> contracts trio (invoices.proposalId, proposals.convertedTo*).
        // They cannot be broken without dropping real FK constraints (a data-model + migration
        // change). ESLint's import/no-cycle does not scan database/, so this is doctor-only.
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
        // Operational-recovery scripts. tsup.scripts.config.ts only treats the 6 CLI entry files
        // (scripts/*.ts) as reachable roots, so the dead-code pass cannot see that scripts/core/**
        // helpers are consumed transitively from those roots and from colocated __tests__. Verified
        // reachable (e.g. writeArchive is imported by reencrypt, runBackup, and several tests).
        files: ["scripts/core/**"],
        rules: ["deslop/unused-export"]
      },
      {
        // Validity probe: new Intl.DateTimeFormat("en", { timeZone: value }) exists to throw on a
        // bad per-call timeZone in isValidTimeZone; it cannot be hoisted. (The real format.ts
        // formatters are a separate true-positive, handled outside this override.)
        files: ["features/settings/business/schemas.ts"],
        rules: ["react-doctor/js-hoist-intl"]
      },
      {
        // Dependent, ordered awaits: requireBusinessSettingsWrite() (auth gate) -> upsertSettings()
        // -> mirrorBusinessOrganization() (consumes the gate's headers). Promise.all would run the
        // writes before the auth check resolves.
        files: ["features/settings/business/mutations.ts"],
        rules: ["react-doctor/async-parallel"]
      },
      {
        // The awaited update runs inside a database.transaction; Drizzle transactions use a single
        // connection and must execute statements sequentially.
        files: ["features/tasks/mutations.ts"],
        rules: ["react-doctor/async-await-in-loop"]
      },
      {
        // Intentional JS-driven inline quick-add with local optimistic state in an authed dashboard;
        // e.preventDefault() is correct and progressive enhancement is a non-goal here.
        files: ["features/tasks/components/TaskBoardPage/TaskQuickAdd.tsx"],
        rules: ["react-doctor/no-prevent-default"]
      },
      {
        // Deliberate locally-editable optimistic copy seeded from the server prop and re-synced after
        // revalidatePath; removing the effect would discard local optimistic edits.
        files: [
          "features/settings/tax-rates/components/TaxRatesSettingsPage/TaxRatesSettingsForm.tsx"
        ],
        rules: ["react-doctor/no-mirror-prop-effect"]
      },
      {
        // Intentional derived-from-prop state, not stale mirrors:
        // - Fade: one-way mount latch for exit animations (unmountOnExit) — stays mounted until exit.
        // - LogoSection / InvoicingSettingsForm / TaskKanban: locally-editable optimistic copies
        //   seeded from a server prop and mutated by upload/save/drag handlers.
        files: [
          "components/ui/Fade.tsx",
          "features/settings/business/components/BusinessSettingsPage/LogoSection.tsx",
          "features/settings/invoicing/components/InvoicingSettingsPage/InvoicingSettingsForm.tsx",
          "features/tasks/components/TaskBoardPage/TaskKanban.tsx"
        ],
        rules: ["react-doctor/no-derived-useState"]
      },
      {
        // Effects reacting to EXTERNAL/UI state (focus, server row count), not faked event handlers:
        // Calendar focuses on the day-picker `focused` modifier, TaskQuickAdd focuses its input on
        // open, useDataTable snaps the page back into range when the server row count shrinks.
        files: [
          "components/ui/Calendar.tsx",
          "features/tasks/components/TaskBoardPage/TaskQuickAdd.tsx",
          "hooks/useDataTable.ts"
        ],
        rules: ["react-doctor/no-event-handler"]
      },
      {
        // Write-only prev-value tracking via useState. The useRef fix the rule suggests conflicts
        // with the enforced react-hooks/refs ESLint rule, so the useState pattern stands.
        files: [
          "components/ui/DataTable/DataTableRangeFilter.tsx",
          "features/tasks/components/TaskBoardPage/TaskKanban.tsx"
        ],
        rules: ["react-doctor/rerender-state-only-in-handlers"]
      },
      {
        // `empty`/render-prop JSX passed to DataTable, which is NOT wrapped in memo, so there is no
        // re-render cost — a true false positive of the memoized-child heuristic.
        files: [
          "features/clients/components/ClientsListPage/ClientsListPage.tsx",
          "features/leads/components/LeadsListPage/LeadsListPage.tsx",
          "features/projects/components/ClientProjectsPanel/ClientProjectsPanel.tsx",
          "features/projects/components/ProjectsListPage/ProjectsListPage.tsx"
        ],
        rules: ["react-doctor/jsx-no-jsx-as-prop"]
      },
      {
        // .flatMap().filter() micro-passes over tiny fixed schema option arrays; no measurable cost
        // (same class as the globally-ignored js-combine-iterations).
        files: ["features/*/schemas.ts"],
        rules: ["react-doctor/js-flatmap-filter"]
      },
      {
        // The cleanup reads timeoutRef.current on unmount precisely to clear the latest pending
        // timeout — the value the heuristic warns about is exactly the one we want. Correct pattern.
        files: ["hooks/useCopyWithFeedback.ts"],
        rules: ["react-doctor/exhaustive-deps"]
      },
      {
        // Intentional public surface re-exported through each feature's services/schemas barrels
        // (the dead-code pass does not follow barrel re-exports); also used in-file.
        files: [
          "features/clients/services/calculateOutstandingBalance.ts",
          "features/settings/business/schemas.ts",
          "features/settings/tax-rates/schemas.ts",
          "features/tasks/services/taskPosition.ts"
        ],
        rules: ["deslop/unused-export"]
      },
      {
        // recharts is ALREADY code-split: every consumer (ClientsSummaryBand, LeadsSummaryBand,
        // ProjectsSummaryBand, ClientWorkspace) loads these chart wrappers via
        // `dynamic(() => import("./charts"))`, so recharts never ships in an initial bundle. The
        // heuristic only sees the static `import ... from "recharts"` in the wrapper/primitive and
        // can't follow the consumer's next/dynamic call. The base Chart.tsx primitive is the
        // intentional synchronous seam (the wrappers do the lazy import).
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
        // The Intl formatters are already module-scope memoized via the dateTimeFormatters /
        // numberFormatters Maps (getDateTimeFormatter / getNumberFormatter). The `new Intl.*` calls
        // at lines 17/32 sit inside those cache guards; the heuristic flags the constructor without
        // seeing the surrounding Map cache. (business/schemas.ts is a separate validity-probe case.)
        files: ["lib/utils/format.ts"],
        rules: ["react-doctor/js-hoist-intl"]
      },
      {
        // pino-pretty is referenced as a runtime transport target string in lib/logger
        // (target: "pino-pretty"), resolved by name at runtime; the static pass cannot see it.
        files: ["package.json"],
        rules: ["deslop/unused-dev-dependency"]
      }
    ]
  },
  // Teaches the analyzer that these helpers are auth gates (they call auth.api.getSession and throw
  // on an unauthenticated/under-privileged session before any DB access). Clears 30 of 31
  // server-auth-actions errors. Verified against each feature's mutations.ts.
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
  // Kept for transparency; this repo's eslint.config.mjs is JS/ESM, not JSON, so react-doctor
  // almost certainly is NOT actually adopting it. Do not rely on dedupe.
  adoptExistingLintConfig: true
}

export default config
