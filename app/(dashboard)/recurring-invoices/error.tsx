"use client"

import { RecurringInvoiceRouteError } from "@/features/recurringInvoices"

type RecurringInvoicesErrorProps = {
  reset: () => void
}

const RecurringInvoicesError = ({ reset }: RecurringInvoicesErrorProps) => {
  return <RecurringInvoiceRouteError reset={reset} />
}

export default RecurringInvoicesError
