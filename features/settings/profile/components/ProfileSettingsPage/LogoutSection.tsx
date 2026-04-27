"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { authClient } from "@/lib/authClient"

import { SignOutDialog } from "@/features/auth/components/SignOutDialog"

import { Button, Spinner, Typography } from "@/components/ui"

const LogoutSection = () => {
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
      <Typography variant="h4">Session</Typography>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Typography variant="p" affects={["medium", "removePMargin"]}>
            Sign out
          </Typography>
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            Sign out of your account on this device.
          </Typography>
        </div>
        <Button variant="destructive" disabled={isPending} onClick={() => setSignOutOpen(true)}>
          {isPending && <Spinner />}
          Sign out
        </Button>
      </div>
      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} onConfirm={handleLogout} />
    </section>
  )
}

export { LogoutSection }
