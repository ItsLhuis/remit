"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon
} from "@/components/ui"

type TaskBoardEmptyProps = {
  onCreate: () => void
}

const TaskBoardEmpty = ({ onCreate }: TaskBoardEmptyProps) => {
  const { t } = useTranslation()

  return (
    <Empty className="h-full border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name="ListTodo" />
        </EmptyMedia>
        <EmptyTitle>{t("tasks.empty.title")}</EmptyTitle>
        <EmptyDescription>{t("tasks.empty.description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreate}>
          <Icon name="Plus" aria-hidden="true" />
          {t("tasks.board.createButton")}
        </Button>
      </EmptyContent>
    </Empty>
  )
}

export { TaskBoardEmpty }
