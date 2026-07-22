"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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

type EditorTopBarProps = {
  template: TemplateEditorData
  name: string
  zoom: number
  canUndo: boolean
  canRedo: boolean
  isDirty: boolean
  isSaving: boolean
  isPreview: boolean
  isFullscreen: boolean
  gridVisible: boolean
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

// Editor chrome props are orthogonal editor-state facts (sharing, dirtiness, preview, fullscreen,
// grid) driven by one hook; bundling them into option objects removes no state.
// react-doctor-disable-next-line no-many-boolean-props
const EditorTopBar = ({
  template,
  name,
  zoom,
  canUndo,
  canRedo,
  isDirty,
  isSaving,
  isPreview,
  isFullscreen,
  gridVisible,
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
            isFullscreen ? t("templates.editor.exitFullscreen") : t("templates.editor.fullscreen")
          }
          onClick={onToggleFullscreen}
        >
          <Icon name={isFullscreen ? "Minimize2" : "Maximize2"} aria-hidden="true" />
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
          <Badge variant="secondary">{t("templates.badges.default")}</Badge>
        ) : null}
        {template.isSystem ? <Badge variant="outline">{t("templates.badges.system")}</Badge> : null}
        {isDirty ? (
          <Typography affects={["muted", "tiny"]}>{t("templates.editor.unsaved")}</Typography>
        ) : null}
      </div>
      <div className="flex flex-1 items-center justify-end gap-1">
        <Toggle
          size="sm"
          variant="outline"
          pressed={gridVisible}
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
              disabled={!canUndo}
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
              disabled={!canRedo}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("templates.editor.moreActions")}
              >
                <Icon name="EllipsisVertical" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={isSaving} onSelect={onSetDefault}>
                <Icon name="Star" aria-hidden="true" />
                {t("templates.actions.setDefault")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Toggle
          size="sm"
          variant="outline"
          pressed={isPreview}
          onPressedChange={onTogglePreview}
          aria-label={t("templates.editor.previewTab")}
        >
          <Icon name="Eye" aria-hidden="true" />
          {t("templates.editor.previewTab")}
        </Toggle>
        <Button type="button" size="sm" disabled={isSaving || !isDirty} onClick={onSave}>
          {isSaving && <Spinner />}
          {t("templates.editor.save")}
        </Button>
      </div>
    </header>
  )
}

export { EditorTopBar }
