"use client"

import { formatForDisplay } from "@tanstack/react-hotkeys"

import { useTranslation } from "@/lib/i18n"

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  Icon
} from "@/components/ui"

import { announce } from "../../engine"
import { type EditorInteraction, type TemplateEditorState } from "../../hooks"
import { BLOCK_ICON_NAMES, BLOCK_LABEL_KEYS } from "../../labels"
import { hitTestBlocks, type Point } from "../../services"

// The one canvas context menu (replacing the old per-block CanvasBlockMenu): it opens for whatever
// EditorCanvas resolved as "the selection under the cursor" at right-click time, or for the page
// when that selection is empty. Every row reads live selection/clipboard state at render time,
// which happens fresh on each open since Radix mounts ContextMenuContent only while open.

type CanvasContextMenuProps = {
  editor: TemplateEditorState
  interaction: EditorInteraction
  cursorPoint: Point | null
  disabled?: boolean
  onRenameRequest: (id: string) => void
}

const CanvasContextMenu = ({
  editor,
  interaction,
  cursorPoint,
  disabled,
  onRenameRequest
}: CanvasContextMenuProps) => {
  const { t } = useTranslation()

  const selectedIds = [...interaction.selection]
  const hasSelection = selectedIds.length > 0
  const isSingle = selectedIds.length === 1
  const singleId = isSingle ? selectedIds[0] : undefined
  const singleBlock =
    singleId !== undefined ? (editor.blockIndex.get(singleId)?.block ?? null) : null
  const hasTopLevelMember = selectedIds.some((id) => editor.blockIndex.get(id)?.parentId === null)
  const sameParent =
    hasSelection &&
    new Set(selectedIds.map((id) => editor.blockIndex.get(id)?.parentId ?? null)).size === 1
  const allLocked =
    hasSelection && selectedIds.every((id) => editor.blockIndex.get(id)?.block.locked === true)
  const allHidden =
    hasSelection && selectedIds.every((id) => editor.blockIndex.get(id)?.block.hidden === true)
  // groupSelection/wrapInFrame only accept an all-top-level, all-unlocked selection (see
  // wrapSelectionInContainer's own guard) - gating on that here keeps the menu from offering an
  // action that silently does nothing.
  const canWrapSelection =
    hasSelection &&
    selectedIds.every((id) => {
      const entry = editor.blockIndex.get(id)

      return entry?.parentId === null && entry.block.locked !== true
    })
  const canCopyStyle = isSingle && singleBlock !== null && singleBlock.type !== "group"
  const cursorHits = cursorPoint
    ? hitTestBlocks(editor.blockIndex, cursorPoint, { includeLocked: true })
    : []
  const isDisabled = disabled === true

  return (
    <ContextMenuContent>
      <ContextMenuItem
        disabled={isDisabled || !hasSelection}
        onSelect={() => editor.copySelection()}
      >
        <Icon name="Copy" aria-hidden="true" />
        {t("templates.editor.contextMenu.copy")}
        <ContextMenuShortcut>{formatForDisplay("Mod+C")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={isDisabled || !editor.hasClipboard()}
        onSelect={() => {
          editor.pasteClipboard()
          announce(t("templates.editor.pasted"))
        }}
      >
        <Icon name="Clipboard" aria-hidden="true" />
        {t("templates.editor.contextMenu.paste")}
        <ContextMenuShortcut>{formatForDisplay("Mod+V")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={isDisabled || !editor.hasClipboard() || !cursorPoint}
        onSelect={() => {
          if (!cursorPoint) return

          editor.pasteClipboard(cursorPoint)
          announce(t("templates.editor.pasted"))
        }}
      >
        <Icon name="ClipboardPaste" aria-hidden="true" />
        {t("templates.editor.contextMenu.pasteHere")}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={isDisabled || !hasTopLevelMember}
        onSelect={() => {
          const count = selectedIds.filter(
            (id) => editor.blockIndex.get(id)?.parentId === null
          ).length

          editor.duplicateSelection()
          announce(t("templates.editor.duplicated", { count }))
        }}
      >
        <Icon name="Copy" aria-hidden="true" />
        {t("templates.editor.duplicateBlock")}
        <ContextMenuShortcut>{formatForDisplay("Mod+D")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={isDisabled || !sameParent}
        onSelect={() => {
          editor.bringSelectionToFront()
          announce(t("templates.editor.broughtToFront"))
        }}
      >
        <Icon name="BringToFront" aria-hidden="true" />
        {t("templates.editor.bringToFront")}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={isDisabled || !isSingle}
        onSelect={() => {
          editor.bringSelectionForward()
          announce(t("templates.editor.broughtForward"))
        }}
      >
        <Icon name="ChevronUp" aria-hidden="true" />
        {t("templates.editor.bringForward")}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={isDisabled || !isSingle}
        onSelect={() => {
          editor.sendSelectionBackward()
          announce(t("templates.editor.sentBackward"))
        }}
      >
        <Icon name="ChevronDown" aria-hidden="true" />
        {t("templates.editor.sendBackward")}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={isDisabled || !sameParent}
        onSelect={() => {
          editor.sendSelectionToBack()
          announce(t("templates.editor.sentToBack"))
        }}
      >
        <Icon name="SendToBack" aria-hidden="true" />
        {t("templates.editor.sendToBack")}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={isDisabled || selectedIds.length < 2 || !canWrapSelection}
        onSelect={() => {
          const count = selectedIds.length
          const groupId = editor.groupSelection()

          announce(t("templates.editor.groupCreated", { count }))
          interaction.focusNode(groupId)
        }}
      >
        <Icon name="Group" aria-hidden="true" />
        {t("templates.editor.contextMenu.groupSelection")}
        <ContextMenuShortcut>{formatForDisplay("Mod+G")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={isDisabled || singleBlock?.type !== "group" || singleBlock.locked}
        onSelect={() => {
          if (singleBlock?.type !== "group") return

          const count = singleBlock.content.children.length
          const freedIds = editor.ungroup(singleBlock.id)

          announce(t("templates.editor.ungroupedBlocks", { count }))
          interaction.focusNode(freedIds?.[0] ?? null)
        }}
      >
        <Icon name="Ungroup" aria-hidden="true" />
        {t("templates.editor.ungroup")}
        <ContextMenuShortcut>{formatForDisplay("Mod+Shift+G")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={isDisabled || !canWrapSelection}
        onSelect={() => {
          const count = selectedIds.length
          const frameId = editor.wrapInFrame()

          announce(t("templates.editor.frameCreated", { count }))
          interaction.focusNode(frameId)
        }}
      >
        <Icon name="Frame" aria-hidden="true" />
        {t("templates.editor.contextMenu.wrapInFrame")}
        <ContextMenuShortcut>{formatForDisplay("Mod+Shift+W")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={isDisabled || !hasSelection}
        onSelect={() => editor.toggleLockedSelection()}
      >
        <Icon name={allLocked ? "LockOpen" : "Lock"} aria-hidden="true" />
        {allLocked ? t("templates.editor.unlockBlock") : t("templates.editor.lockBlock")}
        <ContextMenuShortcut>{formatForDisplay("Mod+Shift+L")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={isDisabled || !hasSelection}
        onSelect={() => editor.toggleHiddenSelection()}
      >
        <Icon name={allHidden ? "Eye" : "EyeOff"} aria-hidden="true" />
        {allHidden ? t("templates.editor.showBlock") : t("templates.editor.hideBlock")}
        <ContextMenuShortcut>{formatForDisplay("Mod+Shift+H")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        variant="destructive"
        disabled={isDisabled || !hasSelection}
        onSelect={() => editor.removeSelection(selectedIds)}
      >
        <Icon name="Trash2" aria-hidden="true" />
        {t("templates.editor.removeBlock")}
        <ContextMenuShortcut>{formatForDisplay("Delete")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={isDisabled || !isSingle}
        onSelect={() => singleId && onRenameRequest(singleId)}
      >
        <Icon name="Pencil" aria-hidden="true" />
        {t("templates.editor.renameBlock")}
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={isDisabled || cursorHits.length === 0}>
          <Icon name="Layers" aria-hidden="true" />
          {t("templates.editor.contextMenu.selectLayerUnderCursor")}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {cursorHits.map((id) => {
            const block = editor.blockIndex.get(id)?.block

            if (!block) return null

            return (
              <ContextMenuItem key={id} onSelect={() => interaction.select(id)}>
                <Icon name={BLOCK_ICON_NAMES[block.type]} aria-hidden="true" />
                {block.name ?? t(BLOCK_LABEL_KEYS[block.type])}
              </ContextMenuItem>
            )
          })}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={isDisabled || !canCopyStyle}
        onSelect={() => singleBlock && editor.copyStyle(singleBlock.id)}
      >
        <Icon name="Paintbrush" aria-hidden="true" />
        {t("templates.editor.contextMenu.copyStyle")}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={isDisabled || !editor.hasStyleClipboard() || !hasSelection}
        onSelect={() => editor.pasteStyle()}
      >
        <Icon name="PaintBucket" aria-hidden="true" />
        {t("templates.editor.contextMenu.pasteStyle")}
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

export { CanvasContextMenu }
