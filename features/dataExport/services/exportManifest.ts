import { type DataExportScope } from "../schemas"

import { EXPORT_INSTANCE_TABLES } from "./exportInstanceTables"
import { EXPORT_SUBGRAPH_TABLES } from "./exportSubgraphTables"

export type ColumnExclusionReason = "secret" | "configuration" | "bearerToken" | "internal"

export type TableExclusionReason = "authOwned" | "bearerToken"

export type ExcludedExportColumn = {
  column: string
  reason: ColumnExclusionReason
}

export type ExcludedExportTable = {
  table: string
  reason: TableExclusionReason
}

export type ExportTableManifest = {
  table: string
  file: string
  scopes: readonly DataExportScope[]
  // Column *property* names as Drizzle exposes them, which are also the JSON keys in the archive, so
  // the manifest reads the same as the file it produces. `__tests__/manifest.integration.test.ts`
  // maps them back to database columns and asserts that `columns` and `excludedColumns` together
  // cover the table exactly — a column added to the schema fails that test until a decision is
  // recorded here, which is what keeps a future secret out of the archive by default.
  columns: readonly string[]
  excludedColumns: readonly ExcludedExportColumn[]
}

// The inclusion list, split across `exportInstanceTables.ts` and `exportSubgraphTables.ts` by the
// scopes each table travels in. It is the security boundary of this feature: `serializeExportTable`
// emits the columns named there and nothing else, so a query that over-selects still cannot leak a
// column the manifest does not name.
//
// Two lines are drawn deliberately, and both are narrower than "everything the owner may see":
//
// 1. `settings` exports the business identity, locale, and document-numbering columns only. Every
//    email, payment-provider, and backup column is excluded — including the non-secret halves such
//    as `smtpHost` and `stripePublishableKey`, and including `paymentIban`. Those are configuration
//    an operator re-enters, not business records the owner needs to take elsewhere, and one boundary
//    around the whole configuration surface is auditable in a way a per-field allowlist is not: the
//    alternative, filtering only the `encryptedColumn()` fields, grows a new leak every time a
//    provider setting is added beside them.
// 2. Public document tokens are excluded everywhere. They are bearer credentials for `/i/[token]`,
//    `/p/[token]`, and `/c/[token]`; an archive that carries them hands anyone holding the zip a
//    live, unauthenticated route into the instance.
//
// `clients.notes` is the one encrypted column that does travel, in plaintext. It is the owner's own
// note about their own client — a business record with no credential in it — and it is the reason
// `queries.ts` selects the column rather than routing around it.
const EXPORT_TABLES: readonly ExportTableManifest[] = [
  ...EXPORT_INSTANCE_TABLES,
  ...EXPORT_SUBGRAPH_TABLES
]

// Whole tables that never enter an archive. The Better Auth boundary is drawn around the plugin's
// entire schema rather than around the credential-bearing columns inside it: `accounts.password`,
// `sessions.token`, `two_factors.secret`, `two_factors.backupCodes`, and `verifications.value` are
// all credentials, and the shape of the tables that hold them is owned by a dependency that changes
// them across upgrades. A filtered projection of `users` and `members` was considered and rejected
// for that reason — it would put a per-column review of somebody else's schema on the export path.
const EXPORT_EXCLUDED_TABLES: readonly ExcludedExportTable[] = [
  { table: "users", reason: "authOwned" },
  { table: "sessions", reason: "authOwned" },
  { table: "accounts", reason: "authOwned" },
  { table: "verifications", reason: "authOwned" },
  { table: "two_factors", reason: "authOwned" },
  { table: "organizations", reason: "authOwned" },
  { table: "members", reason: "authOwned" },
  { table: "invitations", reason: "authOwned" },
  // Single-use codes that authorize a public proposal response. They expire in minutes and are
  // stored hashed; exporting them would carry live acceptance credentials and nothing readable.
  { table: "proposal_otps", reason: "bearerToken" }
]

export function getExportTables(scope: DataExportScope): readonly ExportTableManifest[] {
  return EXPORT_TABLES.filter((manifest) => manifest.scopes.includes(scope))
}

export function getExportExcludedTables(): readonly ExcludedExportTable[] {
  return EXPORT_EXCLUDED_TABLES
}

export function getExportTableManifest(table: string): ExportTableManifest | undefined {
  return EXPORT_TABLES.find((manifest) => manifest.table === table)
}

// The projection that makes the manifest a boundary rather than documentation: only the columns named
// above are read off the row, so a query that selected the whole table still cannot emit a secret.
export function projectExportRow(
  manifest: ExportTableManifest,
  row: Record<string, unknown>
): Record<string, unknown> {
  const projected: Record<string, unknown> = {}

  for (const column of manifest.columns) {
    projected[column] = row[column] ?? null
  }

  return projected
}

export function serializeExportTable(
  manifest: ExportTableManifest,
  rows: readonly Record<string, unknown>[]
): string {
  return `${JSON.stringify(
    rows.map((row) => projectExportRow(manifest, row)),
    null,
    2
  )}\n`
}
