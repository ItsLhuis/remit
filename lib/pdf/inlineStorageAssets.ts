import { inArray } from "drizzle-orm"

import { logger } from "@/lib/logger"

import { getStorageObjectBytes } from "@/lib/storage/s3"

import { database } from "@/database"
import { uploads } from "@/database/schema"

// Turns the storage paths a template's assets resolve to into `data:` URIs.
//
// This exists because of the renderer's trust boundary, not for convenience. `lib/pdf/renderPdf.ts`
// aborts every request that is not a `data:` URI, so an `<img src>` pointing at object storage — the
// form the in-app preview uses — renders as nothing at all in a PDF. Inlining server-side is what
// makes "the browser reaches no network" and "the logo appears" true at the same time.
//
// The mime type comes from the `uploads` row rather than from the file extension: the column is
// already the authority everywhere else, and a data URI with the wrong type is a silently blank
// image.
export async function inlineStorageAssets(
  assetsByKey: Record<string, string>
): Promise<Record<string, string>> {
  const paths = [...new Set(Object.values(assetsByKey))]

  if (paths.length === 0) return {}

  const rows = await database
    .select({ path: uploads.path, mimeType: uploads.mimeType, bucket: uploads.bucket })
    .from(uploads)
    .where(inArray(uploads.path, paths))

  // Fetched concurrently: a document's images are independent objects, and a template with a logo
  // and a few figures would otherwise pay one storage round trip after another before rendering can
  // start.
  const fetched = await Promise.all(
    rows.map(async (row) => ({ path: row.path, dataUri: await toDataUri(row) }))
  )

  const dataUriByPath = new Map(
    fetched.flatMap(({ path, dataUri }) => (dataUri ? [[path, dataUri] as const] : []))
  )

  // A key whose object could not be read is dropped rather than passed through as a path. Keeping it
  // would put a URL the renderer aborts into the document; dropping it makes the image block render
  // empty, which is what the renderer would have produced anyway and is honest about the gap.
  return Object.fromEntries(
    Object.entries(assetsByKey).flatMap(([key, path]) => {
      const dataUri = dataUriByPath.get(path)

      return dataUri ? [[key, dataUri]] : []
    })
  )
}

type AssetRow = {
  path: string
  mimeType: string
  bucket: "public" | "documents"
}

// A missing object is not a render failure. `uploads` rows outlive the objects they point at, and
// refusing to produce an invoice because a logo is gone would withhold the document over its
// decoration — the same trade `features/dataExport/jobs.ts` makes for the same reason.
async function toDataUri(row: AssetRow): Promise<string | null> {
  try {
    const bytes = await getStorageObjectBytes(row.path, row.bucket)

    return `data:${row.mimeType};base64,${bytes.toString("base64")}`
  } catch (error) {
    logger.error(
      { action: "inlineStorageAssets", path: row.path, err: error },
      "Document asset could not be inlined"
    )

    return null
  }
}
