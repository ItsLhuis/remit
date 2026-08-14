import { registerJobHandler } from "@/lib/jobs"

import { sendProposalEmail } from "./emailJob"
import { renderProposalPdf } from "./pdfRenderJob"

// This feature's job registrations (ADR-0023). Handlers register at module load, the way
// `features/*/events.ts` register bus subscribers; `scripts/core/worker/loadWorkerFeatureModules.ts`
// is what imports this file, and nothing under `lib/` reaches into a feature.
registerJobHandler("proposal.pdf.render", renderProposalPdf)
registerJobHandler("proposal.email.send", sendProposalEmail)
