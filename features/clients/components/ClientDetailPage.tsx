import { type ClientDetail, type ClientFormData } from "../types"

import { ClientWorkspace } from "./ClientWorkspace"

type ClientDetailPageProps = {
  client: ClientDetail
  formData: ClientFormData
  locale: string
}

const ClientDetailPage = ({ client, formData, locale }: ClientDetailPageProps) => {
  return <ClientWorkspace client={client} formData={formData} locale={locale} />
}

export { ClientDetailPage }
