"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/auth/client"

import { Button, Spinner, Typography } from "@/components/ui"

import { SignOutDialog } from "@/features/auth"

const LogoutSection = () => {
  const { t } = useTranslation()

  const router = useRouter()

  const [signOutOpen, setSignOutOpen] = useState(false)

  const [isPending, startTransition] = useTransition()

  const handleLogout = () => {
    startTransition(async () => {
      await authClient.signOut()

      router.push("/login")
    })
  }

  return (
    <section className="space-y-4">
      <Typography variant="h4">{t("settings.profile.session")}</Typography>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Typography variant="p" affects={["medium", "removePMargin"]}>
            {t("auth.signOut.title")}
          </Typography>
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {t("settings.profile.signOutDescription")}
          </Typography>
        </div>
        <Button variant="destructive" disabled={isPending} onClick={() => setSignOutOpen(true)}>
          {isPending && <Spinner />}
          {t("auth.signOut.submit")}
        </Button>
      </div>
      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} onConfirm={handleLogout} />
    </section>
  )
}

export { LogoutSection }
