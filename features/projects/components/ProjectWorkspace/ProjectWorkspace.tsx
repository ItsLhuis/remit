"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDay, getInitials } from "@/lib/utils"

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  ScrollArea,
  Separator,
  SidebarTrigger,
  StatCard,
  StatValue,
  Typography,
  toast
} from "@/components/ui"

import { softDeleteProject } from "../../mutations"
import { type ProjectClientOption, type ProjectDetail, type ProjectFormData } from "../../types"
import { DeleteProjectDialog } from "../DeleteProjectDialog"
import { ProjectFormSheet } from "../ProjectFormSheet"
import { ProjectStatusBadge } from "../ProjectStatusBadge"

import { DetailGroup } from "./DetailGroup"
import { DetailRow } from "./DetailRow"
import { ProjectStageControl } from "./ProjectStageControl"

type ProjectWorkspaceProps = {
  project: ProjectDetail
  formData: ProjectFormData
  clients: ProjectClientOption[]
  locale: string
}

const ProjectWorkspace = ({ project, formData, clients, locale }: ProjectWorkspaceProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()

  const budgetText =
    project.budgetCents === null
      ? t("projects.detail.emptyValue")
      : formatCurrency(project.budgetCents, project.currency, locale)
  const hourlyRateText =
    project.hourlyRateCents === null
      ? t("projects.detail.emptyValue")
      : formatCurrency(project.hourlyRateCents, project.currency, locale)
  const startDateText = project.startDate ? formatDay(project.startDate, locale) : ""
  const endDateText = project.endDate ? formatDay(project.endDate, locale) : ""

  const onDelete = () => {
    if (isDeleting) return

    startDelete(async () => {
      const result = await softDeleteProject({ id: project.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("projects.delete.deleted"))

      setDeleteOpen(false)

      router.push("/projects")

      router.refresh()
    })
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/projects">
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("projects.detail.backToProjects")}
            </Link>
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          <Card className="gap-0 py-0 lg:sticky lg:top-8">
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <Avatar className="size-16">
                <AvatarFallback className="text-lg">{getInitials(project.name)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center gap-2">
                <Typography variant="h2" className="text-2xl text-balance">
                  {project.name}
                </Typography>
                {project.deletedAt ? (
                  <Badge variant="outline">{t("projects.statusFilter.deleted")}</Badge>
                ) : (
                  <ProjectStatusBadge status={project.status} />
                )}
              </div>
              <Typography affects={["muted", "small"]}>
                {t("projects.detail.since", { date: formatDay(project.createdAt, locale) })}
              </Typography>
            </div>
            <div className="flex items-center gap-2 px-4 pb-4">
              <Button size="sm" className="flex-1" onClick={() => setEditOpen(true)}>
                <Icon name="Pencil" aria-hidden="true" />
                {t("projects.actions.edit")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton variant="outline" size="icon-sm" label={t("projects.list.actions")}>
                    <Icon name="EllipsisVertical" />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                    <Icon name="Trash2" aria-hidden="true" />
                    {t("projects.actions.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Separator />
            <DetailGroup title={t("projects.detail.overviewTitle")}>
              <DetailRow
                icon="Building2"
                label={t("projects.fields.client")}
                value={project.clientName}
                href={`/clients/${project.clientId}`}
              />
              <DetailRow
                icon="Coins"
                label={t("projects.fields.currency")}
                value={project.currency}
                mono
              />
              <DetailRow
                icon="CalendarPlus"
                label={t("projects.fields.startDate")}
                value={startDateText}
              />
              <DetailRow
                icon="CalendarCheck"
                label={t("projects.fields.endDate")}
                value={endDateText}
              />
            </DetailGroup>
            <CardFooter className="text-muted-foreground mt-auto gap-1.5 px-4 py-3 text-xs">
              <Icon name="Clock" className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {t("projects.detail.updatedLabel")} · {formatDay(project.updatedAt, locale)}
              </span>
            </CardFooter>
          </Card>
          <div className="flex min-w-0 flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard icon="GitBranch" label={t("projects.detail.statStatus")}>
                <StatValue
                  value={t(`projects.status.${project.status}`)}
                  title={t(`projects.status.${project.status}`)}
                  hint={t("projects.detail.statStatusHint")}
                />
              </StatCard>
              <StatCard icon="Wallet" label={t("projects.fields.budget")}>
                <StatValue
                  value={budgetText}
                  title={budgetText}
                  hint={t("projects.detail.statBudgetHint")}
                  mono
                />
              </StatCard>
              <StatCard icon="Clock" label={t("projects.fields.hourlyRate")}>
                <StatValue
                  value={hourlyRateText}
                  title={hourlyRateText}
                  hint={t("projects.detail.statHourlyRateHint")}
                  mono
                />
              </StatCard>
            </div>
            <Card size="sm">
              <CardHeader>
                <CardTitle>{t("projects.detail.statusTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Typography affects={["muted", "small"]}>
                    {t("projects.detail.currentStatus")}
                  </Typography>
                  <ProjectStatusBadge status={project.status} />
                </div>
                {project.deletedAt ? null : (
                  <ProjectStageControl
                    projectId={project.id}
                    status={project.status}
                    onChanged={() => router.refresh()}
                  />
                )}
              </CardContent>
            </Card>
            <Card size="sm" className="gap-0 py-0">
              <DetailGroup title={t("projects.detail.descriptionTitle")}>
                {project.description ? (
                  <Typography className="whitespace-pre-wrap">{project.description}</Typography>
                ) : (
                  <Typography affects={["muted", "small"]}>
                    {t("projects.detail.descriptionEmpty")}
                  </Typography>
                )}
              </DetailGroup>
              <CardFooter className="px-4 py-3">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Icon name="Pencil" aria-hidden="true" />
                  {t("projects.detail.editDetails")}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
      <ProjectFormSheet
        mode="edit"
        clients={clients}
        project={formData}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => router.refresh()}
      />
      <DeleteProjectDialog
        projectName={project.name}
        open={deleteOpen}
        isDeleting={isDeleting}
        onOpenChange={(open) => {
          if (!isDeleting) setDeleteOpen(open)
        }}
        onConfirm={onDelete}
      />
    </ScrollArea>
  )
}

export { ProjectWorkspace }
