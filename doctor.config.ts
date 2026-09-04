// react-doctor configuration. Plain object export (not defineConfig) so the repo's tsc and eslint
// parse this file without resolving the un-installed `react-doctor/api` module — react-doctor runs
// via `pnpm dlx`, not as a dependency. Rule identifiers must be fully qualified with their plugin
// prefix (react-doctor/* or deslop/*); bare names are silently ignored in ignore.overrides.
const config = {
  ignore: {
    rules: [
      // Barrel imports are mandatory repo architecture (imports.md + featureBoundaryRule), not a smell.
      "react-doctor/no-barrel-import",
      // Unused exports are owned by fallow (.fallowrc.json), which is entry-aware; deslop has no
      // entry config, so script entrypoints read as dead. Verified: of the 4 deslop reports, 3 are
      // `scripts/*.ts` roots fallow declares as entry points and the 4th sits inside the 65-export
      // backlog fallow already tracks at `warn`.
      "deslop/unused-export"
    ],
    files: [],
    overrides: [
      {
        // The two awaits are sequential on purpose: `hasAlreadySent` is a guard, and loading a PDF
        // out of object storage before knowing whether the mail is a duplicate would read bytes the
        // send then discards. Parallelising them would defeat the deduplication this file exists to
        // guarantee.
        files: ["features/email/documentEmail.ts"],
        rules: ["react-doctor/server-sequential-independent-await"]
      },
      {
        // `transition-all` is the design system's own idiom, applied in the shared cva bases
        // (buttonVariants, sidebarMenuButtonVariants, …) and inherited by every consumer. Naming
        // properties per call site cannot be done without dropping animations the UI ships today.
        files: ["components/ui/**", "components/layout/**"],
        rules: ["react-doctor/no-transition-all"]
      },
      {
        // cva variant constants co-locate with the component they style; buttonVariants and
        // toggleVariants have real cross-primitive consumers (Calendar, Choicebox, ToggleGroup),
        // and Sonner re-exports `toast` beside the Toaster it configures.
        files: ["components/ui/Button.tsx", "components/ui/Toggle.tsx", "components/ui/Sonner.tsx"],
        rules: ["react-doctor/only-export-components"]
      },
      {
        // filter().map() chains that build JSX over bounded lists (recharts payload items, the
        // country list). The single-pass flatMap/reduce rewrite the rule wants inlines the JSX into
        // an array literal and obscures the markup.
        files: ["components/ui/Chart.tsx", "components/ui/CountrySelect.tsx"],
        rules: ["react-doctor/js-combine-iterations"]
      },
      {
        // recharts is already code-split: every consumer loads these modules through
        // dynamic(() => import("./charts")), so recharts never ships in an initial bundle. The
        // heuristic sees the static recharts import and cannot follow the consumer's next/dynamic.
        files: [
          "components/ui/Chart.tsx",
          "features/*/components/*/charts.tsx",
          "features/clients/components/ClientsListPage/HealthDonut.tsx"
        ],
        rules: ["react-doctor/prefer-dynamic-import"]
      },
      {
        // next/image cannot serve these: `images.remotePatterns` is resolved at BUILD time, but the
        // MinIO/S3 endpoint of a self-hosted Remit is a per-instance RUNTIME env var, so the hosts
        // cannot be enumerated when the image is built. A `hostname: "**"` pattern would "work"
        // only by disabling the SSRF protection remotePatterns exists for, and would route
        // instance-local assets through the optimizer for no gain. The adjacent line at both call
        // sites is already owned by `@next/next/no-img-element` for the same reason.
        files: [
          "features/templates/components/TemplateEditorPage/ImageBlockField.tsx",
          "features/templates/components/TemplateEditorPage/PropertyPanel/BlockContentSection.tsx"
        ],
        rules: ["react-doctor/nextjs-no-img-element"]
      },
      {
        // The sequencing is the point, not an oversight. A sweep that fanned its enqueues out with
        // Promise.all would open one Redis command per due row at once, and the two scheduler loops
        // reconcile a three-entry list at boot where concurrency buys nothing. Serial also keeps the
        // per-entity failure isolated: one bad row logs and the loop continues, which is what makes
        // a sweep safe to retry (ADR-0023).
        files: ["lib/jobs/schedules.ts", "features/*/jobs.ts"],
        rules: ["react-doctor/async-await-in-loop"]
      },
      {
        // A zip is a byte stream: every local header, payload and central-directory record has to
        // reach the output in order, and each `await` is a backpressure pause on that stream. Running
        // the writes concurrently would interleave the bytes and produce an archive no reader can
        // open, so the loop is the format, not a missed parallelisation.
        files: ["lib/archive/zip.ts"],
        rules: ["react-doctor/async-await-in-loop"]
      },
      {
        // Deliberate hook keys, argued at both call sites and already eslint-disabled inline for
        // react-hooks: CanvasBlock keys its HTML memo on the content/style/type the renderer reads
        // so a block reuses its HTML across gesture frames, and CanvasTextEditor seeds the inline
        // editor exactly once on mount. Both diagnostics anchor inside the dependency array, which
        // a chain-adjacent comment cannot reach.
        files: [
          "features/templates/components/TemplateEditorPage/CanvasBlock.tsx",
          "features/templates/components/TemplateEditorPage/CanvasTextEditor.tsx"
        ],
        rules: ["react-doctor/exhaustive-deps"]
      }
    ]
  },
  // Auth-gate helpers: each resolves the session and returns `{ error }` on an unauthenticated or
  // under-privileged session before any DB access, so the server-action callers are protected.
  serverAuthFunctionNames: [
    "requireClientWrite",
    "requireClientDelete",
    "requireClientPortalLink",
    "requireAttachmentWrite",
    "requireLeadWrite",
    "requireLeadDelete",
    "requireProjectWrite",
    "requireProjectDelete",
    "requireTaskWrite",
    "requireTaskDelete",
    "requireTimeEntryWrite",
    "requireTimeEntryDelete",
    "requireExpenseWrite",
    "requireExpenseDelete",
    "requireExpenseExport",
    "requireTemplateWrite",
    "requireTemplateDelete",
    "requireProposalWrite",
    "requireProposalSend",
    "requireProposalDelete",
    "requireProposalPublicLink",
    "requireContractWrite",
    "requireContractSend",
    "requireContractTerminate",
    "requireContractDelete",
    "requireContractPublicLink",
    "requireInvoiceWrite",
    "requireInvoiceSend",
    "requireInvoiceMarkPaid",
    "requireInvoiceDelete",
    "requireInvoicePublicLink",
    "requirePaymentWrite",
    "requirePaymentDelete",
    "requireCreditNoteWrite",
    "requireCreditNoteDelete",
    "requireRecurringInvoiceWrite",
    "requireRecurringInvoiceCancel",
    "requireRecurringInvoiceDelete",
    "requireBusinessSettingsWrite",
    "requireEmailSettingsWrite",
    "requireInvoicingSettingsWrite",
    "requirePaymentSettingsWrite",
    "requireTaxRatesWrite",
    "requireTeamWrite",
    "requireActivityWrite",
    "requireActivityDelete",
    "requireReportExport",
    "requireDataExportWrite"
  ],
  // The repo's eslint.config.mjs is JS/ESM, not JSON, so react-doctor does not actually adopt it; do
  // not rely on dedupe.
  adoptExistingLintConfig: true
}

export default config
