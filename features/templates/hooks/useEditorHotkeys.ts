"use client"

import { useHotkey } from "@tanstack/react-hotkeys"

import { useTranslation } from "@/lib/i18n"

import { announce } from "../engine"

import { type EditorInteraction } from "./useEditorInteraction"
import { type TemplateEditorState } from "./useTemplateEditor"

type EditorHotkeysOptions = {
  editor: TemplateEditorState
  interaction: EditorInteraction
  onSave: () => void
  onTogglePreview: () => void
}

// The editor's global keyboard map. It lives apart from the page shell because it is one concern -
// every binding reads the same document hook and announces through the same live region - and
// because registration order is the map itself, which is easier to audit in one place.
export function useEditorHotkeys({
  editor,
  interaction,
  onSave,
  onTogglePreview
}: EditorHotkeysOptions): void {
  const { t } = useTranslation()

  // Wrapping a selection is only legal for top-level, unlocked blocks; both the group and the frame
  // binding gate on it.
  const canWrapSelection = editor.selectedIds.every((id) => {
    const entry = editor.blockIndex.get(id)

    return entry?.parentId === null && entry.block.locked !== true
  })

  useHotkey("Mod+Z", (event) => {
    event.preventDefault()
    editor.undo()
  })

  useHotkey("Mod+Shift+Z", (event) => {
    event.preventDefault()
    editor.redo()
  })

  useHotkey("Mod+S", (event) => {
    event.preventDefault()
    onSave()
  })

  useHotkey("Mod+D", (event) => {
    const count = editor.selectedIds.filter(
      (id) => editor.blockIndex.get(id)?.parentId === null
    ).length

    if (count === 0) return

    event.preventDefault()
    editor.duplicateSelection()
    announce(t("templates.editor.duplicated", { count }))
  })

  useHotkey(
    "Mod+C",
    (event) => {
      if (editor.selectedIds.length === 0) return

      event.preventDefault()
      editor.copySelection()
    },
    { ignoreInputs: true }
  )

  useHotkey(
    "Mod+V",
    (event) => {
      if (!editor.hasClipboard()) return

      event.preventDefault()
      editor.pasteClipboard()
      announce(t("templates.editor.pasted"))
    },
    { ignoreInputs: true }
  )

  useHotkey("Mod+P", (event) => {
    event.preventDefault()
    onTogglePreview()
  })

  useHotkey("Mod+Shift+H", (event) => {
    if (editor.selectedIds.length === 0) return

    event.preventDefault()
    editor.toggleHiddenSelection()
  })

  useHotkey("Mod+Shift+L", (event) => {
    if (editor.selectedIds.length === 0) return

    event.preventDefault()
    editor.toggleLockedSelection()
  })

  useHotkey("Mod+G", (event) => {
    if (editor.selectedIds.length === 0 || !canWrapSelection) return

    const count = editor.selectedIds.length

    event.preventDefault()

    const groupId = editor.groupSelection()

    announce(t("templates.editor.groupCreated", { count }))
    interaction.focusNode(groupId)
  })

  useHotkey("Mod+Shift+G", (event) => {
    if (editor.selectedBlock?.type !== "group" || editor.selectedBlock.locked) return

    const count = editor.selectedBlock.content.children.length

    event.preventDefault()

    const freedIds = editor.ungroup(editor.selectedBlock.id)

    announce(t("templates.editor.ungroupedBlocks", { count }))
    interaction.focusNode(freedIds?.[0] ?? null)
  })

  useHotkey("Mod+Shift+W", (event) => {
    if (editor.selectedIds.length === 0 || !canWrapSelection) return

    const count = editor.selectedIds.length

    event.preventDefault()

    const frameId = editor.wrapInFrame()

    announce(t("templates.editor.frameCreated", { count }))
    interaction.focusNode(frameId)
  })

  useHotkey("Mod+=", (event) => {
    event.preventDefault()
    editor.zoomIn()
  })

  useHotkey("Mod+-", (event) => {
    event.preventDefault()
    editor.zoomOut()
  })

  useHotkey("Mod+0", (event) => {
    event.preventDefault()
    editor.setZoom(1)
  })
}
