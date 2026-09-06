import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core"

import { backupCadence, backupDestination, emailProvider, lateFeeType } from "./enums"
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
    // Deliberately unindexed where its sibling upload references are not: `settings` holds a
    // single row, so the scan an upload delete triggers here reads one row.
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
    defaultInvoiceFooter: text("default_invoice_footer"),
    defaultNotesProposal: text("default_notes_proposal"),
    invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
    proposalPrefix: text("proposal_prefix").notNull().default("PROP-"),
    contractPrefix: text("contract_prefix").notNull().default("CTR-"),
    creditNotePrefix: text("credit_note_prefix").notNull().default("CN-"),
    nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
    nextProposalNumber: integer("next_proposal_number").notNull().default(1),
    nextContractNumber: integer("next_contract_number").notNull().default(1),
    nextCreditNoteNumber: integer("next_credit_note_number").notNull().default(1),
    numberPaddingWidth: integer("number_padding_width").notNull().default(4),

    // Late fees
    //
    // Off is the only safe default. These columns arrive on instances that have been invoicing for
    // months, and a policy that defaulted to on would charge a self-hoster's existing clients a fee
    // they never agreed to on the first night the upgraded worker ran.
    lateFeeEnabled: boolean("late_fee_enabled").notNull().default(false),
    lateFeeType: lateFeeType("late_fee_type"),
    lateFeePercentage: numeric("late_fee_percentage", { precision: 5, scale: 2 }),
    lateFeeAmountCents: bigint("late_fee_amount_cents", { mode: "number" }),
    lateFeeGraceDays: integer("late_fee_grace_days").notNull().default(0),
    lateFeeMaxCents: bigint("late_fee_max_cents", { mode: "number" }),

    // Time tracking
    defaultHourlyRateCents: bigint("default_hourly_rate_cents", { mode: "number" }),

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
    check(
      "chk_settings_payment_terms_days",
      sql`${table.paymentTermsDays} >= 0 AND ${table.paymentTermsDays} <= 365`
    ),
    check("chk_settings_proposal_validity_days", sql`${table.proposalValidityDays} >= 0`),
    check(
      "chk_settings_invoice_prefix",
      sql`length(${table.invoicePrefix}) <= 24 AND ${table.invoicePrefix} ~ '^[ -~]*$'`
    ),
    check("chk_settings_next_invoice_number", sql`${table.nextInvoiceNumber} >= 1`),
    check("chk_settings_next_proposal_number", sql`${table.nextProposalNumber} >= 1`),
    check("chk_settings_next_contract_number", sql`${table.nextContractNumber} >= 1`),
    check("chk_settings_next_credit_note_number", sql`${table.nextCreditNoteNumber} >= 1`),
    check(
      "chk_settings_number_padding_width",
      sql`${table.numberPaddingWidth} >= 1 AND ${table.numberPaddingWidth} <= 10`
    ),
    // The last rung of the rate precedence ladder, and deliberately not defaulted: an instance that
    // has never configured a rate must resolve to the `"none"` source in
    // features/timeTracking/services/resolveHourlyRate.ts rather than to an invented number that
    // would silently price every entry.
    check(
      "chk_settings_default_hourly_rate",
      sql`${table.defaultHourlyRateCents} IS NULL OR ${table.defaultHourlyRateCents} >= 0`
    ),
    // The same either-or shape `chk_invoices_discount_shape` uses: the type names which of the two
    // amount columns carries the policy, and the other stays null, so no row can hold a percentage
    // and a flat amount at once.
    check(
      "chk_settings_late_fee_shape",
      sql`(${table.lateFeeType} IS NULL AND ${table.lateFeePercentage} IS NULL AND ${table.lateFeeAmountCents} IS NULL) OR (${table.lateFeeType} = 'percentage' AND ${table.lateFeePercentage} IS NOT NULL AND ${table.lateFeeAmountCents} IS NULL) OR (${table.lateFeeType} = 'fixed' AND ${table.lateFeeAmountCents} IS NOT NULL AND ${table.lateFeePercentage} IS NULL)`
    ),
    // Enabling with nothing configured would leave the sweep reading a policy it cannot price, so
    // the switch and the amount can only be turned on together.
    check(
      "chk_settings_late_fee_enabled_shape",
      sql`${table.lateFeeEnabled} = false OR ${table.lateFeeType} IS NOT NULL`
    ),
    check(
      "chk_settings_late_fee_percentage",
      sql`${table.lateFeePercentage} IS NULL OR (${table.lateFeePercentage} >= 0 AND ${table.lateFeePercentage} <= 100)`
    ),
    check(
      "chk_settings_late_fee_amount",
      sql`${table.lateFeeAmountCents} IS NULL OR ${table.lateFeeAmountCents} >= 0`
    ),
    check(
      "chk_settings_late_fee_grace_days",
      sql`${table.lateFeeGraceDays} >= 0 AND ${table.lateFeeGraceDays} <= 365`
    ),
    check(
      "chk_settings_late_fee_max",
      sql`${table.lateFeeMaxCents} IS NULL OR ${table.lateFeeMaxCents} >= 0`
    )
  ]
)
