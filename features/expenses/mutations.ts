"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress, serializeCsv } from "@/lib/utils"

import { deleteStorageObject } from "@/lib/storage/s3"

import { database } from "@/database"
import { clients, expenses, projects, uploads } from "@/database/schema"

import { emitExpenseCreated } from "./events"
import { getExpenseForEdit, getExpensesDefaults, listExpensesForExport } from "./queries"
import {
  expenseFormSchema,
  expenseIdSchema,
  expenseListQuerySchema,
  updateExpenseSchema,
  type ExpenseFormValues,
  type ExpenseListQuery,
  type ExpenseReceiptValues,
  type UpdateExpenseValues
} from "./schemas"
import { buildExpenseCsvRows } from "./services"
import { type ExpenseFormData } from "./types"

export type ExpenseMutationResult = { data: { expense: ExpenseFormData } } | { error: string }

export type DeleteExpenseResult = { data: { id: string } } | { error: string }

export type ExportExpensesResult =
  | { data: { filename: string; csv: string; rowCount: number } }
  | { error: string }

type ExpenseWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type ExpenseWriteGate = { context: ExpenseWriteContext } | { error: string }

type ExpenseAuditEvent =
  | "expense.created"
  | "expense.updated"
  | "expense.deleted"
  | "expense.exported"

type ExpenseScope = {
  projectId: string | null
  clientId: string | null
}

const expensesPath = "/expenses"

export async function createExpense(input: unknown): Promise<ExpenseMutationResult> {
  const gate = await requireExpenseWrite()

  if ("error" in gate) return gate

  const parsed = expenseFormSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const scope = await resolveExpenseScope(parsed.data)
    const receiptUploadId = await insertReceiptUpload(parsed.data.receipt)

    const [created] = await database
      .insert(expenses)
      .values({
        ...toExpenseColumns(parsed.data, scope),
        receiptUploadId
      })
      .returning({ id: expenses.id })

    if (!created) throw new Error("Expense insert returned no row")

    await writeExpenseAudit(context, "expense.created", created.id, {
      projectId: scope.projectId,
      clientId: scope.clientId,
      amountCents: parsed.data.amount,
      currency: parsed.data.currency,
      rebillable: parsed.data.rebillable,
      hasReceipt: receiptUploadId !== null
    })
    await emitExpenseCreated({
      expenseId: created.id,
      projectId: scope.projectId,
      clientId: scope.clientId,
      userId: context.userId,
      rebillable: parsed.data.rebillable
    })

    revalidatePath(expensesPath)

    return await loadExpenseResult(created.id)
  } catch (error) {
    return handleExpenseError(error, "createExpense", context.userId)
  }
}

export async function updateExpense(input: unknown): Promise<ExpenseMutationResult> {
  const gate = await requireExpenseWrite()

  if ("error" in gate) return gate

  const parsed = updateExpenseSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database
      .select({
        id: expenses.id,
        invoicedInId: expenses.invoicedInId,
        receiptUploadId: expenses.receiptUploadId,
        receiptPath: uploads.path
      })
      .from(expenses)
      .leftJoin(uploads, eq(uploads.id, expenses.receiptUploadId))
      .where(and(eq(expenses.id, parsed.data.id), isNull(expenses.deletedAt)))
      .limit(1)
      .then((rows) => rows[0])

    if (!existing) throw new ExpectedExpenseError(t("expenses.errors.notFound"))

    // An invoiced expense is frozen: its amount and markup are what an invoice line was built from,
    // so editing it here would move a receivable without the invoice ever changing.
    if (existing.invoicedInId) throw new ExpectedExpenseError(t("expenses.errors.alreadyInvoiced"))

    const scope = await resolveExpenseScope(parsed.data)
    const receipt = await resolveReceiptChange(parsed.data.receipt, existing.receiptPath)

    const [updated] = await database
      .update(expenses)
      .set({
        ...toExpenseColumns(parsed.data, scope),
        receiptUploadId: receipt.keepExisting ? existing.receiptUploadId : receipt.uploadId
      })
      .where(and(eq(expenses.id, parsed.data.id), isNull(expenses.deletedAt)))
      .returning({ id: expenses.id })

    if (!updated) throw new ExpectedExpenseError(t("expenses.errors.notFound"))

    // Only once the row no longer points at it: dropping the old upload before the update would
    // leave the expense referencing a deleted row if the update then failed.
    if (!receipt.keepExisting && existing.receiptUploadId) {
      await discardReceiptUpload(existing.receiptUploadId, existing.receiptPath)
    }

    await writeExpenseAudit(context, "expense.updated", updated.id, {
      projectId: scope.projectId,
      clientId: scope.clientId,
      amountCents: parsed.data.amount,
      currency: parsed.data.currency,
      rebillable: parsed.data.rebillable,
      receiptChanged: !receipt.keepExisting
    })

    revalidatePath(expensesPath)

    return await loadExpenseResult(updated.id)
  } catch (error) {
    return handleExpenseError(error, "updateExpense", context.userId, parsed.data.id)
  }
}

export async function softDeleteExpense(input: unknown): Promise<DeleteExpenseResult> {
  const gate = await requireExpenseDelete()

  if ("error" in gate) return gate

  const parsed = expenseIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.expenses.findFirst({
      where: and(eq(expenses.id, parsed.data.id), isNull(expenses.deletedAt)),
      columns: { id: true, projectId: true, clientId: true, invoicedInId: true }
    })

    if (!existing) throw new ExpectedExpenseError(t("expenses.errors.notFound"))

    if (existing.invoicedInId) throw new ExpectedExpenseError(t("expenses.errors.alreadyInvoiced"))

    const [deleted] = await database
      .update(expenses)
      .set({ deletedAt: new Date() })
      .where(and(eq(expenses.id, parsed.data.id), isNull(expenses.deletedAt)))
      .returning({ id: expenses.id })

    if (!deleted) throw new ExpectedExpenseError(t("expenses.errors.notFound"))

    // The receipt object outlives the soft delete on purpose: a soft-deleted expense is restorable
    // in principle, and the file is the only evidence the cost was ever incurred.
    await writeExpenseAudit(context, "expense.deleted", deleted.id, {
      projectId: existing.projectId,
      clientId: existing.clientId,
      softDeleted: true
    })

    revalidatePath(expensesPath)

    return { data: { id: deleted.id } }
  } catch (error) {
    return handleExpenseError(error, "softDeleteExpense", context.userId, parsed.data.id)
  }
}

export async function exportExpensesCsv(input: unknown): Promise<ExportExpensesResult> {
  const gate = await requireExpenseExport()

  if ("error" in gate) return gate

  // The caller hands over the query the page was already rendered from rather than a URL, so the
  // export covers exactly the rows on screen. It is still re-validated here: a server action is
  // reachable by anything that can reach the app, not only by this page.
  const parsed = expenseListQuerySchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const query = parsed.data
  const { context } = gate

  try {
    const defaults = await getExpensesDefaults()
    const rows = await listExpensesForExport(query, defaults.defaultCurrency)

    const csv = serializeCsv(
      buildExpenseCsvRows({
        expenses: rows.map((expense) => ({
          spentAt: expense.spentAt,
          category: expense.category,
          description: expense.description,
          projectName: expense.projectName,
          clientName: expense.clientName,
          amountCents: expense.amountCents,
          currency: expense.currency,
          rebillable: expense.rebillable,
          markupPercentage: expense.markupPercentage,
          invoicedInId: expense.invoicedInId,
          receiptFilename: expense.receipt?.filename ?? null
        })),
        headers: {
          spentAt: t("expenses.export.columns.spentAt"),
          category: t("expenses.export.columns.category"),
          description: t("expenses.export.columns.description"),
          project: t("expenses.export.columns.project"),
          client: t("expenses.export.columns.client"),
          amount: t("expenses.export.columns.amount"),
          currency: t("expenses.export.columns.currency"),
          rebillable: t("expenses.export.columns.rebillable"),
          markupPercentage: t("expenses.export.columns.markupPercentage"),
          rebillableAmount: t("expenses.export.columns.rebillableAmount"),
          invoiced: t("expenses.export.columns.invoiced"),
          receipt: t("expenses.export.columns.receipt")
        },
        booleans: { yes: t("common.status.yes"), no: t("common.status.no") }
      })
    )

    const exportedAt = new Date()

    // Written before the CSV reaches the caller, and never updated afterwards: the audit row is the
    // record that this filtered slice of the instance's spending left the application.
    await writeExpenseAudit(context, "expense.exported", null, {
      rowCount: rows.length,
      exportedAt: exportedAt.toISOString(),
      filters: toFilterSnapshot(query)
    })

    return {
      data: {
        filename: `expenses-${exportedAt.toISOString().slice(0, 10)}.csv`,
        csv,
        rowCount: rows.length
      }
    }
  } catch (error) {
    return handleExportError(error, context.userId)
  }
}

async function requireExpenseWrite(): Promise<ExpenseWriteGate> {
  const gate = await getExpenseActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner" && gate.context.role !== "assistant") {
    return { error: t("errors.forbidden") }
  }

  return gate
}

async function requireExpenseDelete(): Promise<ExpenseWriteGate> {
  const gate = await getExpenseActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner") return { error: t("errors.forbidden") }

  return gate
}

// Deliberately not the same set as the write gate. An export is bulk data egress — every amount,
// client and supplier this instance has recorded, in one file — so it is granted to the roles that
// exist to see the books, not to the assistant role that exists to enter them.
async function requireExpenseExport(): Promise<ExpenseWriteGate> {
  const gate = await getExpenseActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner" && gate.context.role !== "accountant") {
    return { error: t("errors.forbidden") }
  }

  return gate
}

async function getExpenseActionContext(): Promise<ExpenseWriteGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (!isRole(role)) return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

// An expense may hang off a project, off a client, off both, or off neither — a bank fee belongs to
// nobody. When it carries both, the client has to be the project's own: any other pairing would put
// one expense on two different ledgers and make the two filters disagree about who owes it.
async function resolveExpenseScope(values: ExpenseFormValues | UpdateExpenseValues) {
  const project = values.projectId
    ? await database.query.projects.findFirst({
        where: and(eq(projects.id, values.projectId), isNull(projects.deletedAt)),
        columns: { id: true, clientId: true }
      })
    : null

  if (values.projectId && !project) {
    throw new ExpectedExpenseError(t("expenses.errors.projectNotFound"))
  }

  const client = values.clientId
    ? await database.query.clients.findFirst({
        where: and(eq(clients.id, values.clientId), isNull(clients.deletedAt)),
        columns: { id: true }
      })
    : null

  if (values.clientId && !client) {
    throw new ExpectedExpenseError(t("expenses.errors.clientNotFound"))
  }

  if (project && client && project.clientId !== client.id) {
    throw new ExpectedExpenseError(t("expenses.errors.clientProjectMismatch"))
  }

  return { projectId: project?.id ?? null, clientId: client?.id ?? null }
}

function toExpenseColumns(values: ExpenseFormValues | UpdateExpenseValues, scope: ExpenseScope) {
  return {
    projectId: scope.projectId,
    clientId: scope.clientId,
    spentAt: values.spentAt,
    amountCents: values.amount,
    currency: values.currency,
    category: values.category,
    description: values.description,
    rebillable: values.rebillable,
    // `numeric` columns travel as strings in Drizzle; `null` is what "no markup" means, and the
    // schema has already refused a markup on a non-rebillable expense.
    markupPercentage: values.markupPercentage === null ? null : String(values.markupPercentage)
  }
}

async function insertReceiptUpload(receipt: ExpenseReceiptValues | null): Promise<string | null> {
  if (!receipt) return null

  const [created] = await database
    .insert(uploads)
    .values({
      filename: receipt.filename,
      path: receipt.objectKey,
      mimeType: receipt.mimeType,
      sizeBytes: receipt.sizeBytes
    })
    .returning({ id: uploads.id })

  if (!created) throw new Error("Receipt upload insert returned no row")

  return created.id
}

type ReceiptChange = { keepExisting: true } | { keepExisting: false; uploadId: string | null }

// Three cases the form can produce: the same object key it was given (nothing to do), no receipt at
// all (detach), or a key the presign route has just minted (attach the new one). Comparing keys is
// what tells the first case from the third, since the form round-trips the existing key unchanged.
async function resolveReceiptChange(
  receipt: ExpenseReceiptValues | null,
  existingPath: string | null | undefined
): Promise<ReceiptChange> {
  if (receipt && receipt.objectKey === existingPath) return { keepExisting: true }

  if (!receipt && !existingPath) return { keepExisting: true }

  return { keepExisting: false, uploadId: await insertReceiptUpload(receipt) }
}

// Best-effort by design: the expense row is already correct once it stops pointing at this upload,
// and failing the whole action because a stray object survived in the bucket would be a worse
// outcome than the orphan itself. The log line is the only remaining trace when that happens.
async function discardReceiptUpload(
  uploadId: string,
  objectKey: string | null | undefined
): Promise<void> {
  try {
    await database.delete(uploads).where(eq(uploads.id, uploadId))

    if (objectKey) await deleteStorageObject(objectKey)
  } catch (error) {
    logger.error(
      { action: "discardReceiptUpload", uploadId, objectKey, err: error },
      "Expense receipt cleanup failed"
    )
  }
}

function toFilterSnapshot(query: ExpenseListQuery): Record<string, unknown> {
  return {
    search: query.search,
    status: query.status,
    projectIds: query.projectIds,
    clientIds: query.clientIds,
    categories: query.categories,
    currencies: query.currencies,
    rebillable: query.rebillable,
    invoiced: query.invoiced,
    spentFrom: query.spentFrom?.toISOString() ?? null,
    spentTo: query.spentTo?.toISOString() ?? null
  }
}

async function loadExpenseResult(expenseId: string): Promise<ExpenseMutationResult> {
  const expense = await getExpenseForEdit({ id: expenseId })

  if (!expense) throw new ExpectedExpenseError(t("expenses.errors.notFound"))

  return { data: { expense } }
}

async function writeExpenseAudit(
  context: ExpenseWriteContext,
  event: ExpenseAuditEvent,
  expenseId: string | null,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "expense",
    targetEntityId: expenseId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function handleExpenseError(
  error: unknown,
  action: string,
  userId: string | null,
  expenseId?: string
): { error: string } {
  if (error instanceof ExpectedExpenseError) return { error: error.message }

  logger.error({ action, userId, expenseId, err: error }, "Expense action failed")

  return { error: t("expenses.errors.updateFailed") }
}

function handleExportError(error: unknown, userId: string | null): { error: string } {
  logger.error({ action: "exportExpensesCsv", userId, err: error }, "Expense export failed")

  return { error: t("expenses.errors.exportFailed") }
}

function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "accountant" || value === "assistant"
}

class ExpectedExpenseError extends Error {}
