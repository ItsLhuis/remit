import { type DataExportScope } from "../schemas"

import { type ExportTableManifest } from "./exportManifest"

const INSTANCE_ONLY: readonly DataExportScope[] = ["instance"]

// The tables only a whole-instance export carries: the instance's own configuration, its document
// templates and tax rates, and the two ledgers that describe the instance rather than any one client.
// `exportManifest.ts` holds the inclusion policy these lists implement; a client-scoped export drops
// every entry here (see `exportSubgraphTables.ts` for the other half).
export const EXPORT_INSTANCE_TABLES: readonly ExportTableManifest[] = [
  {
    table: "settings",
    file: "data/settings.json",
    scopes: INSTANCE_ONLY,
    columns: [
      "id",
      "businessName",
      "businessEmail",
      "businessPhone",
      "businessWebsite",
      "businessTaxId",
      "businessLogoUploadId",
      "businessAddressLine1",
      "businessAddressLine2",
      "businessCity",
      "businessState",
      "businessPostalCode",
      "businessCountry",
      "defaultCurrency",
      "defaultLocale",
      "defaultTimezone",
      "paymentTermsDays",
      "proposalValidityDays",
      "defaultNotesInvoice",
      "defaultInvoiceFooter",
      "defaultNotesProposal",
      "invoicePrefix",
      "proposalPrefix",
      "contractPrefix",
      "creditNotePrefix",
      "nextInvoiceNumber",
      "nextProposalNumber",
      "nextContractNumber",
      "nextCreditNoteNumber",
      "numberPaddingWidth",
      "defaultHourlyRateCents",
      "lateFeeEnabled",
      "lateFeeType",
      "lateFeePercentage",
      "lateFeeAmountCents",
      "lateFeeGraceDays",
      "lateFeeMaxCents",
      "paymentBankName",
      "paymentInstructions",
      "createdAt",
      "updatedAt"
    ],
    excludedColumns: [
      { column: "paymentIban", reason: "secret" },
      { column: "stripeSecretKey", reason: "secret" },
      { column: "stripeWebhookSecret", reason: "secret" },
      { column: "smtpPass", reason: "secret" },
      { column: "resendApiKey", reason: "secret" },
      { column: "backupS3AccessKey", reason: "secret" },
      { column: "backupS3SecretKey", reason: "secret" },
      { column: "stripePublishableKey", reason: "configuration" },
      { column: "stripeTestConnectionAt", reason: "configuration" },
      { column: "emailProvider", reason: "configuration" },
      { column: "smtpHost", reason: "configuration" },
      { column: "smtpPort", reason: "configuration" },
      { column: "smtpUser", reason: "configuration" },
      { column: "smtpSecure", reason: "configuration" },
      { column: "emailFromName", reason: "configuration" },
      { column: "emailFromAddress", reason: "configuration" },
      { column: "emailTestSendAt", reason: "configuration" },
      { column: "reminderBeforeDueDays", reason: "configuration" },
      { column: "reminderAfterDueDays", reason: "configuration" },
      { column: "backupDestination", reason: "configuration" },
      { column: "backupCadence", reason: "configuration" },
      { column: "backupRetentionDaily", reason: "configuration" },
      { column: "backupRetentionWeekly", reason: "configuration" },
      { column: "backupRetentionMonthly", reason: "configuration" },
      { column: "backupS3Bucket", reason: "configuration" },
      { column: "backupS3Region", reason: "configuration" },
      { column: "backupS3Endpoint", reason: "configuration" },
      { column: "backupLastSuccessAt", reason: "configuration" },
      { column: "backupLastFailureAt", reason: "configuration" },
      { column: "backupLastFailureReason", reason: "configuration" }
    ]
  },
  {
    table: "templates",
    file: "data/templates.json",
    scopes: INSTANCE_ONLY,
    columns: [
      "id",
      "type",
      "name",
      "description",
      "subject",
      "blocks",
      "pageSettings",
      "isDefault",
      "isSystem",
      "deletedAt",
      "createdAt",
      "updatedAt"
    ],
    excludedColumns: []
  },
  {
    table: "tax_rates",
    file: "data/tax-rates.json",
    scopes: INSTANCE_ONLY,
    columns: ["id", "name", "percentage", "isDefault", "deletedAt", "createdAt", "updatedAt"],
    excludedColumns: []
  },
  {
    // Instance scope only. The security ledger records who reached what across every actor on the
    // instance, including members who are not the exported client's counterparty, so scoping it to one
    // client would either leak those rows or ship a file whose name promises more than it holds.
    table: "audit_logs",
    file: "data/audit-logs.json",
    scopes: INSTANCE_ONLY,
    columns: [
      "id",
      "event",
      "actorUserId",
      "actorRole",
      "targetEntityType",
      "targetEntityId",
      "metadata",
      "ipAddress",
      "userAgent",
      "createdAt"
    ],
    excludedColumns: []
  },
  {
    table: "data_exports",
    file: "data/data-exports.json",
    scopes: INSTANCE_ONLY,
    columns: [
      "id",
      "scope",
      "clientId",
      "status",
      "progress",
      "startedAt",
      "completedAt",
      "failureReason",
      "requestedByUserId",
      "filename",
      "sizeBytes",
      "entryCount",
      "createdAt",
      "updatedAt"
    ],
    excludedColumns: [{ column: "storageKey", reason: "internal" }]
  }
]
