export {
  createExpense,
  exportExpensesCsv,
  softDeleteExpense,
  updateExpense,
  type DeleteExpenseResult,
  type ExpenseMutationResult,
  type ExportExpensesResult
} from "./mutations"

export {
  getExpenseForEdit,
  getExpensesDefaults,
  getExpensesPageData,
  listExpenses,
  listExpensesForExport,
  listUnbilledExpenses
} from "./queries"

export { emitExpenseCreated } from "./events"

// Also exported from the client-safe `index.ts`, and reachable from a server module without it:
// features/invoices/billing.ts re-prices a re-billable expense inside its own transaction and must
// use the same markup rule the expense list shows, and reaching it through the root barrel would
// drag this feature's whole component graph into a server-only write.
export { calculateRebillableCents, type RebillableExpense } from "./services"
