import { boolean, check, integer, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core"

import { relations, sql } from "drizzle-orm"

import { timestamps } from "./helpers"

export const settings = pgTable(
  "settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessName: text("business_name"),
    businessEmail: text("business_email"),
    businessPhone: text("business_phone"),
    businessWebsite: text("business_website"),
    businessTaxId: text("business_tax_id"),
    businessLogoUrl: text("business_logo_url"),
    businessAddressLine1: text("business_address_line1"),
    businessAddressLine2: text("business_address_line2"),
    businessCity: text("business_city"),
    businessState: text("business_state"),
    businessPostalCode: text("business_postal_code"),
    businessCountry: text("business_country"),
    defaultCurrency: varchar("default_currency", { length: 3 }).notNull().default("EUR"),
    paymentTermsDays: integer("payment_terms_days").notNull().default(30),
    proposalValidityDays: integer("proposal_validity_days").notNull().default(30),
    defaultNotesInvoice: text("default_notes_invoice"),
    defaultNotesProposal: text("default_notes_proposal"),
    paymentIban: text("payment_iban"),
    paymentBankName: text("payment_bank_name"),
    paymentInstructions: text("payment_instructions"),
    emailProvider: text("email_provider"),
    smtpHost: text("smtp_host"),
    smtpPort: integer("smtp_port"),
    smtpUser: text("smtp_user"),
    smtpPass: text("smtp_pass"),
    smtpSecure: boolean("smtp_secure").notNull().default(true),
    resendApiKey: text("resend_api_key"),
    emailFromName: text("email_from_name"),
    emailFromAddress: text("email_from_address"),
    baseUrl: text("base_url"),
    nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
    nextProposalNumber: integer("next_proposal_number").notNull().default(1),
    invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
    proposalPrefix: text("proposal_prefix").notNull().default("PROP-"),
    numberPaddingWidth: integer("number_padding_width").notNull().default(4),
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
    check(
      "chk_settings_number_padding_width",
      sql`${table.numberPaddingWidth} >= 1 AND ${table.numberPaddingWidth} <= 10`
    )
  ]
)

export const settingsRelations = relations(settings, () => ({}))
