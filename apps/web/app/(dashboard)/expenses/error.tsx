"use client"

import { ExpenseRouteError } from "@/features/expenses"

type ExpensesErrorProps = {
  reset: () => void
}

const ExpensesError = ({ reset }: ExpensesErrorProps) => {
  return <ExpenseRouteError reset={reset} />
}

export default ExpensesError
