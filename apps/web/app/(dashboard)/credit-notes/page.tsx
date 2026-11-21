import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { CreditNotesOverviewPage } from "@/features/creditNotes"
import { getCreditNotesOverviewPageData } from "@/features/creditNotes/server"

export const metadata: Metadata = {
  title: t("creditNotes.metadata.list")
}

type CreditNotesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const CreditNotesRoute = async ({ searchParams }: CreditNotesPageProps) => {
  const data = await getCreditNotesOverviewPageData(await searchParams)

  return <CreditNotesOverviewPage data={data} />
}

export default CreditNotesRoute
