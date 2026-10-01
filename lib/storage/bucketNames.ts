// The two buckets an `uploads` row can name (`database/schema/uploads.ts`'s `bucket` column).
export type StorageBucketName = "public" | "documents"

// Every bucket Remit keeps, by the role it plays rather than its physical name. Backups record an
// object's role, so an archive restores into an instance whose base name differs (ADR-0046).
export type StorageBucketRole = StorageBucketName | "exports"

// At most 53 characters because two more buckets are derived from the base name and `-documents`
// must still fit S3's 63-character limit.
export const BUCKET_BASE_NAME_PATTERN = /^[a-z0-9][a-z0-9.-]{1,51}[a-z0-9]$/

// Three buckets derived from one name, so an operator configures nothing more than `S3_BUCKET`.
//
// `public` holds what `app/api/storage/[...key]/route.ts` serves anonymously: avatars, logos, client
// and template images, expense receipts — anyone holding a key may read it, which is why every key
// is an unguessable UUID minted by the upload route.
//
// `documents` holds generated document PDFs (ADR-0022) and attachments (ADR-0028). An invoice, a
// proposal and an executed contract are money and legal documents, and "readable by anyone holding
// its key" is not an acceptable default for one: a client reaches their copy through the tokenized
// public route or an emailed attachment, the owner through a credentialed route, and neither hands
// out a storage URL.
//
// `exports` holds data exports and report PDFs, each the whole instance or a whole report in one
// file, kept off the public route for the same reason and read only through the owner-gated download
// routes.
export function resolveBucketNames(base: string): Record<StorageBucketRole, string> {
  return {
    public: base,
    documents: `${base}-documents`,
    exports: `${base}-exports`
  }
}
