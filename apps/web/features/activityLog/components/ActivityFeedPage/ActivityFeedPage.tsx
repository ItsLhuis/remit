"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Icon,
  ScrollArea,
  SidebarTrigger,
  Typography,
  toast
} from "@/components/ui"

import { useActivityFeedState } from "../../hooks"
import { deleteActivity, markActivityRead, markAllActivityRead } from "../../mutations"
import { type ActivityFeedPageData } from "../../types"
import { DeleteActivityDialog } from "../DeleteActivityDialog"

import { ActivityFeedFilters } from "./ActivityFeedFilters"
import { ActivityFeedList } from "./ActivityFeedList"
import { ActivityFeedPagination } from "./ActivityFeedPagination"

type ActivityFeedPageProps = {
  data: ActivityFeedPageData
}

const ActivityFeedPage = ({ data }: ActivityFeedPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const { entityType, setEntityType, read, setRead, setPage, reset } =
    useActivityFeedState(startTransition)

  const [isWriting, startWriting] = useTransition()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const hasActiveFilters = entityType !== null || read !== "all"
  const isBusy = isPending || isWriting

  const onMarkRead = (id: string) => {
    if (isWriting) return

    startWriting(async () => {
      const result = await markActivityRead({ ids: [id] })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("activity.success.markedRead"))

      router.refresh()
    })
  }

  const onMarkAllRead = () => {
    if (isWriting) return

    startWriting(async () => {
      const result = await markAllActivityRead()

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("activity.success.markedAllRead"))

      router.refresh()
    })
  }

  const onConfirmDelete = () => {
    if (isWriting || deleteId === null) return

    startWriting(async () => {
      const result = await deleteActivity({ id: deleteId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("activity.success.deleted"))

      setDeleteId(null)

      router.refresh()
    })
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="md:hidden" />
              <Icon
                name="History"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("activity.feed.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("activity.feed.description")}
            </Typography>
          </div>
          <div className="flex items-center gap-3">
            <Typography affects={["muted", "small"]}>
              {data.unreadCount > 0
                ? t("activity.feed.unread", { count: data.unreadCount })
                : t("activity.feed.allRead")}
            </Typography>
            <Button
              variant="outline"
              disabled={isBusy || data.unreadCount === 0}
              onClick={onMarkAllRead}
            >
              <Icon name="CheckCheck" aria-hidden="true" />
              {t("activity.feed.markAllRead")}
            </Button>
          </div>
        </header>
        <Card size="sm">
          <CardHeader>
            <ActivityFeedFilters
              entityType={entityType}
              read={read}
              hasActiveFilters={hasActiveFilters}
              onEntityTypeChange={setEntityType}
              onReadChange={setRead}
              onReset={reset}
            />
          </CardHeader>
          <CardContent>
            <ActivityFeedList
              entries={data.entries}
              locale={data.locale}
              timeZone={data.timeZone}
              hasActiveFilters={hasActiveFilters}
              isBusy={isBusy}
              onMarkRead={onMarkRead}
              onDelete={setDeleteId}
            />
          </CardContent>
          {data.pageCount > 1 ? (
            <CardFooter>
              <ActivityFeedPagination
                page={data.query.page}
                pageCount={data.pageCount}
                isBusy={isBusy}
                onPageChange={setPage}
              />
            </CardFooter>
          ) : null}
        </Card>
        <DeleteActivityDialog
          open={deleteId !== null}
          isDeleting={isWriting}
          onOpenChange={(open) => setDeleteId(open ? deleteId : null)}
          onConfirm={onConfirmDelete}
        />
      </div>
    </ScrollArea>
  )
}

export { ActivityFeedPage }
