"use client"

import { useTranslation } from "@/lib/i18n"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui"

import { type ClientPortalProject } from "../../types"

import { PortalProjectRow } from "./PortalProjectRow"
import { PortalSectionEmpty } from "./PortalSectionEmpty"

type PortalProjectsCardProps = {
  projects: ClientPortalProject[]
  locale: string
}

const PortalProjectsCard = ({ projects, locale }: PortalProjectsCardProps) => {
  const { t } = useTranslation()

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("clients.public.projects.title")}</CardTitle>
        <CardDescription>{t("clients.public.projects.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <PortalSectionEmpty
            icon="FolderKanban"
            title={t("clients.public.projects.emptyTitle")}
            description={t("clients.public.projects.emptyDescription")}
          />
        ) : (
          <ul className="flex flex-col">
            {projects.map((project) => (
              <PortalProjectRow
                key={`${project.name}:${project.startDate?.toISOString() ?? ""}`}
                project={project}
                locale={locale}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export { PortalProjectsCard }
