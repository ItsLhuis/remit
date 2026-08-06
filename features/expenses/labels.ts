// The categories the form proposes. `expenses.category` is deliberately free-form text, so these are
// suggestions the user may ignore or replace; nothing downstream matches on them. Each value doubles
// as the `expenses.categories.*` translation key that presents it.
export const EXPENSE_CATEGORY_SUGGESTIONS = [
  "travel",
  "accommodation",
  "meals",
  "software",
  "hardware",
  "subcontracting",
  "office",
  "marketing",
  "fees",
  "other"
] as const

export type ExpenseCategorySuggestion = (typeof EXPENSE_CATEGORY_SUGGESTIONS)[number]
