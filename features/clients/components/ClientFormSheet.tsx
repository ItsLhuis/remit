"use client"

import { useTranslation } from "@/lib/i18n"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui"

import { type ClientFormData } from "../types"

import { ClientForm } from "./ClientForm"

type ClientFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (client: { id: string }) => void
} & (
  | { mode: "create"; defaultCurrency: string; client?: never }
  | { mode: "edit"; client: ClientFormData; defaultCurrency?: never }
)

const ClientFormSheet = (props: ClientFormSheetProps) => {
  const { t } = useTranslation()

  const isEdit = props.mode === "edit"

  const handleSuccess = (client: { id: string }) => {
    props.onSuccess?.(client)
    props.onOpenChange(false)
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-border border-b">
          <SheetTitle>
            {isEdit ? t("clients.form.editTitle") : t("clients.form.createTitle")}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? t("clients.form.editDescription") : t("clients.form.createDescription")}
          </SheetDescription>
        </SheetHeader>
        {props.mode === "edit" ? (
          <ClientForm
            mode="edit"
            layout="panel"
            client={props.client}
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        ) : (
          <ClientForm
            mode="create"
            layout="panel"
            defaultCurrency={props.defaultCurrency}
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

export { ClientFormSheet }
