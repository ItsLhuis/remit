// The feature modules the worker process loads (apps/worker/core/loadWorkerFeatureModules.ts),
// restated for the integration tests that run a real worker in-process. `apps/worker` depends on
// this package, so the list cannot be imported from there without a cycle. Only these tests read
// this copy: the job-catalog test in apps/worker guards the worker's own list against the catalog,
// so a drift here costs a test its handler, never production.
export async function loadJobModules(): Promise<void> {
  await Promise.all([
    import("@/features/invoices/jobs"),
    import("@/features/proposals/jobs"),
    import("@/features/creditNotes/jobs"),
    import("@/features/contracts/jobs"),
    import("@/features/recurringInvoices/jobs"),
    import("@/features/dataExport/jobs"),
    import("@/features/reports/jobs"),
    import("@/features/trash/jobs"),
    import("@/features/backups/jobs"),
    import("@/features/webhooks/jobs"),
    import("@/features/activityLog/events"),
    import("@/features/webhooks/events")
  ])
}
