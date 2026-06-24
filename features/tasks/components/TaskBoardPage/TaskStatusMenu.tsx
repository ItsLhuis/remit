"use client"

import { useTranslation } from "@/lib/i18n"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  IconButton
} from "@/components/ui"

import { type TaskStatus } from "../../schemas"
import { getNextTaskStatuses } from "../../services"
import { taskStatusPresentation } from "../TaskStatusBadge"

type TaskStatusMenuProps = {
  status: TaskStatus
  disabled?: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
  onChangeStatus: (status: TaskStatus) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onEdit: () => void
  onDelete: () => void
}

const TaskStatusMenu = ({
  status,
  disabled = false,
  canMoveUp = false,
  canMoveDown = false,
  onChangeStatus,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete
}: TaskStatusMenuProps) => {
  const { t } = useTranslation()

  const nextStatuses = getNextTaskStatuses(status)

  const showMove = Boolean(onMoveUp || onMoveDown)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={t("tasks.card.actions")}
          disabled={disabled}
        >
          <Icon name="EllipsisVertical" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t("tasks.card.changeStatus")}</DropdownMenuLabel>
        {nextStatuses.map((next) => (
          <DropdownMenuItem
            key={next}
            variant={next === "cancelled" ? "destructive" : "default"}
            onSelect={() => onChangeStatus(next)}
          >
            <Icon name={taskStatusPresentation[next].icon} aria-hidden="true" />
            {t(`tasks.status.${next}`)}
          </DropdownMenuItem>
        ))}
        {showMove ? <DropdownMenuSeparator /> : null}
        {onMoveUp ? (
          <DropdownMenuItem disabled={!canMoveUp} onSelect={() => onMoveUp()}>
            <Icon name="ArrowUp" aria-hidden="true" />
            {t("tasks.card.moveUp")}
          </DropdownMenuItem>
        ) : null}
        {onMoveDown ? (
          <DropdownMenuItem disabled={!canMoveDown} onSelect={() => onMoveDown()}>
            <Icon name="ArrowDown" aria-hidden="true" />
            {t("tasks.card.moveDown")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onEdit()}>
          <Icon name="Pencil" aria-hidden="true" />
          {t("tasks.card.edit")}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete()}>
          <Icon name="Trash2" aria-hidden="true" />
          {t("tasks.card.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { TaskStatusMenu }
