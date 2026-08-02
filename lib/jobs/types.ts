// The typed job catalog. A producer call is rejected by the compiler unless the name and payload
// appear here, mirroring `lib/events/types.ts` for the event bus.
export type JobMap = {
  "proposal.pdf.render": {
    proposalId: string
  }
  "contract.pdf.render": {
    contractId: string
  }
  // Distinct from `contract.pdf.render`: this one renders the executed document with the signature
  // record embedded, and carries the signature row the worker writes `signed_pdf_upload_id` back to
  // once the PDF is stored (ADR-0022).
  "contract.signed_pdf.render": {
    contractId: string
    signatureId: string
  }
  "invoice.pdf.render": {
    invoiceId: string
  }
}

export type JobName = keyof JobMap
