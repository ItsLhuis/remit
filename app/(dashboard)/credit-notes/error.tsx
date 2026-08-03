"use client"

import { CreditNoteRouteError } from "@/features/creditNotes"

type CreditNotesErrorProps = {
  reset: () => void
}

const CreditNotesError = ({ reset }: CreditNotesErrorProps) => {
  return <CreditNoteRouteError reset={reset} />
}

export default CreditNotesError
