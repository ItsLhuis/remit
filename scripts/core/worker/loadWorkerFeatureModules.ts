// The feature modules the worker process imports for their side effects, extracted from
// `scripts/worker.ts` so the job-catalog test can load exactly what the worker loads. A drifting
// second copy of this list is how a job name ends up with no handler in production while a test that
// imports its own selection still passes.
//
// Each job module registers its handlers with `lib/jobs/registry` at module load, the way
// `features/*/events.ts` register bus subscribers. Without them the worker starts with an empty
// registry and every job fails with "No handler registered".
//
// `features/activityLog/events` is here for the subscriber reason rather than the handler one: the
// sweeps emit `invoice.overdue` and `recurring.invoice_generated` from this process, and without it
// their activity entries would only ever be written when a request happened to emit them instead.
//
// The imports stay dynamic because the caller has to load the environment first — every one of these
// modules reaches `lib/config/env.ts`, which exits the process when a variable is missing.
export async function loadWorkerFeatureModules(): Promise<void> {
  await Promise.all([
    import("@/features/invoices/jobs"),
    import("@/features/proposals/jobs"),
    import("@/features/creditNotes/jobs"),
    import("@/features/contracts/jobs"),
    import("@/features/recurringInvoices/jobs"),
    import("@/features/dataExport/jobs"),
    import("@/features/activityLog/events")
  ])
}
