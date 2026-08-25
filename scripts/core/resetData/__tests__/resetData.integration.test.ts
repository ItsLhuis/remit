import { count, eq } from "drizzle-orm"

import { expect, test, vi } from "vitest"

import * as schema from "@/database/schema"
import {
  auditLogs,
  clientContacts,
  clients,
  contractSignatures,
  contracts,
  invoices,
  lineItems,
  members,
  organizations,
  settings,
  taxRates,
  templates,
  timeEntries,
  uploads,
  users
} from "@/database/schema"

import { database } from "@/tests/integration/database"

import { runSeedDemo } from "../../seedDemo/runSeedDemo"
import { runResetData } from "../runResetData"

// The reset drains the job queue after its transaction commits. Stubbed here so the suite needs no
// Redis and so a drain failure can never be mistaken for a database assertion failing.
vi.mock("@/lib/jobs/queue", () => ({
  closeQueue: async () => undefined,
  getQueue: () => ({ obliterate: async () => undefined })
}))

const ownerUserId = "11111111-1111-4111-8111-111111111111"
const organizationId = "22222222-2222-4222-8222-222222222222"

type CountableTable =
  | typeof auditLogs
  | typeof clientContacts
  | typeof clients
  | typeof contractSignatures
  | typeof contracts
  | typeof invoices
  | typeof lineItems
  | typeof members
  | typeof organizations
  | typeof settings
  | typeof taxRates
  | typeof templates
  | typeof timeEntries
  | typeof uploads
  | typeof users

test("empties domain data while leaving the account and configuration intact", async () => {
  await createOwner()
  await seedDemoInstance()
  await signFirstContract()

  const template = await createTemplate()
  const logoUploadId = await attachBusinessLogo()
  const invoicePdfUploadId = await attachInvoicePdf()
  const settingsBefore = await getSettings()
  const seededContacts = await tableCount(clientContacts)

  const result = await runResetData(database, schema, { dryRun: false, help: false, yes: true })

  expect(result.wrote).toBe(true)
  expect(seededContacts).toBeGreaterThan(0)
  expect(await tableCount(clientContacts)).toBe(0)
  expect(await tableCount(clients)).toBe(0)
  expect(await tableCount(contracts)).toBe(0)
  expect(await tableCount(contractSignatures)).toBe(0)
  expect(await tableCount(invoices)).toBe(0)
  expect(await tableCount(lineItems)).toBe(0)
  expect(await tableCount(timeEntries)).toBe(0)

  expect(await tableCount(users)).toBe(1)
  expect(await tableCount(members)).toBe(1)
  expect(await tableCount(organizations)).toBe(1)
  expect(await tableCount(settings)).toBe(1)
  expect(await tableCount(taxRates)).toBeGreaterThan(0)
  expect(await rowExists(templates, template.id)).toBe(true)

  const settingsAfter = await getSettings()

  expect(settingsAfter.businessName).toBe(settingsBefore.businessName)
  expect(settingsAfter.nextInvoiceNumber).toBe(settingsBefore.nextInvoiceNumber)
  expect(settingsAfter.businessLogoUploadId).toBe(logoUploadId)

  expect(await rowExists(uploads, logoUploadId)).toBe(true)
  expect(await rowExists(uploads, invoicePdfUploadId)).toBe(false)
})

test("writes one audit entry carrying the per-table deleted counts", async () => {
  await createOwner()
  await seedDemoInstance()

  const clientsBefore = await tableCount(clients)

  await runResetData(database, schema, { dryRun: false, help: false, yes: true })

  const entries = await database
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.event, "instance.reset_data.completed"))

  expect(entries).toHaveLength(1)
  expect(entries[0]).toMatchObject({
    actorUserId: null,
    targetEntityType: "instance",
    userAgent: "cli/reset-data"
  })
  expect(entries[0]?.metadata).toMatchObject({
    deletedCounts: { clients: clientsBefore },
    keptTables: expect.arrayContaining(["settings", "audit_logs", "users", "tax_rates"])
  })
})

test("makes no database writes when dry-run is used", async () => {
  await createOwner()
  await seedDemoInstance()

  const clientsBefore = await tableCount(clients)

  const result = await runResetData(database, schema, { dryRun: true, help: false, yes: true })

  expect(result.wrote).toBe(false)
  expect(result.plan.deletableRowTotal).toBeGreaterThan(0)
  expect(await tableCount(clients)).toBe(clientsBefore)
  expect(await tableCount(auditLogs)).toBe(0)
})

test("reports the business name as the phrase the operator has to type", async () => {
  await createOwner()
  await seedDemoInstance()

  const settingsRow = await getSettings()

  const result = await runResetData(database, schema, { dryRun: true, help: false, yes: true })

  expect(result.plan.confirmationPhrase).toBe(settingsRow.businessName)
})

async function createOwner(): Promise<void> {
  await database.insert(users).values({
    id: ownerUserId,
    name: "Owner User",
    email: "owner@example.test",
    emailVerified: true,
    twoFactorEnabled: true,
    mustChangePassword: false
  })

  await database.insert(organizations).values({
    id: organizationId,
    name: "Owner Organization",
    slug: "owner-organization"
  })

  await database.insert(members).values({
    userId: ownerUserId,
    organizationId,
    role: "owner"
  })
}

async function seedDemoInstance(): Promise<void> {
  await runSeedDemo(database, schema, {
    countOverrides: {},
    dryRun: false,
    help: false,
    reseed: false,
    seed: 42,
    size: "small",
    yes: true
  })
}

async function signFirstContract(): Promise<void> {
  const contract = await database.query.contracts.findFirst()

  if (!contract) throw new Error("Expected the demo seed to create a contract")

  await database.insert(contractSignatures).values({
    contractId: contract.id,
    signerName: "Signer",
    signerEmail: "signer@example.test",
    consentText: "I agree",
    ipAddress: "203.0.113.10",
    userAgent: "vitest"
  })
}

async function createTemplate(): Promise<{ id: string }> {
  const [row] = await database
    .insert(templates)
    .values({ type: "invoice", name: "Operator template" })
    .returning({ id: templates.id })

  if (!row) throw new Error("Expected the template insert to return a row")

  return row
}

async function attachBusinessLogo(): Promise<string> {
  const uploadId = await createUpload("logo.png", "uploads/logo.png")
  const settingsRow = await getSettings()

  await database
    .update(settings)
    .set({ businessLogoUploadId: uploadId })
    .where(eq(settings.id, settingsRow.id))

  return uploadId
}

async function attachInvoicePdf(): Promise<string> {
  const uploadId = await createUpload("invoice.pdf", "documents/invoice.pdf")
  const invoice = await database.query.invoices.findFirst()

  if (!invoice) throw new Error("Expected the demo seed to create an invoice")

  await database.update(invoices).set({ pdfUploadId: uploadId }).where(eq(invoices.id, invoice.id))

  return uploadId
}

async function createUpload(filename: string, path: string): Promise<string> {
  const [row] = await database
    .insert(uploads)
    .values({
      filename,
      path,
      mimeType: "application/octet-stream",
      sizeBytes: 1024,
      checksumSha256: "a".repeat(64)
    })
    .returning({ id: uploads.id })

  if (!row) throw new Error("Expected the upload insert to return a row")

  return row.id
}

async function getSettings(): Promise<typeof settings.$inferSelect> {
  const settingsRow = await database.query.settings.findFirst()

  if (!settingsRow) throw new Error("Expected the demo seed to create a settings row")

  return settingsRow
}

async function rowExists(
  table: typeof templates | typeof uploads,
  id: string | null
): Promise<boolean> {
  if (!id) return false

  const [row] = await database.select({ value: count() }).from(table).where(eq(table.id, id))

  return (row?.value ?? 0) > 0
}

async function tableCount(table: CountableTable): Promise<number> {
  const [row] = await database.select({ value: count() }).from(table)

  return row?.value ?? 0
}
