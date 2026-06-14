"use client"

import { ClientRouteError } from "@/features/clients"

type ClientDetailErrorProps = {
  reset: () => void
}

const ClientDetailError = ({ reset }: ClientDetailErrorProps) => {
  return <ClientRouteError reset={reset} />
}

export default ClientDetailError
