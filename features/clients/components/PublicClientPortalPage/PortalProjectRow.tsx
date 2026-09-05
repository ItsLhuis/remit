"use client"

import { useTranslation } from "@/lib/i18n"

import { formatDay } from "@/lib/utils"

import { Typography } from "@/components/ui"

import { ProjectStatusBadge } from "@/features/projects"

import { type ClientPortalProject } from "../../types"

type PortalProjectRowProps = {
  project: ClientPortalProject
  locale: string
}

const PortalProjectRow = ({ project, locale }: PortalProjectRowProps) => {
  const { t } = useTranslation()

  const start = project.startDate ? formatDay(project.startDate, locale) : null
  const end = project.endDate ? formatDay(project.endDate, locale) : null

  const dates =
    start && end
      ? t("clients.public.projects.between", { start, end })
      : start
        ? t("clients.public.projects.startedOn", { date: start })
        : end
          ? t("clients.public.projects.endsOn", { date: end })
          : t("clients.public.projects.noDates")

  return (
    <li className="border-border flex items-start justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Typography affects={["small", "medium"]}>{project.name}</Typography>
        <Typography affects={["small", "muted"]}>{dates}</Typography>
      </div>
      <ProjectStatusBadge status={project.status} />
    </li>
  )
}

export { PortalProjectRow }
