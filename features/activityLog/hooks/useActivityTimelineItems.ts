"use client"

import { type ReactNode } from "react"

import { useTranslation } from "@/lib/i18n"

import { formatDate } from "@/lib/utils"

import { type ActivityTimelineItem } from "@/components/ui"

import { activityMessagePresentation } from "../labels"
import { type ActivityEntry } from "../types"

type ActivityTimelineItemsOptions = {
  entries: ActivityEntry[]
  locale: string
  timeZone: string
  renderActions?: (entry: ActivityEntry) => ReactNode
}

// The one place a stored `message_key` becomes readable text. It runs on the client, through
// `useTranslation`, so switching the interface language re-renders the whole history in the new
// language — which is the reason rows store a key and ICU arguments instead of a rendered string
// (ARCHITECTURE.md, internationalization).
export function useActivityTimelineItems({
  entries,
  locale,
  timeZone,
  renderActions
}: ActivityTimelineItemsOptions): ActivityTimelineItem[] {
  const { t } = useTranslation()

  return entries.map((entry) => ({
    id: entry.id,
    icon: activityMessagePresentation[entry.messageKey].icon,
    title: t(entry.messageKey, entry.messageArgs),
    timestamp: formatDate(entry.createdAt, { locale, timeZone }),
    unread: entry.unread,
    actions: renderActions?.(entry)
  }))
}
