"use client"

import { RecurringInvoiceRouteError } from "@/features/recurringInvoices"

type RecurringInvoiceDetailErrorProps = {
  reset: () => void
}

const RecurringInvoiceDetailError = ({ reset }: RecurringInvoiceDetailErrorProps) => {
  return <RecurringInvoiceRouteError reset={reset} />
}

export default RecurringInvoiceDetailError
