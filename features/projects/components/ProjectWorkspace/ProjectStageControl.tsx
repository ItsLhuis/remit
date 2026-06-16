"use client"

import { useTransition } from "react"

import { useTranslation } from "@/lib/i18n"

import { Button, Icon, Spinner, Typography, toast } from "@/components/ui"

import { updateProjectStatus } from "../../mutations"
import { type ProjectStatus } from "../../schemas"
import { getNextProjectStatuses } from "../../services"

type ProjectStageControlProps = {
  projectId: string
  status: ProjectStatus
  onChanged: () => void
}

const ProjectStageControl = ({ projectId, status, onChanged }: ProjectStageControlProps) => {
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
    return <Typography affects={["muted", "small"]}>{t("projects.stage.terminal")}</Typography>
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {nextStatuses.map((next) => (
        <Button
          key={next}
          variant={next === "completed" ? "default" : "outline"}
          size="sm"
          disabled={isPending}
          onClick={() => applyStatus(next)}
        >
          {isPending ? <Spinner /> : <Icon name="ArrowRight" aria-hidden="true" />}
          {t("projects.stage.moveTo", { stage: t(`projects.status.${next}`) })}
        </Button>
      ))}
    </div>
  )
}

export { ProjectStageControl }
