"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDay, getInitials } from "@/lib/utils"

import {
  ActivityTimeline,
  type ActivityTimelineItem,
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
  Typography,
  toast
} from "@/components/ui"

import { softDeleteProject } from "../../mutations"
import { type ProjectClientOption, type ProjectDetail, type ProjectFormData } from "../../types"
import { DeleteProjectDialog } from "../DeleteProjectDialog"
import { ProjectFormSheet } from "../ProjectFormSheet"

import { DetailGroup } from "./DetailGroup"
import { DetailRow } from "./DetailRow"
import { ProjectStatusSelector } from "./ProjectStatusSelector"

const EMPTY_ACTIVITY: ActivityTimelineItem[] = []

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

  const activity = EMPTY_ACTIVITY

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
              <Typography variant="h2" className="text-2xl text-balance">
                {project.name}
              </Typography>
              <Typography affects={["muted", "small"]}>
                {t("projects.detail.since", { date: formatDay(project.createdAt, locale) })}
              </Typography>
            </div>
            <div className="flex flex-col gap-2 px-4 pb-4">
              <div className="flex items-center gap-2">
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
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/projects/${project.id}/tasks`}>
                    <Icon name="ListTodo" aria-hidden="true" />
                    {t("tasks.board.title")}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/projects/${project.id}/proposals`}>
                    <Icon name="FileText" aria-hidden="true" />
                    {t("proposals.list.title")}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="col-span-2">
                  <Link href={`/projects/${project.id}/invoices`}>
                    <Icon name="Receipt" aria-hidden="true" />
                    {t("invoices.list.title")}
                  </Link>
                </Button>
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-4 p-4">
              <div className="flex items-start gap-2.5">
                <Icon
                  name="GitBranch"
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Typography affects={["muted", "tiny"]}>{t("projects.fields.status")}</Typography>
                  {project.deletedAt ? (
                    <Badge variant="outline" className="w-fit">
                      {t("projects.statusFilter.deleted")}
                    </Badge>
                  ) : (
                    <ProjectStatusSelector
                      projectId={project.id}
                      status={project.status}
                      onChanged={() => router.refresh()}
                    />
                  )}
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                <Typography affects={["muted", "tiny", "uppercase"]}>
                  {t("projects.detail.overviewTitle")}
                </Typography>
                <dl className="flex flex-col gap-3">
                  <DetailRow
                    icon="Building2"
                    label={t("projects.fields.client")}
                    value={project.clientName}
                    href={`/clients/${project.clientId}`}
                  />
                  <DetailRow
                    icon="Wallet"
                    label={t("projects.fields.budget")}
                    value={budgetText}
                    mono
                  />
                  <DetailRow
                    icon="Clock"
                    label={t("projects.fields.hourlyRate")}
                    value={hourlyRateText}
                    mono
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
                </dl>
              </div>
            </div>
            <CardFooter className="text-muted-foreground mt-auto gap-1.5 px-4 py-3 text-xs">
              <Icon name="Clock" className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {t("projects.detail.updatedLabel")} · {formatDay(project.updatedAt, locale)}
              </span>
            </CardFooter>
          </Card>
          <div className="flex min-w-0 flex-col gap-6">
            <Card size="sm">
              <CardHeader>
                <CardTitle>{t("projects.detail.activityTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityTimeline
                  items={activity}
                  emptyTitle={t("projects.detail.activityEmptyTitle")}
                  emptyDescription={t("projects.detail.activityEmpty")}
                />
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
