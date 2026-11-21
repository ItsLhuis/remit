"use client"

import { useState } from "react"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  toast
} from "@/components/ui"

import { ChangePasswordForm } from "@/features/auth"

const ChangePasswordDialog = () => {
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)

  const handleSuccess = () => {
    setOpen(false)
    toast.success(t("settings.security.changePassword.changed"), {
      description: t("settings.security.changePassword.changedDescription")
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t("settings.security.changePassword.title")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.security.changePassword.title")}</DialogTitle>
          <DialogDescription>{t("settings.security.changePassword.description")}</DialogDescription>
        </DialogHeader>
        <ChangePasswordForm variant="settings" onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  )
}

export { ChangePasswordDialog }
