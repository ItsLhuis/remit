"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  Separator,
  Toggle,
  Typography
} from "@/components/ui"

import {
  BLOCK_ICON_NAMES,
  BLOCK_LABEL_KEYS,
  SHAPE_VARIANT_ICON_NAMES,
  SHAPE_VARIANT_LABEL_KEYS
} from "../../labels"
import { type AddableBlockType, type ShapeVariant } from "../../schemas"
import { getBlockPalette } from "../../services"

import { type CanvasTool } from "./EditorCanvas"

type EditorFloatingToolbarProps = {
  tool: CanvasTool
  zoom: number
  disabled?: boolean
  onToolChange: (tool: CanvasTool) => void
  onAdd: (type: AddableBlockType) => void
  onAddShape: (variant: ShapeVariant) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomFit: () => void
}

// The insert menu lists every leaf/frame type as a direct entry and each shape as its own variant,
// so a click lands the exact block a user wants. Shapes are the one type that fans out (rectangle /
// ellipse / line) because their variant is the whole choice; every other type is a single entry.
const NON_SHAPE_TYPES = getBlockPalette().filter((blockType) => blockType !== "shape")
const SHAPE_VARIANTS = Object.keys(SHAPE_VARIANT_LABEL_KEYS) as ShapeVariant[]

// The one legitimately floating surface in the editor, so it is the one place a shadow appears
// (DESIGN.md Flat-By-Default: shadows are exclusively for elements above the page).
const EditorFloatingToolbar = ({
  tool,
  zoom,
  disabled,
  onToolChange,
  onAdd,
  onAddShape,
  onZoomIn,
  onZoomOut,
  onZoomFit
}: EditorFloatingToolbarProps) => {
  const { t } = useTranslation()

  return (
    <div className="bg-card ring-foreground/10 absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1.5 shadow-md ring-1">
      <Toggle
        size="sm"
        pressed={tool === "select"}
        onPressedChange={() => onToolChange("select")}
        aria-label={t("templates.editor.toolSelect")}
      >
        <Icon name="MousePointer2" aria-hidden="true" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={tool === "pan"}
        onPressedChange={() => onToolChange("pan")}
        aria-label={t("templates.editor.toolPan")}
      >
        <Icon name="Hand" aria-hidden="true" />
      </Toggle>
      <Separator orientation="vertical" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={t("templates.editor.insertMenu")}
          >
            <Icon name="Plus" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className="w-48">
          {NON_SHAPE_TYPES.map((blockType) => (
            <DropdownMenuItem key={blockType} onSelect={() => onAdd(blockType)}>
              <Icon name={BLOCK_ICON_NAMES[blockType]} aria-hidden="true" />
              {t(BLOCK_LABEL_KEYS[blockType])}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("templates.blocks.shape")}</DropdownMenuLabel>
          {SHAPE_VARIANTS.map((variant) => (
            <DropdownMenuItem key={variant} onSelect={() => onAddShape(variant)}>
              <Icon name={SHAPE_VARIANT_ICON_NAMES[variant]} aria-hidden="true" />
              {t(SHAPE_VARIANT_LABEL_KEYS[variant])}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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
      <Typography affects={["small", "medium"]} className="w-11 text-center tabular-nums">
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
        <Icon name="Maximize2" aria-hidden="true" />
      </Button>
    </div>
  )
}

export { EditorFloatingToolbar }
