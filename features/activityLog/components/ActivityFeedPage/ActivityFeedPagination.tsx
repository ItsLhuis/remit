"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Icon,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  Typography
} from "@/components/ui"

type ActivityFeedPaginationProps = {
  page: number
  pageCount: number
  isBusy: boolean
  onPageChange: (page: number) => void
}

const ActivityFeedPagination = ({
  page,
  pageCount,
  isBusy,
  onPageChange
}: ActivityFeedPaginationProps) => {
  const { t } = useTranslation()

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            size="sm"
            disabled={isBusy || page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <Icon name="ChevronLeft" aria-hidden="true" />
            {t("activity.feed.previous")}
          </PaginationLink>
        </PaginationItem>
        <PaginationItem className="px-2">
          <Typography affects={["muted", "small"]}>
            {t("activity.feed.pagination", { page, pageCount })}
          </Typography>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink
            size="sm"
            disabled={isBusy || page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            {t("activity.feed.next")}
            <Icon name="ChevronRight" aria-hidden="true" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

export { ActivityFeedPagination }
