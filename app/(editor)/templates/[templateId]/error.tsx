"use client"

import { TemplateRouteError } from "@/features/templates"

type TemplateEditorErrorProps = {
  reset: () => void
}

const TemplateEditorError = ({ reset }: TemplateEditorErrorProps) => {
  return <TemplateRouteError reset={reset} />
}

export default TemplateEditorError
