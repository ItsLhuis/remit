"use client"

import { InvoiceRouteError } from "@/features/invoices"

type InvoiceErrorProps = {
  reset: () => void
}

const InvoiceError = ({ reset }: InvoiceErrorProps) => {
  return <InvoiceRouteError reset={reset} />
}

export default InvoiceError
