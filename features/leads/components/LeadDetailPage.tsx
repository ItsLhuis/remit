import { type LeadDetail, type LeadFormData } from "../types"

import { LeadWorkspace } from "./LeadWorkspace"

type LeadDetailPageProps = {
  lead: LeadDetail
  formData: LeadFormData
  locale: string
  defaultCurrency: string
}

const LeadDetailPage = ({ lead, formData, locale, defaultCurrency }: LeadDetailPageProps) => {
  return (
    <LeadWorkspace
      lead={lead}
      formData={formData}
      locale={locale}
      defaultCurrency={defaultCurrency}
    />
  )
}

export { LeadDetailPage }
