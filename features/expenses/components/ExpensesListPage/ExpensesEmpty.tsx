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

type ExpensesEmptyProps = {
  hasNoExpenses: boolean
  onCreate: () => void
  onReset: () => void
}

const ExpensesEmpty = ({ hasNoExpenses, onCreate, onReset }: ExpensesEmptyProps) => {
  const { t } = useTranslation()

  if (!hasNoExpenses) {
    return (
      <Empty className="border-0 py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="SearchX" />
          </EmptyMedia>
          <EmptyTitle>{t("expenses.list.noMatchTitle")}</EmptyTitle>
          <EmptyDescription>{t("expenses.list.noMatchDescription")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onReset}>
            {t("expenses.filters.reset")}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <Empty className="border-0 py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name="Wallet" />
        </EmptyMedia>
        <EmptyTitle>{t("expenses.list.emptyTitle")}</EmptyTitle>
        <EmptyDescription>{t("expenses.list.emptyDescription")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreate}>
          <Icon name="Plus" aria-hidden="true" />
          {t("expenses.actions.create")}
        </Button>
      </EmptyContent>
    </Empty>
  )
}

export { ExpensesEmpty }
