"use client"

import { useEffect, useState } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { Typography } from "@/components/ui"

const REFRESH_INTERVAL_MS = 4000
const REFRESH_ATTEMPT_LIMIT = 10

// A webhook usually lands within seconds of the client returning, but "usually" is not a state a
// page can render. Rather than leave a client who has just been charged looking at an unpaid
// invoice — the reading that makes someone pay twice — this re-runs the server render on a short
// interval so the confirmation appears on its own.
//
// `router.refresh()` and not a status endpoint: it re-reads the same database the rest of the page
// reads, so the page never acquires a second source of truth for whether money arrived. The attempt
// limit is what stops an abandoned tab polling forever; past it the copy tells the client the
// confirmation is still coming, which stays true whether or not this component keeps asking.
const PublicInvoicePendingRefresh = () => {
  const { t } = useTranslation()

  const router = useRouter()

  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (attempts >= REFRESH_ATTEMPT_LIMIT) return

    const timer = setTimeout(() => {
      setAttempts((previous) => previous + 1)
      router.refresh()
    }, REFRESH_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [attempts, router])

  return (
    <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
      {t("invoices.public.paid.pendingNote")}
    </Typography>
  )
}

export { PublicInvoicePendingRefresh }
