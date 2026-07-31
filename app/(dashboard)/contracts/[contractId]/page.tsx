import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { ContractDetailPage } from "@/features/contracts"
import { getContractDefaults, getContractDetail } from "@/features/contracts/server"

export const metadata: Metadata = {
  title: t("contracts.metadata.detail")
}

type ContractDetailRouteProps = {
  params: Promise<{ contractId: string }>
}

const ContractDetailRoute = async ({ params }: ContractDetailRouteProps) => {
  const { contractId } = await params

  const [contract, defaults] = await Promise.all([
    getContractDetail({ id: contractId }),
    getContractDefaults()
  ])

  if (!contract) notFound()

  return (
    <ContractDetailPage
      contract={contract}
      locale={defaults.defaultLocale}
      timeZone={defaults.defaultTimezone}
    />
  )
}

export default ContractDetailRoute
