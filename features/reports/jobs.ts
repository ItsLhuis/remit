import { registerJobHandler } from "@/lib/jobs"

import { renderReportPdf } from "./pdfRenderJob"

// This feature's job registration (ADR-0023). Handlers register at module load, the way
// `features/*/events.ts` register bus subscribers;
// `scripts/core/worker/loadWorkerFeatureModules.ts` is what imports this file, and nothing under
// `lib/` reaches into a feature.
registerJobHandler("report.pdf.render", renderReportPdf)
