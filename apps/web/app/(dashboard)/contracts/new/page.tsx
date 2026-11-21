import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { ContractForm, contractParentSchema, type ContractParentValues } from "@/features/contracts"
import { getContractParentOptions } from "@/features/contracts/server"

export const metadata: Metadata = {
  title: t("contracts.metadata.create")
}

// Every prefill comes off the URL, so it is validated before it can seed a form field; an
// unparseable id falls back to no selection rather than putting a bad value into the form.
function toPrefill(searchParams: Record<string, string | string[] | undefined>) {
  const parsed = contractParentSchema.safeParse({
    projectId: searchParams.projectId ?? null,
    clientId: searchParams.clientId ?? null,
    proposalId: searchParams.proposalId ?? null
  })

  const prefill: ContractParentValues = parsed.success
    ? parsed.data
    : { projectId: null, clientId: null, proposalId: null }

  return prefill
}

type NewContractRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const NewContractRoute = async ({ searchParams }: NewContractRouteProps) => {
  const prefill = toPrefill(await searchParams)
  const options = await getContractParentOptions()

  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-8">
      <ContractForm
        options={options}
        contract={null}
        defaultProjectId={prefill.projectId ?? ""}
        defaultClientId={prefill.clientId ?? ""}
      />
    </div>
  )
}

export default NewContractRoute
