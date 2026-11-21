"use client"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  type IconProps
} from "@/components/ui"

type PortalSectionEmptyProps = {
  icon: IconProps["name"]
  title: string
  description: string
}

const PortalSectionEmpty = ({ icon, title, description }: PortalSectionEmptyProps) => {
  return (
    <Empty className="border-0 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name={icon} aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export { PortalSectionEmpty }
