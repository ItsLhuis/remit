import { type S3ServiceException } from "@aws-sdk/client-s3"

export function readStatusCode(error: unknown): number | undefined {
  return (error as S3ServiceException | undefined)?.$metadata?.httpStatusCode
}

// 403 counts as missing, not as a permissions bug: an S3 service answers a GET or HEAD for a key that
// does not exist with AccessDenied rather than NoSuchKey whenever the caller lacks `s3:ListBucket` on
// the bucket, which a key an operator scopes to Remit's objects may well not have (ADR-0045).
export function isMissingObjectError(error: unknown): boolean {
  const status = readStatusCode(error)

  return status === 404 || status === 403
}
