"use client"

import { type ReactNode } from "react"

import { Typography } from "@/components/ui"

type FormSectionProps = {
  title: string
  children: ReactNode
}

const FormSection = ({ title, children }: FormSectionProps) => (
  <section className="flex flex-col gap-4">
    <Typography variant="p" affects={["medium", "removePMargin"]}>
      {title}
    </Typography>
    {children}
  </section>
)

export { FormSection }
