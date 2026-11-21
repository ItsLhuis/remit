"use client"

import { useState } from "react"

import { RecoveryCodesStep } from "./RecoveryCodesStep"
import { TotpEnableStep, type TotpEnableData } from "./TotpEnableStep"
import { TotpVerifyStep } from "./TotpVerifyStep"

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
