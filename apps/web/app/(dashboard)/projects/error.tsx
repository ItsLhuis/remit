"use client"

import { ProjectRouteError } from "@/features/projects"

type ProjectsErrorProps = {
  reset: () => void
}

const ProjectsError = ({ reset }: ProjectsErrorProps) => {
  return <ProjectRouteError reset={reset} />
}

export default ProjectsError
