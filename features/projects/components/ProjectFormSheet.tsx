"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui"

import { type ProjectClientOption, type ProjectFormData } from "../types"

import { ProjectForm } from "./ProjectForm"

type ProjectFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (project: { id: string }) => void
} & (
  | { mode: "create"; clients: ProjectClientOption[]; defaultClientId?: string; project?: never }
  | {
      mode: "edit"
      clients: ProjectClientOption[]
      project: ProjectFormData
      defaultClientId?: never
    }
)

const ProjectFormSheet = (props: ProjectFormSheetProps) => {
  const { t } = useTranslation()

  const isEdit = props.mode === "edit"

  const hasClients = props.clients.length > 0

  const handleSuccess = (project: { id: string }) => {
    props.onSuccess?.(project)
    props.onOpenChange(false)
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-border border-b">
          <SheetTitle>
            {isEdit ? t("projects.form.editTitle") : t("projects.form.createTitle")}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? t("projects.form.editDescription") : t("projects.form.createDescription")}
          </SheetDescription>
        </SheetHeader>
        {props.mode === "edit" ? (
          <ProjectForm
            mode="edit"
            layout="panel"
            clients={props.clients}
            project={props.project}
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        ) : hasClients ? (
          <ProjectForm
            mode="create"
            layout="panel"
            clients={props.clients}
            defaultClientId={props.defaultClientId}
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        ) : (
          <div className="p-4">
            <Empty className="border-0 py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Icon name="Users" />
                </EmptyMedia>
                <EmptyTitle>{t("projects.form.noClientsTitle")}</EmptyTitle>
                <EmptyDescription>{t("projects.form.noClientsDescription")}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild>
                  <Link href="/clients">
                    <Icon name="Plus" aria-hidden="true" />
                    {t("projects.form.createClient")}
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export { ProjectFormSheet }
