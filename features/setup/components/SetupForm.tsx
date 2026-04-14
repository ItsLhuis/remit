"use client"

import { Fragment, useState } from "react"

import { BusinessStep } from "@/features/setup/components/BusinessStep"
import { DoneStep } from "@/features/setup/components/DoneStep"
import { TotpStep } from "@/features/setup/components/TotpStep"

type Step = "business" | "totp" | "done"

type SetupFormProps = {
  initialStep: Step
}

const SetupForm = ({ initialStep }: SetupFormProps) => {
  const [step, setStep] = useState<Step>(initialStep)

  return (
    <Fragment>
      {step === "business" && <BusinessStep onComplete={() => setStep("totp")} />}
      {step === "totp" && <TotpStep onComplete={() => setStep("done")} />}
      {step === "done" && <DoneStep />}
    </Fragment>
  )
}

export { SetupForm }
