import { planRetentionPurge } from "../../purge"
import { getTrashSectionData } from "../../queries"

import { RetentionPolicyForm } from "./RetentionPolicyForm"
import { TrashTable } from "./TrashTable"

type TrashSectionProps = {
  searchParams: unknown
}

const TrashSection = async ({ searchParams }: TrashSectionProps) => {
  const data = await getTrashSectionData(searchParams)
  const plan = await planRetentionPurge(data.policy, new Date())

  return (
    <div className="flex flex-col gap-8">
      <RetentionPolicyForm policy={data.policy} pendingPurgeCount={plan.totalRows} />
      <section id="trash" className="scroll-mt-8">
        <TrashTable data={data} />
      </section>
    </div>
  )
}

export { TrashSection }
