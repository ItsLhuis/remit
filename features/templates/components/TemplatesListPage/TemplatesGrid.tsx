"use client"

import { Fragment, type ReactNode } from "react"

import { Skeleton } from "@/components/ui"

import { type TemplateListItem } from "../../types"

import { TemplateCard } from "./TemplateCard"

const GRID_CLASS_NAME = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

type TemplatesGridProps = {
  templates: TemplateListItem[]
  locale: string
  isLoading: boolean
  skeletonCards: number
  empty: ReactNode
  onSetDefault: (id: string) => void
  onDelete: (template: TemplateListItem) => void
}

const TemplatesGrid = ({
  templates,
  locale,
  isLoading,
  skeletonCards,
  empty,
  onSetDefault,
  onDelete
}: TemplatesGridProps) => {
  if (isLoading) {
    return (
      <div className={GRID_CLASS_NAME}>
        {Array.from({ length: skeletonCards }).map((_, index) => (
          <Skeleton key={`skeleton-${index}`} className="h-78 rounded-xl" />
        ))}
      </div>
    )
  }

  if (templates.length === 0) return <Fragment>{empty}</Fragment>

  return (
    <div className={GRID_CLASS_NAME}>
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          locale={locale}
          onSetDefault={onSetDefault}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

export { TemplatesGrid }
