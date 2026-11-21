"use client"

import { KeyboardSensor, PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom"
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { Button, Icon } from "@/components/ui"

import { announce } from "../../engine"
import { type EditorInteraction, type TemplateEditorState } from "../../hooks"
import { BLOCK_LABEL_KEYS } from "../../labels"
import { type Block } from "../../schemas"

import { PAGE_GROUP, parseIntoDropId } from "./layerDropId"
import { LayerRow, type LayerRowData } from "./LayerRow"

type LayersListProps = {
  editor: TemplateEditorState
  interaction: EditorInteraction
  disabled?: boolean
}

type LayerTree = { rows: LayerRowData[]; groups: Map<string, string[]> }

// Every row plus its display-order sibling groups, walked depth-first with each level shown
// top-of-stack first (array order reversed) so the row painted last sits at the top of its group -
// matching the canvas z-order convention at every nesting level, not just the top one.
function buildLayerTree(blocks: Block[]): LayerTree {
  const rows: LayerRowData[] = []
  const groups = new Map<string, string[]>()

  const walk = (list: Block[], parentId: string | null, depth: number) => {
    const visual = list.toReversed()

    groups.set(
      parentId ?? PAGE_GROUP,
      visual.map((block) => block.id)
    )

    for (const block of visual) {
      rows.push({ block, parentId, depth })

      if (block.type === "frame") walk(block.content.children, block.id, depth + 1)
    }
  }

  walk(blocks, null, 1)

  return { rows, groups }
}

function rangeBetween(order: string[], anchor: string | undefined, id: string): string[] | null {
  const anchorIndex = anchor ? order.indexOf(anchor) : -1
  const targetIndex = order.indexOf(id)

  if (anchorIndex === -1 || targetIndex === -1) return null

  const [start, end] =
    anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]

  return order.slice(start, end + 1)
}

const sensors = [
  PointerSensor.configure({
    activationConstraints: [new PointerActivationConstraints.Distance({ value: 4 })]
  }),
  KeyboardSensor
]

const LayersList = ({ editor, interaction, disabled }: LayersListProps) => {
  const { t } = useTranslation()

  const { rows, groups } = buildLayerTree(editor.blocks)
  const rowsById = new Map(rows.map((row) => [row.block.id, row]))

  const nameFor = (block: Block) => block.name ?? t(BLOCK_LABEL_KEYS[block.type])

  const handleSelectRange = (id: string) => {
    const order = rows.map((row) => row.block.id)
    const range = rangeBetween(order, editor.selectedIds[editor.selectedIds.length - 1], id)

    if (range) {
      editor.setSelection(range)
    } else {
      editor.selectBlock(id)
    }
  }

  const applyIntoDrop = (frameId: string, draggedIds: string[], draggedName: string): boolean => {
    if (draggedIds.includes(frameId)) return false

    const applied = editor.reparentBlock(draggedIds, frameId)

    if (applied) announce(t("templates.editor.layerReparented", { name: draggedName }))

    return applied
  }

  const applyRowDrop = (
    draggedRow: LayerRowData,
    draggedIds: string[],
    targetRow: LayerRowData,
    draggedName: string
  ): void => {
    const targetGroup = targetRow.parentId ?? PAGE_GROUP
    const sourceGroup = draggedRow.parentId ?? PAGE_GROUP

    if (sourceGroup !== targetGroup) {
      if (editor.reparentBlock(draggedIds, targetGroup === PAGE_GROUP ? null : targetGroup)) {
        announce(t("templates.editor.layerReparented", { name: draggedName }))
      }

      return
    }

    const visualIds = groups.get(targetGroup) ?? []
    const visualIndex = visualIds.indexOf(targetRow.block.id)

    if (visualIndex === -1) return

    // Layer rows render top-most first; sibling indices are bottom-up.
    editor.reorderSibling(draggedRow.block.id, visualIds.length - 1 - visualIndex)
    announce(t("templates.editor.layerMoved", { name: draggedName }))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled) return

    const { source, target } = event.operation

    if (!source || !target) return

    const draggedId = String(source.id)
    const rawTargetId = String(target.id)

    if (rawTargetId === draggedId) return

    const draggedRow = rowsById.get(draggedId)

    if (!draggedRow) return

    const draggedIds =
      interaction.selection.has(draggedId) && interaction.selection.size > 1
        ? [...interaction.selection]
        : [draggedId]
    const draggedName = nameFor(draggedRow.block)

    const intoFrameId = parseIntoDropId(rawTargetId)

    if (intoFrameId !== null) {
      applyIntoDrop(intoFrameId, draggedIds, draggedName)

      return
    }

    const targetRow = rowsById.get(rawTargetId)

    if (targetRow) applyRowDrop(draggedRow, draggedIds, targetRow, draggedName)
  }

  return (
    <DragDropProvider sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-0.5 p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "justify-start gap-1.5 hover:bg-transparent",
            interaction.selection.size === 0 && "bg-muted"
          )}
          aria-pressed={interaction.selection.size === 0}
          onClick={() => editor.selectBlock(null)}
        >
          <Icon
            name="File"
            aria-hidden="true"
            className="text-muted-foreground size-3.5 shrink-0"
          />
          <span className="truncate text-xs">{t("templates.editor.pageLayer")}</span>
        </Button>
        {rows.length === 0 ? (
          <div className="px-2 py-1.5">
            <span className="text-muted-foreground text-xs">
              {t("templates.editor.layersEmpty")}
            </span>
          </div>
        ) : (
          rows.map((row) => {
            const groupId = row.parentId ?? PAGE_GROUP
            const groupIds = groups.get(groupId) ?? []

            return (
              <LayerRow
                key={row.block.id}
                block={row.block}
                indent={row.depth}
                index={groupIds.indexOf(row.block.id)}
                group={groupId}
                isSelected={interaction.selection.has(row.block.id)}
                disabled={disabled}
                onSelectExact={editor.selectBlock}
                onToggleSelect={editor.toggleSelection}
                onSelectRange={handleSelectRange}
                onHover={interaction.setHovered}
                onToggleHidden={editor.toggleHidden}
                onToggleLocked={editor.toggleLocked}
                onRemove={editor.removeBlock}
                onRename={editor.renameBlock}
              />
            )
          })
        )}
      </div>
    </DragDropProvider>
  )
}

export { LayersList }
