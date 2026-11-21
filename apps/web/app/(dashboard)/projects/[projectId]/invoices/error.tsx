"use client"

import { InvoiceRouteError } from "@/features/invoices"

type InvoicesErrorProps = {
  reset: () => void
}

const InvoicesError = ({ reset }: InvoicesErrorProps) => {
  return <InvoiceRouteError reset={reset} />
}

export default InvoicesError
