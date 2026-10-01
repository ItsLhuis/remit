const MiB = 1024 * 1024

// Above this an archive goes up in parts. S3 caps a single request at 5 GiB, and an archive now
// carries every stored file (ADR-0046); well below the cap so the multipart path is the one a growing
// instance exercises long before it would be the only one that works.
export const MULTIPART_THRESHOLD_BYTES = 256 * MiB

// 64 MiB parts, grown when an archive is so large that S3's ten-thousand-part limit would be reached.
// Every part is read into memory before it is sent, which is what bounds the upload's footprint.
const DEFAULT_PART_BYTES = 64 * MiB
const MAXIMUM_PART_COUNT = 10_000

// The smallest part Amazon S3, Cloudflare R2 and Backblaze B2 all accept, the last part excepted.
export const MINIMUM_PART_BYTES = 5 * MiB

export type MultipartUploadPlan =
  | { kind: "single" }
  | { kind: "multipart"; partSize: number; partCount: number }

export function planMultipartUpload(
  sizeBytes: number,
  options: { thresholdBytes?: number; partBytes?: number } = {}
): MultipartUploadPlan {
  if (sizeBytes <= (options.thresholdBytes ?? MULTIPART_THRESHOLD_BYTES)) return { kind: "single" }

  const partSize = Math.max(
    options.partBytes ?? DEFAULT_PART_BYTES,
    MINIMUM_PART_BYTES,
    Math.ceil(sizeBytes / MAXIMUM_PART_COUNT)
  )

  return { kind: "multipart", partSize, partCount: Math.ceil(sizeBytes / partSize) }
}
