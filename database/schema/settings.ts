import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core"

import { sql } from "drizzle-orm"

import { backupCadence, backupDestination, emailProvider } from "./enums"
import { encryptedColumn, timestamps } from "./helpers"
import { uploads } from "./uploads"

export const settings = pgTable(
  "settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Business profile
    businessName: text("business_name"),
    businessEmail: text("business_email"),
    businessPhone: text("business_phone"),
    businessWebsite: text("business_website"),
    businessTaxId: text("business_tax_id"),
    businessLogoUploadId: uuid("business_logo_upload_id").references(() => uploads.id, {
      onDelete: "set null"
    }),
    businessAddressLine1: text("business_address_line1"),
    businessAddressLine2: text("business_address_line2"),
    businessCity: text("business_city"),
    businessState: text("business_state"),
    businessPostalCode: text("business_postal_code"),
    businessCountry: text("business_country"),

    // Locale
    defaultCurrency: varchar("default_currency", { length: 3 }).notNull().default("EUR"),
    defaultLocale: text("default_locale").notNull().default("en"),
    defaultTimezone: text("default_timezone").notNull().default("UTC"),

    // Invoicing
    paymentTermsDays: integer("payment_terms_days").notNull().default(30),
    proposalValidityDays: integer("proposal_validity_days").notNull().default(30),
    defaultNotesInvoice: text("default_notes_invoice"),
    defaultNotesProposal: text("default_notes_proposal"),
    invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
    proposalPrefix: text("proposal_prefix").notNull().default("PROP-"),
    creditNotePrefix: text("credit_note_prefix").notNull().default("CN-"),
    nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
    nextProposalNumber: integer("next_proposal_number").notNull().default(1),
    nextCreditNoteNumber: integer("next_credit_note_number").notNull().default(1),
    numberPaddingWidth: integer("number_padding_width").notNull().default(4),

    // Payments
    paymentIban: encryptedColumn("payment_iban"),
    paymentBankName: text("payment_bank_name"),
    paymentInstructions: text("payment_instructions"),
    stripePublishableKey: text("stripe_publishable_key"),
    stripeSecretKey: encryptedColumn("stripe_secret_key"),
    stripeWebhookSecret: encryptedColumn("stripe_webhook_secret"),
    stripeTestConnectionAt: timestamp("stripe_test_connection_at", {
      withTimezone: true,
      mode: "date"
    }),

    // Email
    emailProvider: emailProvider("email_provider"),
    smtpHost: text("smtp_host"),
    smtpPort: integer("smtp_port"),
    smtpUser: text("smtp_user"),
    smtpPass: encryptedColumn("smtp_pass"),
    smtpSecure: boolean("smtp_secure").notNull().default(true),
    resendApiKey: encryptedColumn("resend_api_key"),
    emailFromName: text("email_from_name"),
    emailFromAddress: text("email_from_address"),
    emailTestSendAt: timestamp("email_test_send_at", { withTimezone: true, mode: "date" }),

    // Reminders
    reminderBeforeDueDays: integer("reminder_before_due_days")
      .array()
      .notNull()
      .default(sql`ARRAY[3, 0]`),
    reminderAfterDueDays: integer("reminder_after_due_days")
      .array()
      .notNull()
      .default(sql`ARRAY[7, 14, 30]`),

    // Hosting
    baseUrl: text("base_url"),
    sentryDsn: text("sentry_dsn"),
    metricsToken: encryptedColumn("metrics_token"),
    hostedMode: boolean("hosted_mode").notNull().default(false),

    // Backups
    backupDestination: backupDestination("backup_destination").notNull().default("local"),
    backupCadence: backupCadence("backup_cadence").notNull().default("daily"),
    backupRetentionDaily: integer("backup_retention_daily").notNull().default(7),
    backupRetentionWeekly: integer("backup_retention_weekly").notNull().default(4),
    backupRetentionMonthly: integer("backup_retention_monthly").notNull().default(12),
    backupS3Bucket: text("backup_s3_bucket"),
    backupS3Region: text("backup_s3_region"),
    backupS3Endpoint: text("backup_s3_endpoint"),
    backupS3AccessKey: encryptedColumn("backup_s3_access_key"),
    backupS3SecretKey: encryptedColumn("backup_s3_secret_key"),
    backupLastSuccessAt: timestamp("backup_last_success_at", { withTimezone: true, mode: "date" }),
    backupLastFailureAt: timestamp("backup_last_failure_at", { withTimezone: true, mode: "date" }),
    backupLastFailureReason: text("backup_last_failure_reason"),

    ...timestamps
  },
  (table) => [
    check(
      "chk_settings_email_provider",
      sql`${table.emailProvider} IS NULL OR ${table.emailProvider} IN ('smtp', 'resend')`
    ),
    check("chk_settings_payment_terms_days", sql`${table.paymentTermsDays} >= 0`),
    check("chk_settings_proposal_validity_days", sql`${table.proposalValidityDays} >= 0`),
    check("chk_settings_next_invoice_number", sql`${table.nextInvoiceNumber} >= 1`),
    check("chk_settings_next_proposal_number", sql`${table.nextProposalNumber} >= 1`),
    check("chk_settings_next_credit_note_number", sql`${table.nextCreditNoteNumber} >= 1`),
    check(
      "chk_settings_number_padding_width",
      sql`${table.numberPaddingWidth} >= 1 AND ${table.numberPaddingWidth} <= 10`
    )
  ]
)
