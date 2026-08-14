import { and, eq, isNull } from "drizzle-orm"

import { database } from "@/database"
import {
  contracts,
  contractSignatures,
  creditNotes,
  invoices,
  proposals,
  uploads
} from "@/database/schema"

import { type DocumentPdfKind } from "./storeDocumentPdf"

// Resolves a document to the stored PDF it points at. It lives beside `storeDocumentPdf` so one
// module owns the `DocumentPdfKind` vocabulary: the writer and the reader have to agree about what
// "contract_signed" means, and splitting them across two features is how they would stop agreeing.
//
// `contract_signed` is keyed by the signature id rather than the contract id, because a contract can
// be signed once but the executed copy belongs to the signature record — that is the row carrying
// `signed_pdf_upload_id`.

export type DocumentPdf = {
  filename: string
  storageKey: string
}

export async function findDocumentPdf(
  kind: DocumentPdfKind,
  documentId: string
): Promise<DocumentPdf | null> {
  const uploadId = await findUploadId(kind, documentId)

  if (!uploadId) return null

  const upload = await database.query.uploads.findFirst({
    columns: { filename: true, path: true, bucket: true },
    where: eq(uploads.id, uploadId)
  })

  // A row in the public bucket is not a document PDF, whatever it is pointed at from. Refusing it
  // here keeps this route from becoming a way to read arbitrary uploads by guessing a document id.
  if (upload?.bucket !== "documents") return null

  return { filename: upload.filename, storageKey: upload.path }
}

async function findUploadId(kind: DocumentPdfKind, documentId: string): Promise<string | null> {
  switch (kind) {
    case "invoice": {
      const row = await database.query.invoices.findFirst({
        columns: { pdfUploadId: true },
        where: and(eq(invoices.id, documentId), isNull(invoices.deletedAt))
      })

      return row?.pdfUploadId ?? null
    }
    case "proposal": {
      const row = await database.query.proposals.findFirst({
        columns: { pdfUploadId: true },
        where: and(eq(proposals.id, documentId), isNull(proposals.deletedAt))
      })

      return row?.pdfUploadId ?? null
    }
    case "contract": {
      const row = await database.query.contracts.findFirst({
        columns: { pdfUploadId: true },
        where: and(eq(contracts.id, documentId), isNull(contracts.deletedAt))
      })

      return row?.pdfUploadId ?? null
    }
    case "credit_note": {
      const row = await database.query.creditNotes.findFirst({
        columns: { pdfUploadId: true },
        where: and(eq(creditNotes.id, documentId), isNull(creditNotes.deletedAt))
      })

      return row?.pdfUploadId ?? null
    }
    case "contract_signed": {
      const row = await database.query.contractSignatures.findFirst({
        columns: { signedPdfUploadId: true },
        where: eq(contractSignatures.id, documentId)
      })

      return row?.signedPdfUploadId ?? null
    }
  }
}
