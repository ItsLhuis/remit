"use client"

import { ProjectRouteError } from "@/features/projects"

type TasksErrorProps = {
  reset: () => void
}

const TasksError = ({ reset }: TasksErrorProps) => {
  return <ProjectRouteError reset={reset} />
}

export default TasksError
