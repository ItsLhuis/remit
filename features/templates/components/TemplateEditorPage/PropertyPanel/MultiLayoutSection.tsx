"use client"

import { useTranslation } from "@/lib/i18n"

import { GRID_SIZE, MIN_BLOCK_HEIGHT, MIN_BLOCK_WIDTH } from "../../../schemas"
import { normalizeDegrees, type ContentBounds, type Point, type Rect } from "../../../services"

import { FieldRowNumber } from "./FieldRowNumber"
import { PanelSection } from "./PanelSection"

type MultiLayoutSectionProps = {
  union: Rect
  bounds: ContentBounds
  // The members' shared rotation, or null when they differ (the field then shows its Mixed
  // placeholder until a typed value sets every member).
  rotation: number | null
  disabled?: boolean
  onMove: (position: Point) => void
  onResize: (size: { width?: number; height?: number }) => void
  onRotate: (degrees: number) => void
}

// The multi-selection's shared rectangle: X/Y move the whole set as one unit (the same
// union-clamped move the drag gesture commits, one history entry); width and height scale every
// member proportionally through the shared resize primitive (services/resizeMath.ts's
// scaleBlockSet), anchored top-left exactly like a plain block's panel resize - the panel is a
// second entry point into the same primitive the handles commit through, never an independent way
// to author the union size.
const MultiLayoutSection = ({
  union,
  bounds,
  rotation,
  disabled,
  onMove,
  onResize,
  onRotate
}: MultiLayoutSectionProps) => {
  const { t } = useTranslation()

  return (
    <PanelSection label={t("templates.editor.sectionLayout")}>
      <FieldRowNumber
        id="multi-selection-x"
        label={t("templates.editor.positionX")}
        value={union.x}
        min={0}
        max={bounds.width - union.width}
        step={GRID_SIZE}
        disabled={disabled}
        onChange={(x) => onMove({ x: x ?? 0, y: union.y })}
      />
      <FieldRowNumber
        id="multi-selection-y"
        label={t("templates.editor.positionY")}
        value={union.y}
        min={0}
        max={bounds.height - union.height}
        step={GRID_SIZE}
        disabled={disabled}
        onChange={(y) => onMove({ x: union.x, y: y ?? 0 })}
      />
      <FieldRowNumber
        id="multi-selection-width"
        label={t("templates.editor.sizeWidth")}
        value={union.width}
        min={MIN_BLOCK_WIDTH}
        max={bounds.width - union.x}
        step={GRID_SIZE}
        disabled={disabled}
        onChange={(width) => onResize({ width: width ?? union.width })}
      />
      <FieldRowNumber
        id="multi-selection-height"
        label={t("templates.editor.sizeHeight")}
        value={union.height}
        min={MIN_BLOCK_HEIGHT}
        step={GRID_SIZE}
        disabled={disabled}
        onChange={(height) => onResize({ height: height ?? union.height })}
      />
      <FieldRowNumber
        id="multi-selection-rotation"
        label={t("templates.editor.rotation")}
        value={rotation}
        min={0}
        max={359.9}
        step={1}
        placeholder={t("templates.editor.mixedValue")}
        disabled={disabled}
        onChange={(degrees) => onRotate(normalizeDegrees(degrees ?? 0))}
      />
    </PanelSection>
  )
}

export { MultiLayoutSection }
