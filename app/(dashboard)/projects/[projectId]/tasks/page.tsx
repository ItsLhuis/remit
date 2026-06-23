import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { TaskBoardPage } from "@/features/tasks"
import { getTaskBoardData } from "@/features/tasks/server"

export const metadata: Metadata = {
  title: t("tasks.metadata.board")
}

type TasksRouteProps = {
  params: Promise<{ projectId: string }>
}

const TasksRoute = async ({ params }: TasksRouteProps) => {
  const { projectId } = await params

  const data = await getTaskBoardData({ projectId })

  if (!data) notFound()

  return <TaskBoardPage data={data} />
}

export default TasksRoute
