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
  action: DashboardCardEmptyAction
}

const DashboardCardEmpty = ({ icon, title, description, action }: DashboardCardEmptyProps) => (
  <Empty className="border-0 px-0 py-8">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <Icon name={icon} aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button asChild variant="outline" size="sm">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    </EmptyContent>
  </Empty>
)

export { DashboardCardEmpty }
