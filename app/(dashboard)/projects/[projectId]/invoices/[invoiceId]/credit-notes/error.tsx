"use client"

import { CreditNoteRouteError } from "@/features/creditNotes"

type CreditNoteErrorProps = {
  reset: () => void
}

const CreditNoteError = ({ reset }: CreditNoteErrorProps) => {
  return <CreditNoteRouteError reset={reset} />
}

export default CreditNoteError
