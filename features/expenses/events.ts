import { emit, type EventMap } from "@/lib/events"

export function emitExpenseCreated(payload: EventMap["expense.created"]): Promise<void> {
  return emit("expense.created", payload)
}
