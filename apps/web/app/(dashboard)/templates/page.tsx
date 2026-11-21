import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { TemplatesListPage } from "@/features/templates"
import { getTemplatesPageData } from "@/features/templates/server"

export const metadata: Metadata = {
  title: t("templates.metadataTitle")
}

type TemplatesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const TemplatesPage = async ({ searchParams }: TemplatesPageProps) => {
  const data = await getTemplatesPageData(await searchParams)

  return <TemplatesListPage data={data} />
}

export default TemplatesPage
