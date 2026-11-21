"use client"

import { type ReactNode } from "react"

import { Typography } from "@/components/ui"

type DetailGroupProps = {
  title: string
  children: ReactNode
}

const DetailGroup = ({ title, children }: DetailGroupProps) => (
  <section className="flex flex-col gap-3 p-4">
    <Typography affects={["muted", "tiny", "uppercase"]}>{title}</Typography>
    <dl className="flex flex-col gap-3">{children}</dl>
  </section>
)

export { DetailGroup }
