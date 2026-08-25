import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { attachments } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeUpload } from "./uploads"

// `uploadId` is generated rather than defaulted to a shared row on purpose: `uq_attachments_upload_id`
// allows one attachment per upload, so a factory that reused one would fail the second insert of any
// test that makes two.
export async function makeAttachment(overrides?: Partial<InferInsertModel<typeof attachments>>) {
  const uploadId = overrides?.uploadId ?? (await makeUpload({ bucket: "documents" })).id

  const [attachment] = await database
    .insert(attachments)
    .values({
      uploadId,
      title: faker.lorem.words(2),
      ...overrides
    })
    .returning()

  if (!attachment) throw new Error("makeAttachment: insert failed")

  return attachment
}
