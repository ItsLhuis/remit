import { type Metadata } from "next"

import { notFound } from "next/navigation"

import { t } from "@/lib/i18n/server"

import { getLeadDefaults, getLeadDetail, getLeadForEdit } from "@/features/leads/server"

import { LeadDetailPage } from "@/features/leads"

export const metadata: Metadata = {
  title: t("leads.metadata.detail")
}

type LeadDetailRouteProps = {
  params: Promise<{ leadId: string }>
}

const LeadDetailRoute = async ({ params }: LeadDetailRouteProps) => {
  const { leadId } = await params

  const [lead, formData, defaults] = await Promise.all([
    getLeadDetail({ id: leadId }),
    getLeadForEdit({ id: leadId }),
    getLeadDefaults()
  ])

  if (!lead || !formData) notFound()

  return (
    <LeadDetailPage
      lead={lead}
      formData={formData}
      locale={defaults.defaultLocale}
      defaultCurrency={defaults.defaultCurrency}
    />
  )
}

export default LeadDetailRoute
