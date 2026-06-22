"use client"

import { useTransition } from "react"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Icon,
  Spinner,
  toast
} from "@/components/ui"

import { updateProjectStatus } from "../../mutations"
import { type ProjectStatus } from "../../schemas"
import { getNextProjectStatuses } from "../../services"
import { ProjectStatusBadge, projectStatusPresentation } from "../ProjectStatusBadge"

type ProjectStatusSelectorProps = {
  projectId: string
  status: ProjectStatus
  onChanged: () => void
}

const ProjectStatusSelector = ({ projectId, status, onChanged }: ProjectStatusSelectorProps) => {
  const { t } = useTranslation()

  const [isPending, startTransition] = useTransition()

  const nextStatuses = getNextProjectStatuses(status)

  const applyStatus = (next: ProjectStatus) => {
    startTransition(async () => {
      const result = await updateProjectStatus({ id: projectId, status: next })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("projects.stage.changed"))

      onChanged()
    })
  }

  if (nextStatuses.length === 0) {
    return <ProjectStatusBadge status={status} />
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {isPending ? (
              <Spinner />
            ) : (
              <Icon name={projectStatusPresentation[status].icon} aria-hidden="true" />
            )}
            <span className="truncate">{t(`projects.status.${status}`)}</span>
          </span>
          <Icon name="ChevronsUpDown" className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel>{t("projects.stage.changeStatus")}</DropdownMenuLabel>
        <DropdownMenuItem disabled className="justify-between">
          <span className="flex items-center gap-1.5">
            <Icon name={projectStatusPresentation[status].icon} aria-hidden="true" />
            {t(`projects.status.${status}`)}
          </span>
          <Icon name="Check" aria-hidden="true" />
        </DropdownMenuItem>
        {nextStatuses.map((next) => (
          <DropdownMenuItem
            key={next}
            variant={next === "cancelled" ? "destructive" : "default"}
            onSelect={() => applyStatus(next)}
          >
            <Icon name={projectStatusPresentation[next].icon} aria-hidden="true" />
            {t(`projects.status.${next}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ProjectStatusSelector }
