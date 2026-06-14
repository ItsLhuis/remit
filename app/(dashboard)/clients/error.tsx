"use client"

import { ClientRouteError } from "@/features/clients"

type ClientsErrorProps = {
  reset: () => void
}

const ClientsError = ({ reset }: ClientsErrorProps) => {
  return <ClientRouteError reset={reset} />
}

export default ClientsError
