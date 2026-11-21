"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDay } from "@/lib/utils"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Typography
} from "@/components/ui"

import { type TaskStatus } from "../../schemas"
import { type TaskItem } from "../../types"
import { TaskPriorityBadge } from "../TaskPriorityBadge"
import { TaskStatusBadge } from "../TaskStatusBadge"

import { TaskStatusMenu } from "./TaskStatusMenu"

type TaskTableProps = {
  tasks: TaskItem[]
  locale: string
  onChangeStatus: (taskId: string, status: TaskStatus) => void
  onEdit: (task: TaskItem) => void
  onDelete: (task: TaskItem) => void
}

const TaskTable = ({ tasks, locale, onChangeStatus, onEdit, onDelete }: TaskTableProps) => {
  const { t } = useTranslation()

  return (
    <div className="rounded-lg border">
      <Table>
        <TableCaption className="sr-only">{t("tasks.board.title")}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t("tasks.table.titleColumn")}</TableHead>
            <TableHead>{t("tasks.table.statusColumn")}</TableHead>
            <TableHead>{t("tasks.table.priorityColumn")}</TableHead>
            <TableHead>{t("tasks.table.dueColumn")}</TableHead>
            <TableHead className="text-right">{t("tasks.table.rateColumn")}</TableHead>
            <TableHead className="w-12 text-right">{t("tasks.table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">{task.title}</TableCell>
              <TableCell>
                <TaskStatusBadge status={task.status} />
              </TableCell>
              <TableCell>
                <TaskPriorityBadge priority={task.priority} />
              </TableCell>
              <TableCell>
                <Typography affects={["muted", "small"]}>
                  {task.dueAt ? formatDay(task.dueAt, locale) : t("tasks.card.noDue")}
                </Typography>
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">
                {task.hourlyRateCents === null
                  ? "—"
                  : formatCurrency(task.hourlyRateCents, task.currency, locale)}
              </TableCell>
              <TableCell className="text-right">
                <TaskStatusMenu
                  status={task.status}
                  onChangeStatus={(status) => onChangeStatus(task.id, status)}
                  onEdit={() => onEdit(task)}
                  onDelete={() => onDelete(task)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export { TaskTable }
