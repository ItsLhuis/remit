import { type ClientDetail } from "../types"

import { ClientWorkspace } from "./ClientWorkspace"

type ClientDetailPageProps = {
  client: ClientDetail
  locale: string
}

const ClientDetailPage = ({ client, locale }: ClientDetailPageProps) => {
  return <ClientWorkspace client={client} locale={locale} />
}

export { ClientDetailPage }
