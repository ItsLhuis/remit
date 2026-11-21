import { eq } from "drizzle-orm"

import { on } from "@/lib/events"

import { database } from "@/database"
import { expenses } from "@/database/schema"

import { type ActivityRecord, record } from "./record"

export function subscribeExpenseActivity(): void {
  on("expense.created", ({ expenseId }) =>
    record("expense.created", () => buildExpenseCreated(expenseId))
  )
}

async function buildExpenseCreated(expenseId: string): Promise<ActivityRecord | null> {
  const row = await database.query.expenses.findFirst({
    where: eq(expenses.id, expenseId),
    columns: { category: true }
  })

  if (!row) return null

  return {
    entityType: "expense",
    entityId: expenseId,
    action: "created",
    messageKey: "activity.messages.expenseCreated",
    messageArgs: { category: row.category }
  }
}
