"use client"

import { ContractRouteError } from "@/features/contracts"

type ContractsErrorProps = {
  reset: () => void
}

const ContractsError = ({ reset }: ContractsErrorProps) => {
  return <ContractRouteError reset={reset} />
}

export default ContractsError
