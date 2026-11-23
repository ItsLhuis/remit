// The feature modules the worker process imports for their side effects, extracted from
// `worker.ts` so the job-catalog test can load exactly what the worker loads. A drifting
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
// `features/webhooks/events` is here for the same reason: an overdue invoice announced by a sweep is
// as much a webhook event as one announced by a request.
//
// The imports stay dynamic because the caller has to load the environment first — every one of these
// modules reaches `lib/config/env.ts`, which exits the process when a variable is missing.
export async function loadWorkerFeatureModules(): Promise<void> {
  await Promise.all([
    import("@remit/web/features/invoices/jobs"),
    import("@remit/web/features/proposals/jobs"),
    import("@remit/web/features/creditNotes/jobs"),
    import("@remit/web/features/contracts/jobs"),
    import("@remit/web/features/recurringInvoices/jobs"),
    import("@remit/web/features/dataExport/jobs"),
    import("@remit/web/features/reports/jobs"),
    import("@remit/web/features/trash/jobs"),
    import("@remit/web/features/backups/jobs"),
    import("@remit/web/features/webhooks/jobs"),
    import("@remit/web/features/activityLog/events"),
    import("@remit/web/features/webhooks/events")
  ])
}
