import { createHash } from "node:crypto"

import { faker } from "@faker-js/faker"

import { DEFAULT_DEMO_SEED_SIZE } from "./inventory"
import {
  buildSeedSizeProfile,
  hasSeedCountOverrides,
  marketProfileAt,
  postalCodeForMarket,
  type DemoSeedSizeProfile
} from "./profile"
import {
  type DemoClientContactRow,
  type DemoClientRow,
  type DemoContractRow,
  type DemoCreditNoteRow,
  type DemoExpenseRow,
  type DemoInvoiceRow,
  type DemoLeadRow,
  type DemoLineItemRow,
  type DemoPaymentRow,
  type DemoProjectRow,
  type DemoProposalRow,
  type DemoRecurringInvoiceRow,
  type DemoSeedCountOverrides,
  type DemoSeedPlan,
  type DemoSeedSize,
  type DemoSettingsRow,
  type DemoTaskRow,
  type DemoTaxRateRow,
  type DemoTimeEntryRow,
  type ReseedTableCounts
} from "./types"

const DAY_MS = 24 * 60 * 60 * 1000
const BASE_YEAR = 2026

export function buildDemoSeedPlan(
  seed: number,
  ownerUserId: string,
  size: DemoSeedSize = DEFAULT_DEMO_SEED_SIZE,
  countOverrides: DemoSeedCountOverrides = {}
): DemoSeedPlan {
  const baseDate = getBaseDate(seed)
  const profile = buildSeedSizeProfile(size, countOverrides)
  const planSize: DemoSeedPlan["size"] = hasSeedCountOverrides(countOverrides) ? "custom" : size

  faker.seed(seed)
  faker.setDefaultRefDate(baseDate)

  const createdAt = timestamp(baseDate, -45)
  const updatedAt = timestamp(baseDate, -2)

  const settings = buildSettings(seed, createdAt, updatedAt, profile)
  const taxRates = buildTaxRates(seed, createdAt, updatedAt)
  const clients = buildClients(seed, createdAt, updatedAt, profile)
  const clientContacts = buildClientContacts(seed, clients, createdAt, updatedAt)
  const projects = buildProjects(seed, clients, baseDate, createdAt, updatedAt, profile)
  const tasks = buildTasks(seed, projects, baseDate, createdAt, updatedAt, profile)
  const timeEntries = buildTimeEntries(
    seed,
    ownerUserId,
    projects,
    tasks,
    baseDate,
    createdAt,
    updatedAt,
    profile
  )
  const expenses = buildExpenses(seed, clients, projects, baseDate, createdAt, updatedAt)
  const leads = buildLeads(seed, clients, baseDate, createdAt, updatedAt, profile)
  const proposals = buildProposals(seed, projects, baseDate, createdAt, updatedAt, profile)
  const invoices = buildInvoices(
    seed,
    clients,
    projects,
    proposals,
    baseDate,
    createdAt,
    updatedAt,
    profile
  )
  const creditNotes = buildCreditNotes(seed, invoices, baseDate, createdAt, updatedAt, profile)
  const lineItems = buildLineItems(
    seed,
    taxRates,
    proposals,
    invoices,
    creditNotes,
    timeEntries,
    expenses,
    createdAt,
    updatedAt
  )
  const payments = buildPayments(seed, invoices, baseDate, createdAt, updatedAt)
  const contracts = buildContracts(
    seed,
    clients,
    projects,
    proposals,
    baseDate,
    createdAt,
    updatedAt,
    profile
  )
  const recurringInvoices = buildRecurringInvoices(
    seed,
    clients,
    projects,
    baseDate,
    createdAt,
    updatedAt,
    profile
  )

  return {
    seed,
    size: planSize,
    presetSize: size,
    baseDate,
    settings,
    taxRates,
    leads,
    clients,
    clientContacts,
    projects,
    tasks,
    timeEntries,
    expenses,
    proposals,
    invoices,
    lineItems,
    payments,
    creditNotes,
    contracts,
    recurringInvoices,
    counts: {
      settings: 1,
      tax_rates: taxRates.length,
      leads: leads.length,
      clients: clients.length,
      client_contacts: clientContacts.length,
      projects: projects.length,
      tasks: tasks.length,
      time_entries: timeEntries.length,
      expenses: expenses.length,
      proposals: proposals.length,
      invoices: invoices.length,
      line_items: lineItems.length,
      payments: payments.length,
      credit_notes: creditNotes.length,
      contracts: contracts.length,
      recurring_invoices: recurringInvoices.length
    }
  }
}

export function hasExistingSeedableRows(counts: ReseedTableCounts): boolean {
  return Object.values(counts).some((value) => value > 0)
}

function buildSettings(
  seed: number,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoSettingsRow {
  return {
    id: deterministicUuid(seed, "settings", 0),
    businessName: "Remit Demo Studio",
    businessEmail: "hello@remit-demo.example",
    businessPhone: "+351 21 555 0101",
    businessWebsite: "https://remit-demo.example",
    businessTaxId: "PT-515204883",
    businessAddressLine1: "Avenida da Liberdade 110",
    businessCity: "Lisbon",
    businessPostalCode: "1250-146",
    businessCountry: "PT",
    defaultCurrency: "EUR",
    defaultLocale: "en",
    defaultTimezone: "Europe/Lisbon",
    paymentTermsDays: 30,
    proposalValidityDays: 21,
    defaultNotesInvoice: "Thank you for your business. Payment is due by the date shown above.",
    defaultNotesProposal: "This proposal is valid for 21 days and can be adjusted after review.",
    invoicePrefix: "INV-",
    proposalPrefix: "PROP-",
    creditNotePrefix: "CN-",
    nextInvoiceNumber: profile.invoiceCount + 1,
    nextProposalNumber: profile.proposalCount + 1,
    nextCreditNoteNumber: profile.creditNoteCount + 1,
    numberPaddingWidth: 4,
    emailFromName: "Remit Demo Studio",
    emailFromAddress: "hello@remit-demo.example",
    reminderBeforeDueDays: [3, 0],
    reminderAfterDueDays: [7, 14, 30],
    backupDestination: "local",
    backupCadence: "daily",
    backupRetentionDaily: 7,
    backupRetentionWeekly: 4,
    backupRetentionMonthly: 12,
    createdAt,
    updatedAt
  }
}

function buildTaxRates(seed: number, createdAt: Date, updatedAt: Date): DemoTaxRateRow[] {
  return [
    {
      id: deterministicUuid(seed, "tax-rate", 0),
      name: "Standard VAT",
      percentage: "23.00",
      isDefault: true,
      createdAt,
      updatedAt
    },
    {
      id: deterministicUuid(seed, "tax-rate", 1),
      name: "Reduced VAT",
      percentage: "6.00",
      isDefault: false,
      createdAt,
      updatedAt
    },
    {
      id: deterministicUuid(seed, "tax-rate", 2),
      name: "Zero rated",
      percentage: "0.00",
      isDefault: false,
      createdAt,
      updatedAt
    }
  ]
}

function buildClients(
  seed: number,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoClientRow[] {
  return Array.from({ length: profile.clientCount }, (_, index) => {
    const market = marketProfileAt(index)
    const name = faker.company.name()
    const slug = faker.helpers.slugify(name).toLowerCase()

    return {
      id: deterministicUuid(seed, "client", index),
      name,
      email:
        profile.clientCount > 6
          ? `billing-${String(index + 1).padStart(4, "0")}@${slug}.example`
          : `billing@${slug}.example`,
      phone: `${market.phonePrefix} 555 ${String(1000 + faker.number.int({ min: 0, max: 8999 })).padStart(4, "0")}`,
      website: `https://${slug}.example`,
      taxId: `${market.taxId}-${faker.string.numeric(market.taxId === "US" ? 9 : 8)}`,
      addressLine1: faker.location.streetAddress(),
      city: market.city,
      state: market.state,
      postalCode: postalCodeForMarket(market.postalCodeFormat),
      country: market.country,
      currency: market.currency,
      locale: market.locale,
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

// Three per client: the person who approves, the person who signs, and the person in finance who
// pays. Only the first is primary, so `uq_client_contacts_primary` is exercised by the seed rather
// than only by a test.
const CONTACT_ROLES = ["Primary", "Signatory", "Finance"] as const

function buildClientContacts(
  seed: number,
  clients: DemoClientRow[],
  createdAt: Date,
  updatedAt: Date
): DemoClientContactRow[] {
  return clients.flatMap((client, clientIndex) =>
    CONTACT_ROLES.map((role, roleIndex) => {
      const domain = client.email.split("@")[1] ?? "example.com"
      const firstName = faker.person.firstName()
      const lastName = faker.person.lastName()

      return {
        id: deterministicUuid(
          seed,
          "client-contact",
          clientIndex * CONTACT_ROLES.length + roleIndex
        ),
        clientId: client.id,
        name: `${firstName} ${lastName}`,
        email: `${firstName}.${lastName}@${domain}`.toLowerCase(),
        phone: client.phone,
        role,
        isPrimary: roleIndex === 0,
        createdAt: timestamp(createdAt, clientIndex),
        updatedAt
      }
    })
  )
}

function buildProjects(
  seed: number,
  clients: DemoClientRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoProjectRow[] {
  const statuses: DemoProjectRow["status"][] = [
    "active",
    "active",
    "completed",
    "on_hold",
    "cancelled"
  ]
  const rows: DemoProjectRow[] = []
  let clientIndex = 0

  while (rows.length < profile.projectCount) {
    const client = clients[clientIndex % clients.length]

    if (!client) break

    const rowIndex = rows.length
    const status = statuses[rowIndex % statuses.length]
    const startDate = dateOnly(baseDate, -150 + rowIndex * 12)
    const endDate =
      status === "completed" || status === "cancelled" ? dateOnly(startDate, 56) : null

    rows.push({
      id: deterministicUuid(seed, "project", rowIndex),
      clientId: client.id,
      name: projectName(client.name, rowIndex),
      description: faker.company.catchPhrase(),
      status,
      currency: client.currency,
      budgetCents: 450_000 + rowIndex * 85_000,
      hourlyRateCents: 9_500 + (rowIndex % 4) * 1_500,
      startDate,
      endDate,
      createdAt: timestamp(createdAt, rowIndex),
      updatedAt
    })
    clientIndex += 1
  }

  return rows
}

function buildTasks(
  seed: number,
  projects: DemoProjectRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoTaskRow[] {
  const titles = [
    "Discovery workshop",
    "Wireframe review",
    "Implementation sprint",
    "Launch checklist"
  ]
  const statuses: DemoTaskRow["status"][] = ["done", "in_progress", "todo", "backlog"]
  const priorities: DemoTaskRow["priority"][] = ["normal", "high", "normal", "low"]

  return projects.flatMap((project, projectIndex) =>
    Array.from({ length: profile.tasksPerProject }, (_, taskIndex) => {
      const rowIndex = projectIndex * profile.tasksPerProject + taskIndex
      const status = statuses[(projectIndex + taskIndex) % statuses.length]

      return {
        id: deterministicUuid(seed, "task", rowIndex),
        projectId: project.id,
        title: titles[(projectIndex + taskIndex) % titles.length] ?? "Project task",
        description: faker.lorem.sentence({ min: 6, max: 10 }),
        status,
        priority: priorities[(projectIndex + taskIndex) % priorities.length] ?? "normal",
        dueAt: status === "done" ? null : timestamp(baseDate, 5 + rowIndex),
        completedAt: status === "done" ? timestamp(baseDate, -12 + rowIndex) : null,
        position: taskIndex,
        hourlyRateCents: project.hourlyRateCents,
        createdAt: timestamp(createdAt, rowIndex),
        updatedAt
      }
    })
  )
}

function buildTimeEntries(
  seed: number,
  ownerUserId: string,
  projects: DemoProjectRow[],
  tasks: DemoTaskRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoTimeEntryRow[] {
  return projects.flatMap((project, projectIndex) =>
    Array.from({ length: profile.timeEntriesPerProject }, (_, entryIndex) => {
      const rowIndex = projectIndex * profile.timeEntriesPerProject + entryIndex
      const durationSeconds = (2 + ((projectIndex + entryIndex) % 4)) * 3_600
      const startedAt = timestamp(baseDate, -30 + rowIndex, 9 + entryIndex)
      const task = tasks.find((candidate) => candidate.projectId === project.id) ?? null

      return {
        id: deterministicUuid(seed, "time-entry", rowIndex),
        projectId: project.id,
        taskId: entryIndex === 0 ? (task?.id ?? null) : null,
        userId: ownerUserId,
        startedAt,
        endedAt: new Date(startedAt.getTime() + durationSeconds * 1000),
        durationSeconds,
        billable: project.status !== "cancelled",
        hourlyRateSnapshotCents: project.hourlyRateCents,
        description: timeEntryDescription(rowIndex),
        source: "manual",
        createdAt: timestamp(createdAt, rowIndex),
        updatedAt
      }
    })
  )
}

function buildExpenses(
  seed: number,
  clients: DemoClientRow[],
  projects: DemoProjectRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date
): DemoExpenseRow[] {
  const categories = ["Software", "Travel", "Research", "Hosting", "Contractor"]

  return projects.map((project, index) => {
    const client = clients.find((candidate) => candidate.id === project.clientId)
    const amountCents = 4_500 + (index % 6) * 3_250

    return {
      id: deterministicUuid(seed, "expense", index),
      projectId: project.id,
      clientId: project.clientId,
      amountCents,
      currency: project.currency,
      category: categories[index % categories.length] ?? "Software",
      description: `${faker.commerce.productName()} subscription`,
      spentAt: dateOnly(baseDate, -42 + index * 3),
      rebillable: Boolean(client) && index % 3 === 0,
      markupPercentage: index % 3 === 0 ? "10.00" : null,
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

function buildLeads(
  seed: number,
  clients: DemoClientRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoLeadRow[] {
  const statuses: DemoLeadRow["status"][] = [
    "new",
    "contacted",
    "qualified",
    "proposal_sent",
    "lost",
    "won"
  ]

  return Array.from({ length: profile.leadCount }, (_, index) => {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    const status = statuses[index % statuses.length] ?? "new"
    const wonClient = status === "won" ? clients[0] : null

    return {
      id: deterministicUuid(seed, "lead", index),
      firstName,
      lastName,
      company: faker.company.name(),
      email: faker.internet.email({ firstName, lastName, provider: "example" }).toLowerCase(),
      phone: faker.phone.number({ style: "international" }),
      source:
        ["Referral", "Website", "Conference", "LinkedIn", "Partner", "Newsletter"][index] ??
        "Referral",
      status,
      notes: faker.lorem.sentence({ min: 8, max: 14 }),
      convertedAt: wonClient ? timestamp(baseDate, -18) : null,
      convertedToClientId: wonClient?.id ?? null,
      lostReason: status === "lost" ? "Budget deferred until next quarter" : null,
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

function buildProposals(
  seed: number,
  projects: DemoProjectRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoProposalRow[] {
  const statuses: DemoProposalRow["status"][] = ["draft", "sent", "accepted", "rejected", "sent"]

  return Array.from({ length: profile.proposalCount }, (_, index) => {
    const project = projects[index % projects.length]

    if (!project) {
      throw new Error("Demo seed requires at least one project before proposals are generated.")
    }

    const status = statuses[index % statuses.length] ?? "draft"
    const subtotalCents = 180_000 + index * 55_000
    const taxAmountCents = Math.round(subtotalCents * 0.23)
    const respondedAt =
      status === "accepted" || status === "rejected" ? timestamp(baseDate, -10 + index) : null

    return {
      id: deterministicUuid(seed, "proposal", index),
      projectId: project.id,
      clientId: project.clientId,
      number: `PROP-${String(index + 1).padStart(4, "0")}`,
      status,
      currency: project.currency,
      subtotalCents,
      discountAmountTotalCents: 0,
      taxAmountCents,
      totalCents: subtotalCents + taxAmountCents,
      validUntil: dateOnly(baseDate, 21 + index),
      notes: "Prepared for review; scope can be adjusted before acceptance.",
      publicToken: deterministicToken(seed, "proposal", index),
      viewCount: status === "draft" ? 0 : 2 + index,
      issuedAt: status === "draft" ? null : timestamp(baseDate, -15 + index),
      lockedAt: status === "accepted" ? respondedAt : null,
      respondedAt,
      respondedIp: respondedAt ? `192.0.2.${10 + index}` : null,
      rejectionReason:
        status === "rejected" ? "Timing does not align with the launch window" : null,
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

function buildInvoices(
  seed: number,
  clients: DemoClientRow[],
  projects: DemoProjectRow[],
  proposals: DemoProposalRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoInvoiceRow[] {
  const statuses: DemoInvoiceRow["status"][] = ["draft", "sent", "paid", "sent", "paid", "draft"]

  return Array.from({ length: profile.invoiceCount }, (_, index) => {
    const project = projects[index % projects.length]

    if (!project) {
      throw new Error("Demo seed requires at least one project before invoices are generated.")
    }

    const status = statuses[index % statuses.length] ?? "draft"
    const proposal =
      index === 2 ? (proposals.find((candidate) => candidate.status === "accepted") ?? null) : null
    const subtotalCents = 95_000 + index * 42_500
    const taxAmountCents = Math.round(subtotalCents * 0.23)
    const totalCents = subtotalCents + taxAmountCents
    const paidAt = status === "paid" ? timestamp(baseDate, -5 + index) : null
    const client = clients.find((candidate) => candidate.id === project.clientId)

    return {
      id: deterministicUuid(seed, "invoice", index),
      projectId: project.id,
      clientId: project.clientId,
      proposalId: proposal?.id ?? null,
      number: `INV-${String(index + 1).padStart(4, "0")}`,
      status,
      currency: client?.currency ?? project.currency,
      subtotalCents,
      discountAmountTotalCents: 0,
      taxAmountCents,
      totalCents,
      amountPaidCents: status === "paid" ? totalCents : 0,
      issueDate: dateOnly(baseDate, -20 + index * 4),
      dueDate: dateOnly(baseDate, 10 + index * 4),
      paidAt,
      notes: "Payment by bank transfer is preferred for this demo invoice.",
      publicToken: deterministicToken(seed, "invoice", index),
      viewCount: status === "draft" ? 0 : 1 + index,
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

function buildCreditNotes(
  seed: number,
  invoices: DemoInvoiceRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoCreditNoteRow[] {
  return invoices
    .filter((candidate) => candidate.status === "paid")
    .slice(0, profile.creditNoteCount)
    .map((invoice, index) => ({
      id: deterministicUuid(seed, "credit-note", index),
      invoiceId: invoice.id,
      number: `CN-${String(index + 1).padStart(4, "0")}`,
      reason: "Courtesy adjustment for unused workshop hours",
      currency: invoice.currency,
      subtotalCents: 15_000 + index * 2_500,
      taxAmountCents: Math.round((15_000 + index * 2_500) * 0.23),
      totalCents: 15_000 + index * 2_500 + Math.round((15_000 + index * 2_500) * 0.23),
      issuedAt: timestamp(baseDate, -1 + index),
      createdAt: timestamp(createdAt, index),
      updatedAt
    }))
}

type BuildLineItemInput = Omit<
  DemoLineItemRow,
  "id" | "subtotalCents" | "taxAmountCents" | "totalCents"
> & {
  seed: number
  index: number
}

function buildLineItems(
  seed: number,
  taxRates: DemoTaxRateRow[],
  proposals: DemoProposalRow[],
  invoices: DemoInvoiceRow[],
  creditNotes: DemoCreditNoteRow[],
  timeEntries: DemoTimeEntryRow[],
  expenses: DemoExpenseRow[],
  createdAt: Date,
  updatedAt: Date
): DemoLineItemRow[] {
  const standardTax = taxRates[0]
  const zeroTax = taxRates[2]
  const rows: DemoLineItemRow[] = []

  proposals.forEach((proposal, index) => {
    rows.push(
      buildLineItem({
        seed,
        index: rows.length,
        proposalId: proposal.id,
        invoiceId: null,
        creditNoteId: null,
        taxRateId: standardTax.id,
        position: 0,
        description: "Discovery, planning, and technical direction",
        unit: "project",
        quantity: "1.00",
        unitPriceCents: Math.round(proposal.subtotalCents * 0.55),
        taxPercentageSnapshot: standardTax.percentage,
        sourceTimeEntryId: null,
        sourceExpenseId: null,
        createdAt: timestamp(createdAt, index),
        updatedAt
      }),
      buildLineItem({
        seed,
        index: rows.length + 1,
        proposalId: proposal.id,
        invoiceId: null,
        creditNoteId: null,
        taxRateId: standardTax.id,
        position: 1,
        description: "Implementation and launch support",
        unit: "project",
        quantity: "1.00",
        unitPriceCents: proposal.subtotalCents - Math.round(proposal.subtotalCents * 0.55),
        taxPercentageSnapshot: standardTax.percentage,
        sourceTimeEntryId: null,
        sourceExpenseId: null,
        createdAt: timestamp(createdAt, index),
        updatedAt
      })
    )
  })

  invoices.forEach((invoice, index) => {
    const sourceTimeEntry = timeEntries[index] ?? null
    const sourceExpense =
      expenses.find((expense) => expense.projectId === invoice.projectId) ?? null

    rows.push(
      buildLineItem({
        seed,
        index: rows.length,
        proposalId: null,
        invoiceId: invoice.id,
        creditNoteId: null,
        taxRateId: standardTax.id,
        position: 0,
        description: "Professional services",
        unit: "hours",
        quantity: "8.00",
        unitPriceCents: Math.round(invoice.subtotalCents * 0.75) / 8,
        taxPercentageSnapshot: standardTax.percentage,
        sourceTimeEntryId: sourceTimeEntry?.id ?? null,
        sourceExpenseId: null,
        createdAt: timestamp(createdAt, index),
        updatedAt
      }),
      buildLineItem({
        seed,
        index: rows.length + 1,
        proposalId: null,
        invoiceId: invoice.id,
        creditNoteId: null,
        taxRateId: zeroTax.id,
        position: 1,
        description: "Reimbursable tools and hosting",
        unit: "item",
        quantity: "1.00",
        unitPriceCents: invoice.subtotalCents - Math.round(invoice.subtotalCents * 0.75),
        taxPercentageSnapshot: zeroTax.percentage,
        sourceTimeEntryId: null,
        sourceExpenseId: sourceExpense?.id ?? null,
        createdAt: timestamp(createdAt, index),
        updatedAt
      })
    )
  })

  creditNotes.forEach((creditNote) => {
    rows.push(
      buildLineItem({
        seed,
        index: rows.length,
        proposalId: null,
        invoiceId: null,
        creditNoteId: creditNote.id,
        taxRateId: standardTax.id,
        position: 0,
        description: "Unused workshop hours adjustment",
        unit: "hours",
        quantity: "2.00",
        unitPriceCents: 7_500,
        taxPercentageSnapshot: standardTax.percentage,
        sourceTimeEntryId: null,
        sourceExpenseId: null,
        createdAt,
        updatedAt
      })
    )
  })

  return rows
}

function buildLineItem(input: BuildLineItemInput): DemoLineItemRow {
  const quantity = Number(input.quantity)
  const taxPercentage = Number(input.taxPercentageSnapshot)
  const subtotalCents = Math.round(quantity * input.unitPriceCents)
  const taxAmountCents = Math.round((subtotalCents * taxPercentage) / 100)

  return {
    id: deterministicUuid(input.seed, "line-item", input.index),
    proposalId: input.proposalId,
    invoiceId: input.invoiceId,
    creditNoteId: input.creditNoteId,
    taxRateId: input.taxRateId,
    position: input.position,
    description: input.description,
    unit: input.unit,
    quantity: input.quantity,
    unitPriceCents: Math.round(input.unitPriceCents),
    taxPercentageSnapshot: input.taxPercentageSnapshot,
    subtotalCents,
    taxAmountCents,
    totalCents: subtotalCents + taxAmountCents,
    sourceTimeEntryId: input.sourceTimeEntryId,
    sourceExpenseId: input.sourceExpenseId,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  }
}

function buildPayments(
  seed: number,
  invoices: DemoInvoiceRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date
): DemoPaymentRow[] {
  return invoices
    .filter((invoice) => invoice.status === "paid")
    .map((invoice, index) => ({
      id: deterministicUuid(seed, "payment", index),
      invoiceId: invoice.id,
      method: index % 2 === 0 ? "bank_transfer" : "cash",
      amountCents: invoice.totalCents,
      currency: invoice.currency,
      paidAt: timestamp(baseDate, -5 + index),
      reference: `DEMO-PAY-${String(index + 1).padStart(3, "0")}`,
      notes: "Demo payment recorded manually.",
      createdAt: timestamp(createdAt, index),
      updatedAt
    }))
}

function buildContracts(
  seed: number,
  clients: DemoClientRow[],
  projects: DemoProjectRow[],
  proposals: DemoProposalRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoContractRow[] {
  const statuses: DemoContractRow["status"][] = ["sent", "draft", "signed", "expired"]

  return projects.slice(0, profile.contractCount).map((project, index) => {
    const client = clients.find((candidate) => candidate.id === project.clientId)
    const proposal = proposals[index] ?? null
    const status = statuses[index % statuses.length] ?? "draft"

    return {
      id: deterministicUuid(seed, "contract", index),
      projectId: project.id,
      clientId: project.clientId,
      proposalId: proposal?.id ?? null,
      number: `CTR-${String(index + 1).padStart(4, "0")}`,
      title: `${client?.name ?? "Client"} service agreement`,
      status,
      blocks: [
        { type: "heading", text: "Scope of work" },
        {
          type: "paragraph",
          text: "The consultant will provide the services described in the approved proposal."
        }
      ],
      publicToken: deterministicToken(seed, "contract", index),
      issuedAt: status === "draft" ? null : timestamp(baseDate, -8 + index),
      effectiveFrom: dateOnly(baseDate, -7 + index),
      effectiveUntil: dateOnly(baseDate, 90 + index * 30),
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

function buildRecurringInvoices(
  seed: number,
  clients: DemoClientRow[],
  projects: DemoProjectRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoRecurringInvoiceRow[] {
  const names = ["Monthly advisory retainer", "Quarterly reporting package", "Weekly support block"]
  const cadences: DemoRecurringInvoiceRow["cadence"][] = ["monthly", "quarterly", "weekly"]
  const statuses: DemoRecurringInvoiceRow["status"][] = ["active", "paused", "active", "completed"]

  return clients.slice(0, profile.recurringInvoiceCount).map((client, index) => {
    const project = projects.find((candidate) => candidate.clientId === client.id) ?? null
    const cadence = cadences[index % cadences.length] ?? "monthly"
    const status = statuses[index % statuses.length] ?? "active"

    return {
      id: deterministicUuid(seed, "recurring-invoice", index),
      clientId: client.id,
      projectId: project?.id ?? null,
      name: names[index % names.length] ?? "Monthly advisory retainer",
      status,
      cadence,
      cadenceDay: 1,
      nextRunAt: dateOnly(baseDate, 14 + index * 30),
      lastRunAt: index === 0 ? dateOnly(baseDate, -16) : null,
      occurrencesGenerated: index === 0 ? 3 : 1,
      autoSend: false,
      currency: client.currency,
      lineItemsBlueprint: [
        {
          description: "Retainer services",
          quantity: "1.00",
          unitPriceCents: index === 0 ? 240_000 : 390_000
        }
      ],
      includedHours: index === 0 ? 12 : null,
      overageRateCents: index === 0 ? 12_500 : null,
      notes: "Demo recurring invoice schedule.",
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

function getBaseDate(seed: number): Date {
  const offsetDays = seed % 365

  return new Date(Date.UTC(BASE_YEAR, 0, 1 + offsetDays, 12, 0, 0, 0))
}

function timestamp(date: Date, offsetDays: number, hour = 12): Date {
  const next = new Date(date.getTime() + offsetDays * DAY_MS)

  return new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), hour, 0, 0, 0)
  )
}

function dateOnly(date: Date, offsetDays: number): Date {
  const next = new Date(date.getTime() + offsetDays * DAY_MS)

  return new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), 0, 0, 0, 0)
  )
}

function deterministicUuid(seed: number, namespace: string, index: number): string {
  const bytes = Buffer.from(
    createHash("sha256").update(`${seed}:${namespace}:${index}`).digest().subarray(0, 16)
  )

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = bytes.toString("hex")

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// Derived from the seed rather than generated with `randomBytes`, which is what `security.md`
// requires of every real public token. Demo rows must come out byte-identical for a given seed,
// the contract `docs/architecture/operations/CLI-CONTRACT.md` states for `remit:seed-demo`, and a
// random token would break it. These tokens are therefore guessable and belong only to demo data.
function deterministicToken(seed: number, namespace: string, index: number): string {
  return createHash("sha256").update(`remit-demo:${seed}:${namespace}:${index}`).digest("base64url")
}

function projectName(clientName: string, index: number): string {
  const suffixes = [
    "client portal refresh",
    "billing automation rollout",
    "analytics dashboard",
    "brand operations sprint",
    "retainer support"
  ]

  return `${clientName} ${suffixes[index % suffixes.length]}`
}

function timeEntryDescription(index: number): string {
  const descriptions = [
    "Mapped invoice workflow edge cases",
    "Prepared client review notes",
    "Implemented dashboard data cleanup",
    "Reviewed launch blockers",
    "Refined proposal scope",
    "Documented handoff tasks"
  ]

  return descriptions[index % descriptions.length] ?? "Completed project work"
}
