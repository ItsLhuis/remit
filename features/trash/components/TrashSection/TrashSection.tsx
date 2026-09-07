import { planRetentionPurge } from "../../purge"
import { getTrashSectionData } from "../../queries"

import { RetentionPolicyForm } from "./RetentionPolicyForm"
import { TrashTable } from "./TrashTable"

const TrashSection = async () => {
  const data = await getTrashSectionData()
  const plan = await planRetentionPurge(data.policy, new Date())

  return (
    <div className="flex flex-col gap-8">
      <RetentionPolicyForm policy={data.policy} pendingPurgeCount={plan.totalRows} />
      <TrashTable items={data.items} locale={data.locale} timeZone={data.timeZone} />
    </div>
  )
}

export { TrashSection }
