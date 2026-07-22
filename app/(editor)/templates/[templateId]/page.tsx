import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { TemplateEditorPage } from "@/features/templates"
import { getTemplateForEdit } from "@/features/templates/server"

export const metadata: Metadata = {
  title: t("templates.metadataTitle")
}

type TemplateEditorRouteProps = {
  params: Promise<{ templateId: string }>
}

const TemplateEditorRoute = async ({ params }: TemplateEditorRouteProps) => {
  const { templateId } = await params

  const template = await getTemplateForEdit({ id: templateId })

  if (!template) notFound()

  return <TemplateEditorPage template={template} />
}

export default TemplateEditorRoute
