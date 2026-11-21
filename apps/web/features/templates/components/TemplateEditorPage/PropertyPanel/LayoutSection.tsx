"use client"

import { useTranslation } from "@/lib/i18n"

import {
  BLOCK_CAPABILITIES,
  GRID_SIZE,
  MIN_BLOCK_HEIGHT,
  MIN_BLOCK_WIDTH,
  type Block,
  type BlockCapability
} from "../../../schemas"
import {
  normalizeDegrees,
  type ContentBounds,
  type Rect,
  type ResizeEdges
} from "../../../services"

import { FieldRowNumber } from "./FieldRowNumber"
import { PanelSection } from "./PanelSection"

type LayoutSectionProps = {
  block: Block
  isChild: boolean
  bounds: ContentBounds
  disabled?: boolean
  onMove: (id: string, x: number, y: number, tag?: string | null) => void
  onResize: (id: string, desired: Rect, edges: ResizeEdges) => void
  onRotate: (id: string, degrees: number, tag?: string | null) => void
}

// The block's rectangle, editable in whole grid cells: position moves through the displacement
// resolver, size through the hard-clamp resolver, so typed values obey the same invariants as
// drags. Box children have no canvas position (the box arranges them), so they expose size only.
const LayoutSection = ({
  block,
  isChild,
  bounds,
  disabled,
  onMove,
  onResize,
  onRotate
}: LayoutSectionProps) => {
  const { t } = useTranslation()

  const capability: BlockCapability = BLOCK_CAPABILITIES[block.type]
  const { layout } = block

  const fieldDisabled = disabled || block.locked

  const resize = (size: { width?: number; height?: number }) => {
    onResize(
      block.id,
      {
        ...layout,
        width: size.width ?? layout.width,
        height: size.height ?? layout.height
      },
      { horizontal: "e", vertical: "s" }
    )
  }

  return (
    <PanelSection label={t("templates.editor.sectionLayout")}>
      {isChild ? null : (
        <>
          <FieldRowNumber
            id={`${block.id}-x`}
            label={t("templates.editor.positionX")}
            value={layout.x}
            min={0}
            max={bounds.width - layout.width}
            step={GRID_SIZE}
            disabled={fieldDisabled}
            onChange={(x) => onMove(block.id, x ?? 0, layout.y, `layout:${block.id}`)}
          />
          <FieldRowNumber
            id={`${block.id}-y`}
            label={t("templates.editor.positionY")}
            value={layout.y}
            min={0}
            max={bounds.height - layout.height}
            step={GRID_SIZE}
            disabled={fieldDisabled}
            onChange={(y) => onMove(block.id, layout.x, y ?? 0, `layout:${block.id}`)}
          />
        </>
      )}
      {capability.resizableAxes === "both" || capability.resizableAxes === "width" ? (
        <FieldRowNumber
          id={`${block.id}-width`}
          label={t("templates.editor.sizeWidth")}
          value={layout.width}
          min={MIN_BLOCK_WIDTH}
          max={bounds.width}
          step={GRID_SIZE}
          disabled={fieldDisabled}
          onChange={(width) => resize({ width: width ?? layout.width })}
        />
      ) : null}
      {capability.resizableAxes === "both" || capability.resizableAxes === "height" ? (
        <FieldRowNumber
          id={`${block.id}-height`}
          label={t("templates.editor.sizeHeight")}
          value={layout.height}
          min={MIN_BLOCK_HEIGHT}
          step={GRID_SIZE}
          disabled={fieldDisabled}
          onChange={(height) => resize({ height: height ?? layout.height })}
        />
      ) : null}
      {block.type === "group" ? null : (
        <FieldRowNumber
          id={`${block.id}-rotation`}
          label={t("templates.editor.rotation")}
          value={block.rotation ?? 0}
          min={0}
          max={359.9}
          step={1}
          disabled={fieldDisabled}
          onChange={(degrees) =>
            onRotate(block.id, normalizeDegrees(degrees ?? 0), `layout:${block.id}`)
          }
        />
      )}
    </PanelSection>
  )
}

export { LayoutSection }
