import { pathToFileURL } from "node:url"

import { createRequire } from "node:module"

import * as p from "@clack/prompts"

import chalk from "chalk"

import { count, eq } from "drizzle-orm"
import { type PgTable } from "drizzle-orm/pg-core"

import {
  DEFAULT_DEMO_SEED,
  DEFAULT_DEMO_SEED_SIZE,
  DEMO_SEED_SIZES,
  MAX_DEMO_SEED_CLIENTS,
  MAX_DEMO_SEED_INVOICES,
  MAX_DEMO_SEED_PROJECTS,
  type DemoSeedPlan,
  type ReseedTableCounts,
  type SeedDemoCliOptions,
  type SeedDemoRowCounts,
  SEED_INVENTORY,
  buildDemoSeedPlan,
  hasExistingSeedableRows,
  parseSeedDemoArgs
} from "./_lib/seed-demo"

const require = createRequire(import.meta.url)

const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")
type SeedDatabase = Pick<Database, "delete" | "insert" | "query" | "select" | "update">

type RunSeedDemoResult = {
  counts: SeedDemoRowCounts
  existingRows: ReseedTableCounts
  plan: DemoSeedPlan
  settingsAction: SettingsAction
  wrote: boolean
}

type SettingsAction = "created" | "updated" | "unchanged"

const INSERT_BATCH_SIZE = 500

class SeedDemoError extends Error {}

async function main(): Promise<void> {
  const parsed = parseSeedDemoArgs(process.argv.slice(2))

  if ("error" in parsed) {
    console.error(parsed.error)
    console.log("")
    console.log(getSeedDemoHelpText())
    process.exit(1)
  }

  if (parsed.data.help) {
    console.log(getSeedDemoHelpText())
    process.exit(0)
  }

  p.intro("Remit demo data seed")

  const [{ database, client }, schema] = await Promise.all([
    import("@/database"),
    import("@/database/schema")
  ])

  try {
    const result = await runSeedDemo(database, schema, parsed.data)

    if (parsed.data.dryRun) {
      p.note(
        [
          `Seed: ${result.plan.seed}`,
          formatSeedSizeLine(result.plan),
          `Base date: ${result.plan.baseDate.toISOString()}`,
          "",
          formatSettingsStatus(result.settingsAction),
          "",
          formatPlannedSummary(result.plan),
          "",
          formatSamplePreview(result.plan)
        ].join("\n"),
        "Dry run"
      )

      if (hasExistingSeedableRows(result.existingRows)) {
        p.note(formatExistingRowsList(result.existingRows), "Existing seedable rows")
      }

      p.outro("Dry run complete. No database writes were made.")
      process.exit(0)
    }

    p.outro(`Demo seed complete.\n${formatWrittenSummary(result.counts, result.settingsAction)}`)
    process.exit(0)
  } finally {
    await client.end()
  }
}

export async function runSeedDemo(
  database: Database,
  schema: Schema,
  options: SeedDemoCliOptions
): Promise<RunSeedDemoResult> {
  const ownerUserId = await getOwnerUserId(database, schema)
  const plan = buildDemoSeedPlan(options.seed, ownerUserId, options.size, options.countOverrides)
  const existingRows = await countExistingSeedableRows(database, schema)
  const settingsAction = await getSettingsAction(database, plan)

  if (options.dryRun) {
    return {
      counts: zeroCounts(),
      existingRows,
      plan,
      settingsAction,
      wrote: false
    }
  }

  if (hasExistingSeedableRows(existingRows) && !options.reseed) {
    throw new SeedDemoError(
      `Demo seed refused because these tables already contain rows: ${formatExistingRowsInline(
        existingRows
      )}. Re-run with --reseed to replace demo-seedable domain data.`
    )
  }

  p.note(
    [
      `Seed: ${options.seed}`,
      formatSeedSizeLine(plan),
      "The seed will write deterministic demo rows to the current Remit database.",
      "",
      formatSettingsStatus(settingsAction),
      "",
      formatPlannedSummary(plan)
    ].join("\n"),
    options.reseed ? "Reseed plan" : "Seed plan"
  )

  if (!options.yes) {
    const confirmed = await p.confirm({
      message: options.reseed
        ? "Replace existing demo-seedable domain data and seed fresh demo rows?"
        : "Seed demo data into this instance?",
      initialValue: false
    })

    if (p.isCancel(confirmed)) {
      p.cancel("Demo seed cancelled.")
      process.exit(0)
    }

    if (!confirmed) {
      p.cancel("No changes were made.")
      process.exit(0)
    }
  }

  const spinner = p.spinner()
  spinner.start(options.reseed ? "Replacing demo-seedable domain data..." : "Seeding demo data...")

  try {
    const counts = await database.transaction(async (transaction) => {
      if (options.reseed) {
        await deleteSeedableRows(transaction, schema)
      }

      return insertDemoRows(transaction, schema, plan)
    })

    spinner.stop("Demo data seeded.")

    return {
      counts,
      existingRows,
      plan,
      settingsAction,
      wrote: true
    }
  } catch (error) {
    spinner.stop("Demo seed failed.")
    throw error
  }
}

async function getOwnerUserId(database: SeedDatabase, schema: Schema): Promise<string> {
  const owner = await database.query.members.findFirst({
    where: eq(schema.members.role, "owner"),
    columns: {
      userId: true
    }
  })

  if (!owner) {
    throw new SeedDemoError(
      "No owner account is set up yet. Complete /register and /setup first, then run pnpm remit:seed-demo again."
    )
  }

  return owner.userId
}

async function getSettingsAction(
  database: SeedDatabase,
  plan: DemoSeedPlan
): Promise<SettingsAction> {
  const existingSettings = await database.query.settings.findFirst()

  if (!existingSettings) return "created"

  return buildSettingsUpdate(existingSettings, plan) ? "updated" : "unchanged"
}

async function countExistingSeedableRows(
  database: SeedDatabase,
  schema: Schema
): Promise<ReseedTableCounts> {
  return {
    tax_rates: await countTable(database, schema.taxRates),
    leads: await countTable(database, schema.leads),
    clients: await countTable(database, schema.clients),
    projects: await countTable(database, schema.projects),
    tasks: await countTable(database, schema.tasks),
    time_entries: await countTable(database, schema.timeEntries),
    expenses: await countTable(database, schema.expenses),
    proposals: await countTable(database, schema.proposals),
    invoices: await countTable(database, schema.invoices),
    line_items: await countTable(database, schema.lineItems),
    payments: await countTable(database, schema.payments),
    credit_notes: await countTable(database, schema.creditNotes),
    contracts: await countTable(database, schema.contracts),
    recurring_invoices: await countTable(database, schema.recurringInvoices)
  }
}

async function countTable(database: SeedDatabase, table: PgTable): Promise<number> {
  const [row] = await database.select({ value: count() }).from(table)

  return row?.value ?? 0
}

function getSeedDemoHelpText(): string {
  const seed = chalk.cyan(String(DEFAULT_DEMO_SEED))
  const command = chalk.bold("pnpm remit:seed-demo")
  const option = (value: string) => chalk.cyan(value)
  const heading = (value: string) => chalk.bold(value)
  const optionLine = (flag: string, description: string) =>
    `  ${option(flag.padEnd(16))} ${description}`

  return [
    heading("Usage"),
    `  ${command} ${option("[--dry-run]")} ${option("[--yes]")} ${option("[--reseed]")} ${option("[--seed <number>]")} ${option("[--size <small|medium|large|clients>]")} ${option("[--clients <number>]")} ${option("[--projects <number>]")} ${option("[--invoices <number>]")} ${option("[--help]")}`,
    "",
    heading("Purpose"),
    "  Populate a configured Remit instance with deterministic demo data.",
    "",
    heading("Options"),
    optionLine("--dry-run", "Preview the plan without writing data."),
    optionLine("--yes", "Skip the interactive confirmation prompt."),
    optionLine("--reseed", "Replace existing demo-seedable domain data."),
    optionLine("--seed <number>", `Deterministic seed. Default: ${seed}.`),
    optionLine(
      "--size <value>",
      `Preset size or client count. Presets: ${DEMO_SEED_SIZES.join(", ")}. Default: ${chalk.cyan(
        DEFAULT_DEMO_SEED_SIZE
      )}.`
    ),
    optionLine("--clients <number>", `Override client count. Max: ${MAX_DEMO_SEED_CLIENTS}.`),
    optionLine("--projects <number>", `Override project count. Max: ${MAX_DEMO_SEED_PROJECTS}.`),
    optionLine("--invoices <number>", `Override invoice count. Max: ${MAX_DEMO_SEED_INVOICES}.`),
    optionLine("--help", "Print this help text."),
    "",
    heading("Seed Inventory"),
    formatSeedInventoryHelp()
  ].join("\n")
}

function formatSeedInventoryHelp(): string {
  const seeded = SEED_INVENTORY.filter((item) => item.decision === "seed")
  const skipped = SEED_INVENTORY.filter((item) => item.decision === "skip")
  const deferred = SEED_INVENTORY.filter((item) => item.decision === "wait-for-feature")

  return [
    `  ${chalk.green("seed")}`,
    ...seeded.map(formatSeedInventoryItem),
    "",
    `  ${chalk.yellow("skip")}`,
    ...skipped.map(formatSeedInventoryItem),
    "",
    `  ${chalk.gray("wait-for-feature")}`,
    ...deferred.map(formatSeedInventoryItem)
  ].join("\n")
}

function formatSeedInventoryItem(item: (typeof SEED_INVENTORY)[number]): string {
  const label = formatSeedInventoryLabel(item.table)

  return `    ${chalk.bold(label.padEnd(24))} ${formatSeedInventoryReason(item)}`
}

function formatSeedInventoryLabel(table: string): string {
  if (table === "users/accounts/sessions/verifications/two_factors") {
    return "auth tables"
  }

  if (table === "organizations/members/invitations") {
    return "organization tables"
  }

  return table
}

function formatSeedInventoryReason(item: (typeof SEED_INVENTORY)[number]): string {
  if (item.table === "users/accounts/sessions/verifications/two_factors") {
    return "Better Auth-owned: users, accounts, sessions, verifications, two_factors"
  }

  if (item.table === "organizations/members/invitations") {
    return "Better Auth-owned: organizations, members, invitations"
  }

  return item.reason
}

function formatSettingsStatus(action: SettingsAction): string {
  const label = chalk.bold("Settings")

  if (action === "created") {
    return `${label}: will create one business profile row.`
  }

  if (action === "updated") {
    return `${label}: will fill missing business profile fields on the existing row.`
  }

  return `${label}: existing business profile will be preserved.`
}

function formatSeedSizeLine(plan: DemoSeedPlan): string {
  if (plan.size !== "custom") {
    return `Size: ${plan.size}`
  }

  return `Size: custom (preset: ${plan.presetSize})`
}

function formatPlannedSummary(plan: DemoSeedPlan): string {
  return [
    chalk.bold("Will create"),
    `  Business setup: ${plan.counts.tax_rates} tax rates`,
    `  Pipeline: ${plan.counts.leads} leads, ${plan.counts.clients} clients, ${plan.counts.projects} projects, ${plan.counts.tasks} tasks`,
    `  Work: ${plan.counts.time_entries} time entries, ${plan.counts.expenses} expenses`,
    `  Billing docs: ${plan.counts.proposals} proposals, ${plan.counts.invoices} invoices, ${plan.counts.line_items} line items`,
    `  Billing money: ${plan.counts.payments} payments, ${plan.counts.credit_notes} credit note`,
    `  Agreements: ${plan.counts.contracts} contracts, ${plan.counts.recurring_invoices} recurring invoice schedules`
  ].join("\n")
}

function formatSamplePreview(plan: DemoSeedPlan): string {
  const client = plan.clients[0]
  const project = plan.projects[0]
  const invoice = plan.invoices[0]
  const timeEntry = plan.timeEntries[0]
  const expense = plan.expenses[0]

  if (!client || !project || !invoice || !timeEntry || !expense) {
    return "Sample preview unavailable."
  }

  return [
    chalk.bold("Sample preview"),
    `  Client: ${client.name} - ${client.email} - ${client.currency} - ${client.locale}`,
    `  Project: ${project.name} - ${project.status} - ${formatMoney(
      project.budgetCents,
      project.currency,
      client.locale
    )} budget`,
    `  Invoice: ${invoice.number} - ${invoice.status} - ${formatMoney(
      invoice.totalCents,
      invoice.currency,
      client.locale
    )} due ${formatDate(invoice.dueDate, client.locale)}`,
    `  Time: ${formatDuration(timeEntry.durationSeconds)} on ${formatDate(
      timeEntry.startedAt,
      client.locale
    )} - ${timeEntry.description}`,
    `  Expense: ${expense.category} - ${formatMoney(
      expense.amountCents,
      expense.currency,
      client.locale
    )} - ${expense.rebillable ? "rebillable" : "internal"}`
  ].join("\n")
}

function formatWrittenSummary(counts: SeedDemoRowCounts, settingsAction: SettingsAction): string {
  return [
    `Settings: ${settingsAction}.`,
    `Created ${counts.tax_rates} tax rates, ${counts.leads} leads, ${counts.clients} clients, ${counts.projects} projects, and ${counts.tasks} tasks.`,
    `Created ${counts.time_entries} time entries, ${counts.expenses} expenses, ${counts.proposals} proposals, ${counts.invoices} invoices, ${counts.payments} payments, ${counts.credit_notes} credit note, ${counts.contracts} contracts, and ${counts.recurring_invoices} recurring schedules.`
  ].join("\n")
}

function formatExistingRowsInline(counts: ReseedTableCounts): string {
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([table, value]) => `${table} (${value})`)
    .join(", ")
}

function formatExistingRowsList(counts: ReseedTableCounts): string {
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([table, value]) => `  ${table}: ${value}`)
    .join("\n")
}

function formatMoney(amountCents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency
  }).format(amountCents / 100)
}

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(date)
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`

  return `${hours}h ${minutes}m`
}

async function deleteSeedableRows(database: SeedDatabase, schema: Schema): Promise<void> {
  await database.delete(schema.contractSignatures)
  await database.delete(schema.proposalOtps)
  await database.delete(schema.lineItems)
  await database.delete(schema.payments)
  await database.delete(schema.creditNotes)
  await database.delete(schema.contracts)
  await database.delete(schema.invoices)
  await database.delete(schema.proposals)
  await database.delete(schema.recurringInvoices)
  await database.delete(schema.expenses)
  await database.delete(schema.timeEntries)
  await database.delete(schema.tasks)
  await database.delete(schema.projects)
  await database.delete(schema.leads)
  await database.delete(schema.clients)
  await database.delete(schema.taxRates)
}

async function insertDemoRows(
  database: SeedDatabase,
  schema: Schema,
  plan: DemoSeedPlan
): Promise<SeedDemoRowCounts> {
  const counts = zeroCounts()
  // Authoritative settings read inside the transaction. The pre-transaction read in
  // getSettingsAction only drives the plan/preview; this snapshot decides the actual write so a
  // settings row created between planning and writing is still observed. The settings table has no
  // unique constraint, so a concurrent insert cannot raise a unique violation here, and the seed is
  // a single-operator tool, so the narrow read-then-write window is not a practical race.
  const existingSettings = await database.query.settings.findFirst()

  if (existingSettings) {
    // --reseed clears domain data but intentionally preserves the operator's business profile,
    // only filling fields that are still empty. This matches the spec ("populate one business
    // profile if not already present") and avoids reverting profile edits made after the first seed.
    const update = buildSettingsUpdate(existingSettings, plan)

    if (update) {
      await database
        .update(schema.settings)
        .set(update)
        .where(eq(schema.settings.id, existingSettings.id))
      counts.settings = 1
    }
  } else {
    await database.insert(schema.settings).values(plan.settings)
    counts.settings = 1
  }

  for (const rows of chunkRows(plan.taxRates)) {
    await database.insert(schema.taxRates).values(rows)
  }
  for (const rows of chunkRows(plan.clients)) {
    await database.insert(schema.clients).values(rows)
  }
  for (const rows of chunkRows(plan.projects)) {
    await database.insert(schema.projects).values(rows)
  }
  for (const rows of chunkRows(plan.tasks)) {
    await database.insert(schema.tasks).values(rows)
  }
  for (const rows of chunkRows(plan.timeEntries)) {
    await database.insert(schema.timeEntries).values(rows)
  }
  for (const rows of chunkRows(plan.expenses)) {
    await database.insert(schema.expenses).values(rows)
  }
  for (const rows of chunkRows(plan.leads)) {
    await database.insert(schema.leads).values(rows)
  }
  for (const rows of chunkRows(plan.proposals)) {
    await database.insert(schema.proposals).values(rows)
  }
  for (const rows of chunkRows(plan.invoices)) {
    await database.insert(schema.invoices).values(rows)
  }
  for (const rows of chunkRows(plan.creditNotes)) {
    await database.insert(schema.creditNotes).values(rows)
  }
  for (const rows of chunkRows(plan.lineItems)) {
    await database.insert(schema.lineItems).values(rows)
  }
  for (const rows of chunkRows(plan.payments)) {
    await database.insert(schema.payments).values(rows)
  }
  for (const rows of chunkRows(plan.contracts)) {
    await database.insert(schema.contracts).values(rows)
  }
  for (const rows of chunkRows(plan.recurringInvoices)) {
    await database.insert(schema.recurringInvoices).values(rows)
  }

  counts.tax_rates = plan.taxRates.length
  counts.leads = plan.leads.length
  counts.clients = plan.clients.length
  counts.projects = plan.projects.length
  counts.tasks = plan.tasks.length
  counts.time_entries = plan.timeEntries.length
  counts.expenses = plan.expenses.length
  counts.proposals = plan.proposals.length
  counts.invoices = plan.invoices.length
  counts.line_items = plan.lineItems.length
  counts.payments = plan.payments.length
  counts.credit_notes = plan.creditNotes.length
  counts.contracts = plan.contracts.length
  counts.recurring_invoices = plan.recurringInvoices.length

  return counts
}

function chunkRows<Row>(rows: Row[]): Row[][] {
  const chunks: Row[][] = []

  for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
    chunks.push(rows.slice(index, index + INSERT_BATCH_SIZE))
  }

  return chunks
}

type SettingsRow = Awaited<ReturnType<Database["query"]["settings"]["findFirst"]>>
type SettingsUpdate = Partial<Schema["settings"]["$inferInsert"]>

function buildSettingsUpdate(settingsRow: SettingsRow, plan: DemoSeedPlan): SettingsUpdate | null {
  if (!settingsRow) return null

  const update: SettingsUpdate = {}

  if (!settingsRow.businessName) update.businessName = plan.settings.businessName
  if (!settingsRow.businessEmail) update.businessEmail = plan.settings.businessEmail
  if (!settingsRow.businessPhone) update.businessPhone = plan.settings.businessPhone
  if (!settingsRow.businessWebsite) update.businessWebsite = plan.settings.businessWebsite
  if (!settingsRow.businessTaxId) update.businessTaxId = plan.settings.businessTaxId
  if (!settingsRow.businessAddressLine1) {
    update.businessAddressLine1 = plan.settings.businessAddressLine1
  }
  if (!settingsRow.businessCity) update.businessCity = plan.settings.businessCity
  if (!settingsRow.businessPostalCode) update.businessPostalCode = plan.settings.businessPostalCode
  if (!settingsRow.businessCountry) update.businessCountry = plan.settings.businessCountry

  if (Object.keys(update).length === 0) return null

  update.updatedAt = plan.settings.updatedAt

  return update
}

function zeroCounts(): SeedDemoRowCounts {
  return {
    settings: 0,
    tax_rates: 0,
    leads: 0,
    clients: 0,
    projects: 0,
    tasks: 0,
    time_entries: 0,
    expenses: 0,
    proposals: 0,
    invoices: 0,
    line_items: 0,
    payments: 0,
    credit_notes: 0,
    contracts: 0,
    recurring_invoices: 0
  }
}

function isDirectRun(): boolean {
  const scriptPath = process.argv[1]

  return Boolean(scriptPath) && import.meta.url === pathToFileURL(scriptPath).href
}

if (isDirectRun()) {
  main().catch((error: unknown) => {
    p.cancel("Demo seed failed.")

    if (error instanceof SeedDemoError) {
      console.error(error.message)
    } else {
      console.error(error)
    }

    process.exit(1)
  })
}
