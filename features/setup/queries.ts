import { database } from "@/database"

export type SetupInitialStep = "business" | "totp"

export type SetupProgress = {
  initialStep: SetupInitialStep
  isComplete: boolean
}

// `isComplete` below is the second copy of a predicate `proxy.ts` also computes, and the two must
// stay identical: this one decides whether the wizard renders, that one decides whether a request
// is redirected back into it. If they disagree, the wizard either shows itself to a finished
// instance or waves through a user the proxy will bounce on the next navigation. A new required
// step has to be added on both sides.
export async function getSetupProgress(twoFactorEnabled: boolean): Promise<SetupProgress> {
  const userSettings = await database.query.settings.findFirst({
    columns: { businessName: true }
  })

  const businessDone = Boolean(userSettings?.businessName)

  return {
    initialStep: businessDone ? "totp" : "business",
    isComplete: businessDone && twoFactorEnabled
  }
}
