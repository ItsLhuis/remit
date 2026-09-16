import { type S3ServiceException } from "@aws-sdk/client-s3"

// 403 counts as missing, not as a permissions bug: S3 and MinIO answer a GET for a key that does not
// exist with AccessDenied rather than NoSuchKey whenever the caller lacks `s3:ListBucket` on the
// bucket, which Remit's credentials deliberately do not grant broadly.
export function isMissingObjectError(error: unknown): boolean {
  const status = (error as S3ServiceException | undefined)?.$metadata?.httpStatusCode

  return status === 404 || status === 403
}
