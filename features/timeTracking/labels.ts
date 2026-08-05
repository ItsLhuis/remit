import { type TimeEntrySource } from "./schemas"

type SourcePresentation = {
  variant: "secondary" | "info"
  icon: "Timer" | "PencilLine"
}

export const timeEntrySourcePresentation: Record<TimeEntrySource, SourcePresentation> = {
  timer: { variant: "info", icon: "Timer" },
  manual: { variant: "secondary", icon: "PencilLine" }
}
