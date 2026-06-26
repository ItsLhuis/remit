import { type TaskStatus } from "../schemas"

type StatusPresentation = {
  variant: "secondary" | "info" | "warning" | "success" | "error"
  icon: "Inbox" | "Circle" | "LoaderCircle" | "CircleCheck" | "CircleX"
}

export const taskStatusPresentation: Record<TaskStatus, StatusPresentation> = {
  backlog: { variant: "secondary", icon: "Inbox" },
  todo: { variant: "info", icon: "Circle" },
  in_progress: { variant: "warning", icon: "LoaderCircle" },
  done: { variant: "success", icon: "CircleCheck" },
  cancelled: { variant: "error", icon: "CircleX" }
}
