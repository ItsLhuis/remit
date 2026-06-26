import { type ProjectStatus } from "../schemas"

type StatusPresentation = {
  variant: "secondary" | "info" | "warning" | "default" | "success" | "error"
  icon: "Play" | "Pause" | "CircleCheck" | "CircleX"
}

export const projectStatusPresentation: Record<ProjectStatus, StatusPresentation> = {
  active: { variant: "success", icon: "Play" },
  on_hold: { variant: "warning", icon: "Pause" },
  completed: { variant: "info", icon: "CircleCheck" },
  cancelled: { variant: "error", icon: "CircleX" }
}
