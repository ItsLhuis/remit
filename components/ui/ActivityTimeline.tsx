"use client"

import { type ComponentProps } from "react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/Empty"
import { Icon } from "@/components/ui/Icon"
import { Typography } from "@/components/ui/Typography"

type ActivityTimelineItem = {
  id: string
  icon: ComponentProps<typeof Icon>["name"]
  title: string
  timestamp: string
  description?: string
}

type ActivityTimelineProps = {
  items: ActivityTimelineItem[]
  emptyTitle: string
  emptyDescription: string
}

const ActivityTimeline = ({ items, emptyTitle, emptyDescription }: ActivityTimelineProps) => {
  if (items.length === 0) {
    return (
      <Empty className="border-0 p-0 py-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="History" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ol className="flex flex-col">
      {items.map((item, index) => (
        <li key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="bg-muted text-muted-foreground ring-foreground/10 flex size-7 shrink-0 items-center justify-center rounded-full ring-1">
              <Icon name={item.icon} className="size-3.5" aria-hidden="true" />
            </span>
            {index < items.length - 1 ? <span className="bg-border w-px flex-1" /> : null}
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 pb-5">
            <Typography affects="medium" className="text-sm">
              {item.title}
            </Typography>
            {item.description ? (
              <Typography affects={["muted", "small"]} className="whitespace-pre-wrap">
                {item.description}
              </Typography>
            ) : null}
            <Typography affects={["muted", "tiny"]}>{item.timestamp}</Typography>
          </div>
        </li>
      ))}
    </ol>
  )
}

export { ActivityTimeline, type ActivityTimelineItem }
