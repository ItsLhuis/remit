"use server"

import { revalidatePath } from "next/cache"

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { mintPublicToken } from "@/lib/publicToken"

import { database } from "@/database"
import {
  clients,
  expenses,
  invoices,
  projects,
  tasks,
  taxRates,
  timeEntries
} from "@/database/schema"

import { calculateRebillableCents, listUnbilledExpenses } from "@/features/expenses/server"

import { listUnbilledTimeEntries } from "@/features/timeTracking/server"

import { emitInvoiceCreated, emitInvoiceUpdated } from "./events"
import {
  appendInvoiceLineItems,
  writeInvoiceLineItems,
  type InvoiceLineItemRow,
  type InvoiceTransaction
} from "./invoiceWrites"
import {
  claimInvoiceNumber,
  handleInvoiceActionError,
  loadInvoiceResult,
  requireInvoiceWrite,
  revalidateInvoicePaths,
  writeInvoiceAudit,
  ExpectedInvoiceError
} from "./mutationContext"
import { convertBillableWorkSchema, type ConvertBillableWorkValues } from "./schemas"
import {
  calculateInvoiceTotal,
  planBillableConversion,
  toInvoiceColumnDiscount,
  type BillableConversionPlan,
  type BillableExpenseRow,
  type BillableLineDraft
} from "./services"
import { type InvoiceMutationResult } from "./types"

// The time-and-expense path lives beside mutations.ts for the same reason conversion.ts does: every
// number on the produced lines comes from rows already in the database — a frozen rate snapshot, a
// stored expense amount — never from a submitted form, so the only untrusted input is the id list
// and the two choices the sheet asks for.
export async function convertBillableWork(input: unknown): Promise<InvoiceMutationResult> {
  const gate = await requireInvoiceWrite()

  if ("error" in gate) return gate

  const parsed = convertBillableWorkSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    // Read outside the transaction so a selection that can never be billed — two currencies, two
    // clients, nothing left unbilled — is refused with the message that names the reason before any
    // number is claimed. The transaction below re-derives all of it and is what actually decides.
    const [plan, defaultTaxRate, defaultCurrency] = await Promise.all([
      buildPlan(parsed.data),
      getDefaultTaxRate(),
      getDefaultCurrency()
    ])

    if (plan.outcome !== "billable") throw new ExpectedInvoiceError(toPlanErrorMessage(plan))

    const outcome = await database.transaction(async (transaction) => {
      const confirmed = await confirmPlan(transaction, parsed.data, defaultCurrency)
      const target = await resolveTarget(transaction, parsed.data.targetInvoiceId, confirmed)

      const rows = confirmed.lines.map((line) => toLineItemRow(line, defaultTaxRate))

      const invoiceId =
        target === null
          ? await createBillingInvoice(transaction, confirmed, rows)
          : await appendToBillingInvoice(transaction, target, rows)

      await stampBilled(transaction, invoiceId, confirmed)

      return { invoiceId, isNew: target === null, plan: confirmed }
    })

    await writeInvoiceAudit(
      context,
      outcome.isNew ? "invoice.created" : "invoice.updated",
      outcome.invoiceId,
      {
        clientId: outcome.plan.clientId,
        projectId: outcome.plan.projectId,
        timeEntryCount: outcome.plan.timeEntryIds.length,
        expenseCount: outcome.plan.expenseIds.length,
        lineItemCount: outcome.plan.lines.length
      }
    )

    if (outcome.isNew) {
      await emitInvoiceCreated({
        invoiceId: outcome.invoiceId,
        projectId: outcome.plan.projectId,
        clientId: outcome.plan.clientId,
        userId: context.userId
      })
    } else {
      await emitInvoiceUpdated({
        invoiceId: outcome.invoiceId,
        userId: context.userId,
        changedFields: ["lineItems"]
      })
    }

    revalidateInvoicePaths({
      id: outcome.invoiceId,
      projectId: outcome.plan.projectId,
      clientId: outcome.plan.clientId
    })
    revalidatePath("/time")
    revalidatePath("/expenses")
    revalidatePath("/invoices")

    return await loadInvoiceResult(outcome.invoiceId)
  } catch (error) {
    return handleInvoiceActionError(error, {
      action: "convertBillableWork",
      userId: context.userId,
      fallbackMessage: t("invoices.errors.billableFailed")
    })
  }
}

type ConfirmedPlan = Extract<BillableConversionPlan, { outcome: "billable" }>

type BillingTarget = {
  id: string
  projectId: string | null
  clientId: string | null
}

async function buildPlan(values: ConvertBillableWorkValues): Promise<BillableConversionPlan> {
  const [unbilledTime, unbilledExpenses] = await Promise.all([
    listUnbilledTimeEntries({ ids: values.timeEntryIds }),
    listUnbilledExpenses({ ids: values.expenseIds })
  ])

  return planBillableConversion({
    timeEntries: unbilledTime,
    expenses: unbilledExpenses.map(toBillableExpenseRow),
    grouping: values.grouping,
    hourUnit: t("invoices.billable.hourUnit")
  })
}

// The same reads as features/timeTracking/queries.ts's listUnbilledTimeEntries and
// features/expenses/queries.ts's listUnbilledExpenses, re-issued on the transaction's own handle so
// the rows priced here are the rows this transaction will stamp. They cannot live in those query
// modules: a `queries.ts` read builds on the pooled `database` client and has no way to be handed a
// transaction, and a plan built outside this one is stale by the time it commits.
async function confirmPlan(
  transaction: InvoiceTransaction,
  values: ConvertBillableWorkValues,
  defaultCurrency: string
): Promise<ConfirmedPlan> {
  const [timeRows, expenseRows] = await Promise.all([
    values.timeEntryIds.length === 0
      ? []
      : selectBillableTimeEntries(transaction, values.timeEntryIds),
    values.expenseIds.length === 0 ? [] : selectBillableExpenses(transaction, values.expenseIds)
  ])

  const confirmed = planBillableConversion({
    timeEntries: timeRows.map((row) => ({
      id: row.id,
      clientId: row.clientId,
      projectId: row.projectId,
      projectName: row.projectName,
      taskId: row.taskId,
      taskTitle: row.taskTitle,
      description: row.description ?? "",
      durationSeconds: row.durationSeconds ?? 0,
      hourlyRateSnapshotCents: Number(row.hourlyRateSnapshotCents),
      currency: row.currency ?? defaultCurrency
    })),
    expenses: expenseRows.map(toBillableExpenseRow),
    grouping: values.grouping,
    hourUnit: t("invoices.billable.hourUnit")
  })

  if (confirmed.outcome !== "billable")
    throw new ExpectedInvoiceError(toPlanErrorMessage(confirmed))

  return confirmed
}

function selectBillableTimeEntries(transaction: InvoiceTransaction, ids: string[]) {
  return transaction
    .select({
      id: timeEntries.id,
      clientId: projects.clientId,
      projectId: timeEntries.projectId,
      projectName: projects.name,
      taskId: timeEntries.taskId,
      taskTitle: tasks.title,
      description: timeEntries.description,
      durationSeconds: timeEntries.durationSeconds,
      hourlyRateSnapshotCents: timeEntries.hourlyRateSnapshotCents,
      currency: projects.currency
    })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .leftJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .where(
      and(
        inArray(timeEntries.id, ids),
        eq(timeEntries.billable, true),
        isNull(timeEntries.invoicedInId),
        isNotNull(timeEntries.endedAt),
        isNull(timeEntries.deletedAt),
        isNull(projects.deletedAt)
      )
    )
}

function selectBillableExpenses(transaction: InvoiceTransaction, ids: string[]) {
  return transaction
    .select({
      id: expenses.id,
      clientId: clients.id,
      projectId: expenses.projectId,
      description: expenses.description,
      amountCents: expenses.amountCents,
      markupPercentage: expenses.markupPercentage,
      currency: expenses.currency
    })
    .from(expenses)
    .innerJoin(clients, eq(clients.id, expenses.clientId))
    .where(
      and(
        inArray(expenses.id, ids),
        eq(expenses.rebillable, true),
        isNull(expenses.invoicedInId),
        isNull(expenses.deletedAt),
        isNull(clients.deletedAt)
      )
    )
}

async function resolveTarget(
  transaction: InvoiceTransaction,
  targetInvoiceId: string | null,
  plan: ConfirmedPlan
): Promise<BillingTarget | null> {
  if (targetInvoiceId === null) return null

  const [target] = await transaction
    .select({
      id: invoices.id,
      projectId: invoices.projectId,
      clientId: invoices.clientId,
      currency: invoices.currency,
      status: invoices.status
    })
    .from(invoices)
    .where(and(eq(invoices.id, targetInvoiceId), isNull(invoices.deletedAt)))
    .limit(1)

  // A sent or paid invoice is a document the client has already read, so appending to one would move
  // a total they have seen; the currency and client checks are what stop a target chosen from a
  // stale list from producing an invoice `fk_invoices_project_client` or the currency rule refuses.
  if (
    target?.status !== "draft" ||
    target.currency !== plan.currency ||
    target.clientId !== plan.clientId
  ) {
    throw new ExpectedInvoiceError(t("invoices.errors.billableTargetNotEditable"))
  }

  return { id: target.id, projectId: target.projectId, clientId: target.clientId }
}

async function createBillingInvoice(
  transaction: InvoiceTransaction,
  plan: ConfirmedPlan,
  rows: InvoiceLineItemRow[]
): Promise<string> {
  const number = await claimInvoiceNumber(transaction)
  const totals = calculateInvoiceTotal(rows.map(toLineItemInput), null)

  const [created] = await transaction
    .insert(invoices)
    .values({
      projectId: plan.projectId,
      clientId: plan.clientId,
      number,
      status: "draft",
      currency: plan.currency,
      subtotalCents: totals.subtotalCents,
      discountAmountTotalCents: totals.discountAmountTotalCents,
      taxAmountCents: totals.taxAmountCents,
      totalCents: totals.totalCents,
      publicToken: mintPublicToken()
    })
    .returning({ id: invoices.id })

  if (!created) throw new Error("Billing invoice insert returned no row")

  await writeInvoiceLineItems(transaction, created.id, rows, null)

  return created.id
}

async function appendToBillingInvoice(
  transaction: InvoiceTransaction,
  target: BillingTarget,
  rows: InvoiceLineItemRow[]
): Promise<string> {
  const [current] = await transaction
    .select({
      discountType: invoices.discountType,
      discountPercentage: invoices.discountPercentage,
      discountAmountCents: invoices.discountAmountCents
    })
    .from(invoices)
    .where(eq(invoices.id, target.id))
    .limit(1)

  const discount = toInvoiceColumnDiscount(
    current ?? { discountType: null, discountPercentage: null, discountAmountCents: null }
  )

  const totals = await appendInvoiceLineItems(transaction, target.id, rows, discount)

  await transaction
    .update(invoices)
    .set({
      subtotalCents: totals.subtotalCents,
      discountAmountTotalCents: totals.discountAmountTotalCents,
      taxAmountCents: totals.taxAmountCents,
      totalCents: totals.totalCents,
      updatedAt: new Date()
    })
    .where(eq(invoices.id, target.id))

  return target.id
}

// The double-billing defence, and the only one that holds under a race. The `invoiced_in_id IS NULL`
// predicate is part of the UPDATE rather than a SELECT before it, so a concurrent conversion either
// committed first — and this statement's re-evaluation of the predicate against the new row version
// excludes the row — or is still open, in which case this UPDATE blocks on its row lock and then
// sees the same thing. Either way fewer rows come back than were planned, and the throw rolls the
// whole transaction back with the invoice inside it.
async function stampBilled(
  transaction: InvoiceTransaction,
  invoiceId: string,
  plan: ConfirmedPlan
): Promise<void> {
  if (plan.timeEntryIds.length > 0) {
    const stamped = await transaction
      .update(timeEntries)
      .set({ invoicedInId: invoiceId, updatedAt: new Date() })
      .where(and(inArray(timeEntries.id, plan.timeEntryIds), isNull(timeEntries.invoicedInId)))
      .returning({ id: timeEntries.id })

    if (stamped.length !== plan.timeEntryIds.length) {
      throw new ExpectedInvoiceError(t("invoices.errors.billableAlreadyInvoiced"))
    }
  }

  if (plan.expenseIds.length > 0) {
    const stamped = await transaction
      .update(expenses)
      .set({ invoicedInId: invoiceId, updatedAt: new Date() })
      .where(and(inArray(expenses.id, plan.expenseIds), isNull(expenses.invoicedInId)))
      .returning({ id: expenses.id })

    if (stamped.length !== plan.expenseIds.length) {
      throw new ExpectedInvoiceError(t("invoices.errors.billableAlreadyInvoiced"))
    }
  }
}

async function getDefaultCurrency(): Promise<string> {
  const row = await database.query.settings.findFirst({ columns: { defaultCurrency: true } })

  return row?.defaultCurrency ?? "EUR"
}

async function getDefaultTaxRate(): Promise<{ id: string; percentage: number } | null> {
  const [row] = await database
    .select({ id: taxRates.id, percentage: taxRates.percentage })
    .from(taxRates)
    .where(and(eq(taxRates.isDefault, true), isNull(taxRates.deletedAt)))
    .limit(1)

  return row ? { id: row.id, percentage: Number(row.percentage) } : null
}

// The instance default rate, snapshotted onto every converted line exactly as InvoiceForm.tsx
// already applies it to a hand-written one. An instance with no default rate produces untaxed lines
// rather than an invented percentage, and the line stays editable until the invoice is sent.
function toLineItemRow(
  line: BillableLineDraft,
  defaultTaxRate: { id: string; percentage: number } | null
): InvoiceLineItemRow {
  return {
    taxRateId: defaultTaxRate?.id ?? null,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    discount: { discountType: null, discountPercentage: null, discountAmountCents: null },
    taxPercentage: defaultTaxRate?.percentage ?? 0,
    sourceTimeEntryId: line.sourceTimeEntryId,
    sourceExpenseId: line.sourceExpenseId
  }
}

function toLineItemInput(row: InvoiceLineItemRow) {
  return {
    quantity: row.quantity,
    unitPriceCents: row.unitPriceCents,
    discount: toInvoiceColumnDiscount(row.discount),
    taxPercentage: row.taxPercentage
  }
}

type RebillableExpenseRow = {
  id: string
  clientId: string
  projectId: string | null
  description: string
  amountCents: number | string
  markupPercentage: number | string | null
  currency: string
}

// The markup is applied by the expenses module's own rule rather than re-derived here: two
// implementations of one money rule is how the invoice line and the expense list start disagreeing
// about what the client owes.
function toBillableExpenseRow(expense: RebillableExpenseRow): BillableExpenseRow {
  const amountCents = Number(expense.amountCents)
  const markupPercentage =
    expense.markupPercentage === null ? null : Number(expense.markupPercentage)

  return {
    id: expense.id,
    clientId: expense.clientId,
    projectId: expense.projectId,
    description: expense.description,
    rebillableCents: calculateRebillableCents({
      amountCents,
      rebillable: true,
      markupPercentage
    }),
    descriptionSuffix:
      markupPercentage === null || markupPercentage === 0
        ? null
        : t("invoices.billable.markupSuffix", { percentage: markupPercentage }),
    currency: expense.currency
  }
}

function toPlanErrorMessage(plan: BillableConversionPlan): string {
  switch (plan.outcome) {
    case "currencyMismatch":
      return t("invoices.errors.billableCurrencyMismatch")
    case "clientMismatch":
      return t("invoices.errors.billableClientMismatch")
    case "nothingBillable":
      return t("invoices.errors.billableNothingToBill")
    case "billable":
      return t("invoices.errors.billableFailed")
  }
}
