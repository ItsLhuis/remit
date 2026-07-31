import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { ContractForm, isContractEditable } from "@/features/contracts"
import { getContractForEdit, getContractParentOptions } from "@/features/contracts/server"

export const metadata: Metadata = {
  title: t("contracts.metadata.edit")
}

type EditContractRouteProps = {
  params: Promise<{ contractId: string }>
}

const EditContractRoute = async ({ params }: EditContractRouteProps) => {
  const { contractId } = await params

  const [contract, options] = await Promise.all([
    getContractForEdit({ id: contractId }),
    getContractParentOptions()
  ])

  // The second enforcement point for draft-only editing: `updateContract` refuses a non-draft in the
  // WHERE clause, and the route refuses to render the form for one at all, so an issued contract has
  // no edit surface to reach even by typing the URL.
  if (!contract || !isContractEditable(contract.status)) notFound()

  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-8">
      <ContractForm options={options} contract={contract} defaultProjectId="" defaultClientId="" />
    </div>
  )
}

export default EditContractRoute
