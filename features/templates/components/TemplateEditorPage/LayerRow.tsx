"use client"

import { useEffect, useRef, useState, type MouseEvent, type Ref } from "react"

import { CollisionPriority } from "@dnd-kit/abstract"
import { useDroppable } from "@dnd-kit/react"
import { useSortable } from "@dnd-kit/react/sortable"

import { useHotkeys } from "@tanstack/react-hotkeys"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { Button, Icon, Input } from "@/components/ui"

import { BLOCK_ICON_NAMES, BLOCK_LABEL_KEYS } from "../../labels"
import { type Block } from "../../schemas"

export const PAGE_GROUP = "__page__"

const INTO_PREFIX = "into:"

// The drop-id encoding LayerRow registers with dnd-kit and LayersList decodes; it belongs with the
// row that owns the contract, and a module split for two one-line functions costs more than the
// Fast Refresh reload it saves.
// react-doctor-disable-next-line only-export-components
export function intoDropId(frameId: string): string {
  return `${INTO_PREFIX}${frameId}`
}

// react-doctor-disable-next-line only-export-components
export function parseIntoDropId(dropId: string): string | null {
  return dropId.startsWith(INTO_PREFIX) ? dropId.slice(INTO_PREFIX.length) : null
}

export type LayerRowData = { block: Block; parentId: string | null; depth: number }

type LayerRowProps = {
  block: Block
  indent: number
  index: number
  group: string
  isSelected: boolean
  disabled?: boolean
  onSelectExact: (id: string) => void
  onToggleSelect: (id: string) => void
  onSelectRange: (id: string) => void
  onHover: (id: string | null) => void
  onToggleHidden: (id: string) => void
  onToggleLocked: (id: string) => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
}

// Composes two dnd-kit ref callbacks onto one DOM node: a frame row is both a sortable item
// (reorder among its own siblings) and a low-priority droppable (drop directly onto it to reparent
// into it), and dnd-kit hooks each return their own ref.
function composeRefs<T>(a: Ref<T>, b: Ref<T>): (node: T | null) => void {
  return (node) => {
    if (typeof a === "function") a(node)
    else if (a) a.current = node

    if (typeof b === "function") b(node)
    else if (b) b.current = node
  }
}

const LayerRow = ({
  block,
  indent,
  index,
  group,
  isSelected,
  disabled,
  onSelectExact,
  onToggleSelect,
  onSelectRange,
  onHover,
  onToggleHidden,
  onToggleLocked,
  onRemove,
  onRename
}: LayerRowProps) => {
  const { t } = useTranslation()

  const rowRef = useRef<HTMLButtonElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(block.name ?? "")

  const { ref, handleRef } = useSortable({
    id: block.id,
    index,
    group,
    type: "layer",
    accept: "layer",
    disabled: disabled === true
  })

  const { ref: intoRef, isDropTarget } = useDroppable({
    id: intoDropId(block.id),
    type: "layer",
    accept: "layer",
    collisionPriority: CollisionPriority.Low,
    disabled: block.type !== "frame"
  })

  // Delete/Backspace on the focused row removes the block; scoped to the row's own button so the
  // binding never fires elsewhere.
  useHotkeys(
    [
      { hotkey: "Delete", callback: () => onRemove(block.id) },
      { hotkey: "Backspace", callback: () => onRemove(block.id) }
    ],
    { target: rowRef, enabled: !disabled && !isRenaming }
  )

  useEffect(() => {
    if (isRenaming) nameInputRef.current?.focus()
  }, [isRenaming])

  const displayName = block.name ?? t(BLOCK_LABEL_KEYS[block.type])

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.shiftKey) {
      onSelectRange(block.id)
    } else if (event.ctrlKey || event.metaKey) {
      onToggleSelect(block.id)
    } else {
      onSelectExact(block.id)
    }
  }

  const startRename = () => {
    setDraftName(block.name ?? "")
    setIsRenaming(true)
  }

  const commitRename = () => {
    onRename(block.id, draftName)
    setIsRenaming(false)
  }

  return (
    <div
      ref={composeRefs(ref, intoRef)}
      className={cn(
        "group/layer-row hover:bg-muted flex items-center gap-1 rounded-md pr-1",
        isSelected && "bg-muted",
        isDropTarget && "ring-primary ring-1",
        indent <= 1 ? "ml-4" : indent === 2 ? "ml-8" : "ml-12"
      )}
    >
      <Button
        ref={handleRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={t("templates.editor.layerDragHandle", { name: displayName })}
        className="cursor-grab touch-none opacity-0 group-hover/layer-row:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
      >
        <Icon name="GripVertical" aria-hidden="true" className="size-3.5" />
      </Button>
      {isRenaming ? (
        <Input
          ref={nameInputRef}
          aria-label={t("templates.editor.renameBlock")}
          value={draftName}
          disabled={disabled}
          className="h-7 min-w-0 flex-1 text-xs"
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitRename()
            if (event.key === "Escape") setIsRenaming(false)
          }}
        />
      ) : (
        <Button
          ref={rowRef}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "min-w-0 flex-1 justify-start gap-1.5 hover:bg-transparent",
            block.hidden && "opacity-50"
          )}
          aria-pressed={isSelected}
          onClick={handleClick}
          onDoubleClick={startRename}
          onFocus={() => onHover(block.id)}
          onBlur={() => onHover(null)}
          onMouseEnter={() => onHover(block.id)}
          onMouseLeave={() => onHover(null)}
        >
          <Icon
            name={BLOCK_ICON_NAMES[block.type]}
            aria-hidden="true"
            className="text-muted-foreground size-3.5 shrink-0"
          />
          <span className="truncate text-xs">{displayName}</span>
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={
          block.hidden ? t("templates.editor.showBlock") : t("templates.editor.hideBlock")
        }
        aria-pressed={block.hidden}
        className={cn(
          "opacity-0 group-hover/layer-row:opacity-100 focus-visible:opacity-100",
          block.hidden && "opacity-100"
        )}
        onClick={() => onToggleHidden(block.id)}
      >
        <Icon name={block.hidden ? "EyeOff" : "Eye"} aria-hidden="true" className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={
          block.locked ? t("templates.editor.unlockBlock") : t("templates.editor.lockBlock")
        }
        aria-pressed={block.locked}
        className={cn(
          "opacity-0 group-hover/layer-row:opacity-100 focus-visible:opacity-100",
          block.locked && "opacity-100"
        )}
        onClick={() => onToggleLocked(block.id)}
      >
        <Icon name={block.locked ? "Lock" : "LockOpen"} aria-hidden="true" className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={t("templates.editor.removeBlock")}
        className="text-muted-foreground hover:text-destructive opacity-0 group-hover/layer-row:opacity-100 focus-visible:opacity-100"
        onClick={() => onRemove(block.id)}
      >
        <Icon name="Trash2" aria-hidden="true" className="size-3.5" />
      </Button>
    </div>
  )
}

export { LayerRow }
