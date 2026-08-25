import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { uploads } from "@/database/schema"

import { database } from "@/tests/integration/database"

export async function makeUpload(overrides?: Partial<InferInsertModel<typeof uploads>>) {
  const [upload] = await database
    .insert(uploads)
    .values({
      filename: faker.system.commonFileName("png"),
      path: `uploads/${faker.string.uuid()}.png`,
      mimeType: "image/png",
      sizeBytes: 1024,
      checksumSha256: faker.string.hexadecimal({ length: 64, prefix: "", casing: "lower" }),
      ...overrides
    })
    .returning()

  if (!upload) throw new Error("makeUpload: insert failed")

  return upload
}
