"use client"

import { type ReactNode } from "react"

import { Typography } from "@/components/ui"

type FormSectionProps = {
  title: string
  description: string
  children: ReactNode
}

const FormSection = ({ title, description, children }: FormSectionProps) => (
  <section className="flex flex-col gap-4">
    <div className="space-y-0.5">
      <Typography variant="p" affects={["medium", "removePMargin"]}>
        {title}
      </Typography>
      <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
        {description}
      </Typography>
    </div>
    {children}
  </section>
)

export { FormSection }
