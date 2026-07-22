"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useHotkey } from "@tanstack/react-hotkeys"

import { useTranslation } from "@/lib/i18n"

import { resolveStorageUrl } from "@/lib/storage"

import { toast } from "@/components/ui"

import { useEditorInteraction, useTemplateEditor } from "../../hooks"
import { setDefaultTemplate, updateTemplate } from "../../mutations"
import { buildSampleRenderData, getTemplateCategory } from "../../services"
import { type TemplateEditorData } from "../../types"

import { EditorCanvas, type CanvasTool } from "./EditorCanvas"
import { EditorFloatingToolbar } from "./EditorFloatingToolbar"
import { EditorLeftPanel } from "./EditorLeftPanel"
import { EditorStatusBar } from "./EditorStatusBar"
import { EditorTopBar } from "./EditorTopBar"
import { announce } from "./engine/announcer"
import { PropertyPanel } from "./PropertyPanel"
import { RenameBlockDialog } from "./RenameBlockDialog"
import { RenameTemplateDialog } from "./RenameTemplateDialog"
import { TemplatePreview } from "./TemplatePreview"

type TemplateEditorPageProps = {
  template: TemplateEditorData
}

// The editor shell: it owns the document hook, the interaction store and the pane composition, and
// every piece of chrome it renders reads that one state.
// react-doctor-disable-next-line no-giant-component
const TemplateEditorPage = ({ template }: TemplateEditorPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  // Locally-editable optimistic copies seeded from the server prop (rename dialog / page-settings
  // subject), re-synced through savedDetails after a successful save plus router.refresh().
  // react-doctor-disable-next-line no-derived-useState
  const [name, setName] = useState(template.name)
  // react-doctor-disable-next-line no-derived-useState
  const [subject, setSubject] = useState(template.subject)
  const [savedDetails, setSavedDetails] = useState({
    name: template.name,
    subject: template.subject
  })
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [renameBlockId, setRenameBlockId] = useState<string | null>(null)
  const [isPreview, setIsPreview] = useState(false)
  const [gridVisible, setGridVisible] = useState(true)
  const [tool, setTool] = useState<CanvasTool>("select")
  const [fitCounter, setFitCounter] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSaving, startSaving] = useTransition()

  const rootRef = useRef<HTMLDivElement>(null)

  const editor = useTemplateEditor(
    template.blocks,
    template.type,
    template.pageSettings,
    template.assets
  )

  // Shared between the canvas engine and the layers panel: both react to and drive the same
  // selection/hover state, so the store is instantiated once at the page level.
  const interaction = useEditorInteraction(editor)

  const isEmail = getTemplateCategory(template.type) === "email"

  const renderData = useMemo(() => buildSampleRenderData(template.type), [template.type])

  const resolvedAssets = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(editor.assets).map(([uploadId, storageKey]) => [
          uploadId,
          resolveStorageUrl(storageKey) ?? storageKey
        ])
      ),
    [editor.assets]
  )

  const isDirty = editor.isDirty || name !== savedDetails.name || subject !== savedDetails.subject

  const handleSave = () => {
    if (isSaving || !isDirty) return

    startSaving(async () => {
      const result = await updateTemplate({
        id: template.id,
        name,
        subject,
        blocks: editor.blocks,
        pageSettings: editor.pageSettings
      })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      editor.markSaved()
      setSavedDetails({ name, subject })
      toast.success(t("templates.editor.save"))
      router.refresh()
    })
  }

  const handleSetDefault = () => {
    startSaving(async () => {
      const result = await setDefaultTemplate({ id: template.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("templates.actions.setDefault"))
      router.refresh()
    })
  }

  const handleToggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void rootRef.current?.requestFullscreen()
    }
  }

  const requestFit = () => setFitCounter((counter) => counter + 1)

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
    handleSave()
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
    setIsPreview((current) => !current)
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

  const canWrapSelection = editor.selectedIds.every((id) => {
    const entry = editor.blockIndex.get(id)

    return entry?.parentId === null && entry.block.locked !== true
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

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement !== null)

    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  return (
    <div ref={rootRef} className="bg-background flex h-svh flex-col">
      <EditorTopBar
        template={template}
        name={name}
        zoom={editor.zoom}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        isDirty={isDirty}
        isSaving={isSaving}
        isPreview={isPreview}
        isFullscreen={isFullscreen}
        gridVisible={gridVisible}
        onZoomIn={editor.zoomIn}
        onZoomOut={editor.zoomOut}
        onZoomFit={requestFit}
        onToggleFullscreen={handleToggleFullscreen}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onGridVisibleChange={setGridVisible}
        onRenameOpen={() => setIsRenameOpen(true)}
        onTogglePreview={() => setIsPreview((current) => !current)}
        onSetDefault={handleSetDefault}
        onSave={handleSave}
      />
      <div className="flex min-h-0 flex-1">
        <EditorLeftPanel editor={editor} interaction={interaction} disabled={isSaving} />
        <main className="relative flex min-w-0 flex-1 flex-col">
          {isPreview ? (
            <TemplatePreview
              blocks={editor.blocks}
              type={template.type}
              pageSettings={editor.pageSettings}
              renderData={renderData}
              assets={resolvedAssets}
              zoom={editor.zoom}
            />
          ) : (
            <EditorCanvas
              editor={editor}
              interaction={interaction}
              type={template.type}
              renderData={renderData}
              assets={resolvedAssets}
              gridVisible={gridVisible}
              tool={tool}
              fitCounter={fitCounter}
              disabled={isSaving}
              onRenameBlockRequest={setRenameBlockId}
            />
          )}
          {isPreview ? null : (
            <EditorFloatingToolbar
              tool={tool}
              zoom={editor.zoom}
              disabled={isSaving}
              onToolChange={setTool}
              onAdd={editor.addBlock}
              onAddShape={editor.addShape}
              onZoomIn={editor.zoomIn}
              onZoomOut={editor.zoomOut}
              onZoomFit={requestFit}
            />
          )}
        </main>
        <aside className="bg-card border-border flex w-70 shrink-0 flex-col border-l">
          <PropertyPanel
            editor={editor}
            type={template.type}
            assets={resolvedAssets}
            isEmail={isEmail}
            subject={subject}
            disabled={isSaving}
            onSubjectChange={setSubject}
          />
        </aside>
      </div>
      <EditorStatusBar selectedBlock={editor.selectedBlock} />
      <RenameTemplateDialog
        open={isRenameOpen}
        name={name}
        onOpenChange={setIsRenameOpen}
        onRename={setName}
      />
      <RenameBlockDialog
        open={renameBlockId !== null}
        name={(renameBlockId ? editor.blockIndex.get(renameBlockId)?.block.name : undefined) ?? ""}
        onOpenChange={(open) => {
          if (!open) setRenameBlockId(null)
        }}
        onRename={(nextName) => {
          if (renameBlockId) editor.renameBlock(renameBlockId, nextName)

          setRenameBlockId(null)
        }}
      />
    </div>
  )
}

export { TemplateEditorPage }
