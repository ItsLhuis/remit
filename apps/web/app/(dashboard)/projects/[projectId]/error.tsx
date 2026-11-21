"use client"

import { ProjectRouteError } from "@/features/projects"

type ProjectDetailErrorProps = {
  reset: () => void
}

const ProjectDetailError = ({ reset }: ProjectDetailErrorProps) => {
  return <ProjectRouteError reset={reset} />
}

export default ProjectDetailError
