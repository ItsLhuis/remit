"use client"

import { ContractRouteError } from "@/features/contracts"

type ContractDetailErrorProps = {
  reset: () => void
}

const ContractDetailError = ({ reset }: ContractDetailErrorProps) => {
  return <ContractRouteError reset={reset} />
}

export default ContractDetailError
