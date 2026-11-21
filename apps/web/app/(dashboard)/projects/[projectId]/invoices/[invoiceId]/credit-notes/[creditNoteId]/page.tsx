import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { CreditNoteDetailPage } from "@/features/creditNotes"
import { getCreditNoteDetail } from "@/features/creditNotes/server"

export const metadata: Metadata = {
  title: t("creditNotes.metadata.detail")
}

type CreditNoteRouteProps = {
  params: Promise<{ invoiceId: string; creditNoteId: string }>
}

const CreditNoteRoute = async ({ params }: CreditNoteRouteProps) => {
  const { invoiceId, creditNoteId } = await params

  const creditNote = await getCreditNoteDetail({ id: creditNoteId })

  if (!creditNote) notFound()

  // The credit note must belong to the invoice in the path: the id alone would otherwise render any
  // credit note under any invoice's route, and the back link would lead somewhere it was never
  // issued against.
  if (creditNote.invoiceId !== invoiceId) notFound()

  return <CreditNoteDetailPage creditNote={creditNote} />
}

export default CreditNoteRoute
