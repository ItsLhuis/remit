"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  Badge,
  Button,
  Icon,
  Separator,
  Spinner,
  Toggle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Typography
} from "@/components/ui"

import { type TemplateEditorData } from "../../types"

// The chrome's boolean facts, grouped by the concern each one belongs to. Passed as objects rather
// than as a flat row of same-typed flags so neighbouring booleans cannot be transposed at the call
// site without the compiler noticing.
export type EditorHistoryState = { canUndo: boolean; canRedo: boolean }

export type EditorSaveState = { isDirty: boolean; isSaving: boolean }

export type EditorViewState = { isPreview: boolean; isFullscreen: boolean; gridVisible: boolean }

type EditorTopBarProps = {
  template: TemplateEditorData
  name: string
  zoom: number
  history: EditorHistoryState
  save: EditorSaveState
  view: EditorViewState
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomFit: () => void
  onToggleFullscreen: () => void
  onUndo: () => void
  onRedo: () => void
  onGridVisibleChange: (visible: boolean) => void
  onRenameOpen: () => void
  onTogglePreview: () => void
  onSetDefault: () => void
  onSave: () => void
}

const EditorTopBar = ({
  template,
  name,
  zoom,
  history,
  save,
  view,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onToggleFullscreen,
  onUndo,
  onRedo,
  onGridVisibleChange,
  onRenameOpen,
  onTogglePreview,
  onSetDefault,
  onSave
}: EditorTopBarProps) => {
  const { t } = useTranslation()

  return (
    <header className="bg-card border-border flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3">
      <div className="flex flex-1 items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" asChild>
          <Link href="/templates" aria-label={t("templates.actions.backToList")}>
            <Icon name="ArrowLeft" aria-hidden="true" />
          </Link>
        </Button>
        <Separator orientation="vertical" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("templates.editor.zoomOut")}
          onClick={onZoomOut}
        >
          <Icon name="Minus" aria-hidden="true" />
        </Button>
        <Typography affects={["small", "medium"]} className="w-12 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </Typography>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("templates.editor.zoomIn")}
          onClick={onZoomIn}
        >
          <Icon name="Plus" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("templates.editor.zoomFit")}
          onClick={onZoomFit}
        >
          <Icon name="Maximize" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={
            view.isFullscreen
              ? t("templates.editor.exitFullscreen")
              : t("templates.editor.fullscreen")
          }
          onClick={onToggleFullscreen}
        >
          <Icon name={view.isFullscreen ? "Minimize2" : "Maximize2"} aria-hidden="true" />
        </Button>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <Typography affects={["small", "medium"]} className="truncate">
          {name}
        </Typography>
        {template.isSystem ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("templates.editor.renameTemplate")}
            onClick={onRenameOpen}
          >
            <Icon name="Pencil" aria-hidden="true" />
          </Button>
        )}
        {template.isDefault ? (
          <Badge>
            <Icon name="Star" aria-hidden="true" />
            {t("templates.badges.default")}
          </Badge>
        ) : null}
        {template.isSystem ? (
          <Badge variant="outline">
            <Icon name="Lock" aria-hidden="true" />
            {t("templates.badges.system")}
          </Badge>
        ) : null}
        {save.isDirty ? (
          <Typography affects={["muted", "tiny"]}>{t("templates.editor.unsaved")}</Typography>
        ) : null}
      </div>
      <div className="flex flex-1 items-center justify-end gap-1">
        <Toggle
          size="sm"
          variant="outline"
          pressed={view.gridVisible}
          onPressedChange={onGridVisibleChange}
          aria-label={t("templates.editor.showGrid")}
        >
          <Icon name="Grid3x3" aria-hidden="true" />
        </Toggle>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!history.canUndo}
              aria-label={t("templates.editor.undo")}
              onClick={onUndo}
            >
              <Icon name="Undo2" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("templates.editor.undo")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!history.canRedo}
              aria-label={t("templates.editor.redo")}
              onClick={onRedo}
            >
              <Icon name="Redo2" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("templates.editor.redo")}</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" />
        {template.isDefault ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={save.isSaving}
            onClick={onSetDefault}
          >
            <Icon name="Star" aria-hidden="true" />
            {t("templates.actions.setDefault")}
          </Button>
        )}
        <Toggle
          size="sm"
          variant="outline"
          pressed={view.isPreview}
          onPressedChange={onTogglePreview}
          aria-label={t("templates.editor.previewTab")}
        >
          <Icon name="Eye" aria-hidden="true" />
          {t("templates.editor.previewTab")}
        </Toggle>
        <Button type="button" size="sm" disabled={save.isSaving || !save.isDirty} onClick={onSave}>
          {save.isSaving && <Spinner />}
          {t("templates.editor.save")}
        </Button>
      </div>
    </header>
  )
}

export { EditorTopBar }
