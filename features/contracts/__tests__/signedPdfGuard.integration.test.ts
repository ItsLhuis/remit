import { eq } from "drizzle-orm"

import { describe, expect, test } from "vitest"

import { contractSignatures, uploads } from "@/database/schema"

import { makeContract } from "@/tests/factories"
import { database } from "@/tests/integration/database"

// The `contract_signatures_set_signed_pdf` guard from `0001_insert_only_guards.sql`. It is the
// enforcement half of the artifact-pointer decision: the signature row is written the instant a
// counterparty signs, and the PDF recording what they signed is rendered afterwards by a job, so
// the column has to be fillable exactly once without the rest of the row ever becoming mutable. A
// blanket BEFORE UPDATE trigger, which is what the other insert-only table carries, would make that
// impossible and leave `signed_pdf_upload_id` null on every signature ever stored.
async function makeSignature(): Promise<string> {
  const contract = await makeContract()

  const [signature] = await database
    .insert(contractSignatures)
    .values({
      contractId: contract.id,
      signerName: "Ada Lovelace",
      signerEmail: "ada@example.test",
      consentText: "I agree",
      ipAddress: "203.0.113.10",
      userAgent: "probe"
    })
    .returning({ id: contractSignatures.id })

  if (!signature) throw new Error("makeSignature: insert failed")

  return signature.id
}

async function makePdfUpload(): Promise<string> {
  const [upload] = await database
    .insert(uploads)
    .values({
      filename: "contract.pdf",
      path: `documents/contracts/${crypto.randomUUID()}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1024,
      bucket: "documents"
    })
    .returning({ id: uploads.id })

  if (!upload) throw new Error("makePdfUpload: insert failed")

  return upload.id
}

// Drizzle wraps a driver failure and puts the SQL in `message`, so the trigger's own RAISE text —
// the only thing that says *which* rule rejected the statement — survives one level down on `cause`.
// Walking the whole chain keeps these assertions working whichever layer surfaces it.
function describeError(error: unknown): string {
  const messages: string[] = []

  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    messages.push(current.message)
  }

  return messages.join(" | ")
}

async function captureRejection(operation: Promise<unknown>): Promise<string> {
  try {
    await operation
  } catch (error) {
    return describeError(error)
  }

  throw new Error("Expected the statement to be rejected by the guard")
}

describe("contract signature signed-PDF guard", () => {
  test("allows the signed PDF pointer to be set once", async () => {
    const signatureId = await makeSignature()
    const uploadId = await makePdfUpload()

    await database
      .update(contractSignatures)
      .set({ signedPdfUploadId: uploadId })
      .where(eq(contractSignatures.id, signatureId))

    const [row] = await database
      .select({ signedPdfUploadId: contractSignatures.signedPdfUploadId })
      .from(contractSignatures)
      .where(eq(contractSignatures.id, signatureId))

    expect(row?.signedPdfUploadId).toBe(uploadId)
  })

  test("rejects a second write to the signed PDF pointer", async () => {
    const signatureId = await makeSignature()

    await database
      .update(contractSignatures)
      .set({ signedPdfUploadId: await makePdfUpload() })
      .where(eq(contractSignatures.id, signatureId))

    const failure = await captureRejection(
      database
        .update(contractSignatures)
        .set({ signedPdfUploadId: await makePdfUpload() })
        .where(eq(contractSignatures.id, signatureId))
    )

    expect(failure).toMatch(/write-once/)
  })

  test("rejects a change to a legally meaningful column", async () => {
    const signatureId = await makeSignature()

    const failure = await captureRejection(
      database
        .update(contractSignatures)
        .set({ signedPdfUploadId: await makePdfUpload(), signerEmail: "mallory@example.test" })
        .where(eq(contractSignatures.id, signatureId))
    )

    expect(failure).toMatch(/insert-only/)
  })

  test("rejects an update that does not set the signed PDF pointer", async () => {
    const signatureId = await makeSignature()

    const failure = await captureRejection(
      database
        .update(contractSignatures)
        .set({ signerName: "Mallory" })
        .where(eq(contractSignatures.id, signatureId))
    )

    expect(failure).toMatch(/insert-only/)
  })

  test("still rejects a delete", async () => {
    const signatureId = await makeSignature()

    const failure = await captureRejection(
      database.delete(contractSignatures).where(eq(contractSignatures.id, signatureId))
    )

    expect(failure).toMatch(/insert-only/)
  })
})
