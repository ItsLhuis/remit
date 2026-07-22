"use client"

import { TemplateRouteError } from "@/features/templates"

type TemplatesErrorProps = {
  reset: () => void
}

const TemplatesError = ({ reset }: TemplatesErrorProps) => {
  return <TemplateRouteError reset={reset} />
}

export default TemplatesError
