"use client"

import { useSyncExternalStore, type RefObject } from "react"

import { useHotkeys, type UseHotkeyDefinition } from "@tanstack/react-hotkeys"

import { useTranslation } from "@/lib/i18n"

import { announce } from "../../engine"
import { type EditorInteraction } from "../../hooks"
import { BLOCK_LABEL_KEYS } from "../../labels"
import { GRID_SIZE, type Block } from "../../schemas"

// Keyboard bindings for one block, scoped to its focusable surface. Rendered only while the block
// is interactive, so locked and hidden blocks register nothing.

const NUDGE_LARGE = 10

const ARROW_DELTAS = [
  ["ArrowUp", 0, -1],
  ["ArrowDown", 0, 1],
  ["ArrowLeft", -1, 0],
  ["ArrowRight", 1, 0]
] as const

// Derives a boolean rather than the overlay snapshot, which changes every drag frame, so
// useSyncExternalStore bails out and a block's hotkeys never re-render per frame.
function hasActiveGesture(interaction: EditorInteraction): boolean {
  return interaction.getOverlay().gesture !== null
}

type CanvasBlockHotkeysProps = {
  block: Block
  target: RefObject<HTMLElement | null>
  interaction: EditorInteraction
  onNudge: (ids: readonly string[], dxCells: number, dyCells: number) => void
  onMoveBy: (ids: readonly string[], dxPixels: number, dyPixels: number) => void
  onResizeBy: (id: string, dwCells: number, dhCells: number) => void
  onRemove: (ids: readonly string[]) => void
  onDescend: (id: string) => string | null
  onAscend: (id: string) => string | null
}

const CanvasBlockHotkeys = ({
  block,
  target,
  interaction,
  onNudge,
  onMoveBy,
  onResizeBy,
  onRemove,
  onDescend,
  onAscend
}: CanvasBlockHotkeysProps) => {
  const { t } = useTranslation()

  // Gated so a hotkey commit mid-drag cannot invalidate an in-flight gesture's baseRects.
  const gestureActive = useSyncExternalStore(
    interaction.subscribeOverlay,
    () => hasActiveGesture(interaction),
    () => hasActiveGesture(interaction)
  )

  // An arrow key on a multi-selection member moves the whole selection as one unit; on any other
  // block it moves that block alone.
  const moveTargets =
    interaction.selection.size > 1 && interaction.selection.has(block.id)
      ? [...interaction.selection]
      : [block.id]

  const announceMove = (dxPixels: number, dyPixels: number) => {
    announce(
      t("templates.editor.gesture.move", {
        name: t(BLOCK_LABEL_KEYS[block.type]),
        position: `${block.layout.x + dxPixels}, ${block.layout.y + dyPixels}`
      })
    )
  }

  // Focus must follow the selection, so a repeated Enter keeps descending a level each time.
  const focusBlock = (id: string | null) => {
    if (id === null) return

    interaction.getNode(id)?.querySelector("button")?.focus()
  }

  const definitions: UseHotkeyDefinition[] = [
    ...ARROW_DELTAS.flatMap(([key, dx, dy]): UseHotkeyDefinition[] => [
      {
        hotkey: key,
        callback: () => {
          onNudge(moveTargets, dx, dy)
          announceMove(dx * GRID_SIZE, dy * GRID_SIZE)
        }
      },
      {
        hotkey: `Shift+${key}`,
        callback: () => {
          onMoveBy(moveTargets, dx * NUDGE_LARGE, dy * NUDGE_LARGE)
          announceMove(dx * NUDGE_LARGE, dy * NUDGE_LARGE)
        }
      },
      {
        hotkey: `Mod+${key}`,
        callback: () => onResizeBy(block.id, dx, dy),
        options: { ignoreInputs: true }
      }
    ]),
    { hotkey: "Delete", callback: () => onRemove(moveTargets) },
    { hotkey: "Backspace", callback: () => onRemove(moveTargets) },
    {
      hotkey: "Enter",
      callback: () => {
        const next = onDescend(block.id)

        if (next !== null) {
          focusBlock(next)

          return
        }

        if (block.type !== "text") return

        interaction.startTextEdit(block.id)
        announce(t("templates.editor.textEdit.enter", { name: t(BLOCK_LABEL_KEYS[block.type]) }))
      }
    },
    { hotkey: "Shift+Enter", callback: () => focusBlock(onAscend(block.id)) }
  ]

  // Already inert while inline editing, since CanvasBlock unmounts the `target` button that same
  // render; disabling explicitly keeps the intent visible rather than relying on that ordering.
  useHotkeys(definitions, {
    target,
    enabled: !gestureActive && interaction.editingTextId !== block.id
  })

  return null
}

export { CanvasBlockHotkeys }
