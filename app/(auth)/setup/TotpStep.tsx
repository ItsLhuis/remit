"use client"

import { useState } from "react"

import { TotpEnableStep } from "./TotpEnableStep"
import { TotpVerifyStep } from "./TotpVerifyStep"

type TotpStepProps = {
  onComplete: () => void
}

const TotpStep = ({ onComplete }: TotpStepProps) => {
  const [totpUri, setTotpUri] = useState<string | null>(null)

  if (totpUri) {
    return <TotpVerifyStep totpUri={totpUri} onComplete={onComplete} />
  }

  return <TotpEnableStep onSuccess={setTotpUri} />
}

export { TotpStep }
