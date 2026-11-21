import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { ExpensesListPage } from "@/features/expenses"
import { getExpensesPageData } from "@/features/expenses/server"

export const metadata: Metadata = {
  title: t("expenses.metadata.list")
}

type ExpensesRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ExpensesRoute = async ({ searchParams }: ExpensesRouteProps) => {
  const data = await getExpensesPageData(await searchParams)

  return <ExpensesListPage data={data} />
}

export default ExpensesRoute
