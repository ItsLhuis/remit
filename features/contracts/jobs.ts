import { registerJobHandler } from "@/lib/jobs"

import { sendContractEmail } from "./emailJob"
import { renderContractPdf, renderSignedContractPdf } from "./pdfRenderJob"

// This feature's job registrations (ADR-0023). Handlers register at module load, the way
// `features/*/events.ts` register bus subscribers; `scripts/core/worker/loadWorkerFeatureModules.ts`
// is what imports this file, and nothing under `lib/` reaches into a feature.
registerJobHandler("contract.pdf.render", renderContractPdf)
registerJobHandler("contract.signed_pdf.render", renderSignedContractPdf)
registerJobHandler("contract.email.send", sendContractEmail)
