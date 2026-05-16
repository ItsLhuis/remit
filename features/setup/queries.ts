import { database } from "@/database"

export type SetupInitialStep = "business" | "totp"

export type SetupProgress = {
  initialStep: SetupInitialStep
  isComplete: boolean
}

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
