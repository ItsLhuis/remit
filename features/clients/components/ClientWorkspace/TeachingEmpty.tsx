"use client"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, Icon } from "@/components/ui"

type TeachingEmptyProps = {
  icon: "ReceiptText" | "FolderKanban" | "Activity"
  title: string
  description: string
}

const TeachingEmpty = ({ icon, title, description }: TeachingEmptyProps) => (
  <Empty className="ring-foreground/10 rounded-xl border-0 py-14 ring-1">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <Icon name={icon} />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
  </Empty>
)

export { TeachingEmpty }
