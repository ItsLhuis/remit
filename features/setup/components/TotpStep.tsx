"use client"

import { useState } from "react"

import { RecoveryCodesStep } from "@/features/setup/components/RecoveryCodesStep"
import { TotpEnableStep, type TotpEnableData } from "@/features/setup/components/TotpEnableStep"
import { TotpVerifyStep } from "@/features/setup/components/TotpVerifyStep"

type TotpStepProps = {
  onComplete: () => void
}

const TotpStep = ({ onComplete }: TotpStepProps) => {
  const [verified, setVerified] = useState(false)

  const [enableData, setEnableData] = useState<TotpEnableData | null>(null)

  if (enableData && verified) {
    return <RecoveryCodesStep backupCodes={enableData.backupCodes} onComplete={onComplete} />
  }

  if (enableData) {
    return <TotpVerifyStep totpUri={enableData.totpUri} onComplete={() => setVerified(true)} />
  }

  return <TotpEnableStep onSuccess={setEnableData} />
}

export { TotpStep }
