"use client"

import { type ComponentProps } from "react"

import Link from "next/link"

import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon
} from "@/components/ui"

type DashboardCardEmptyAction = {
  label: string
  href: string
}

type DashboardCardEmptyProps = {
  icon: ComponentProps<typeof Icon>["name"]
  title: string
  description: string
  // Omitted on purpose for the sections whose emptiness is good news — nothing overdue, nothing
  // needing attention — where a call to action would invent work. Cloudscape's rule that an empty
  // state always offers an action assumes a resource the reader wants to create; a celebratory
  // empty state on a dashboard has nothing to offer, and twelve equally loud buttons is the failure
  // this variant exists to avoid.
  action?: DashboardCardEmptyAction
}

const DashboardCardEmpty = ({ icon, title, description, action }: DashboardCardEmptyProps) => (
  <Empty className="border-0 px-0 py-6">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <Icon name={icon} aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
    {action ? (
      <EmptyContent>
        <Button asChild variant="ghost" size="sm">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      </EmptyContent>
    ) : null}
  </Empty>
)

export { DashboardCardEmpty }
