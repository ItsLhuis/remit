"use client"

import { useSyncExternalStore } from "react"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { type EditorInteraction, type InteractionOverlay } from "../hooks"
import { BLOCK_CAPABILITIES, type BlockResizableAxes } from "../schemas"
import {
  cursorForHandle,
  handlePositions,
  unionRects,
  ALL_HANDLE_DIRECTIONS,
  type BlockIndex,
  type BlockIndexEntry,
  type ContentBounds,
  type HandleDirection,
  type Point,
  type Rect
} from "../services"

import { ROTATE_CURSOR } from "./pressState"

// Screen-constant hit target per handle: never below 12px on screen. The
// overlay lives outside the zoom-scaled wrapper, so this stays 12 physical pixels at every zoom.
const HANDLE_SIZE = 12

// The rotate zones sit just outside the corner handles: a screen-constant hit target centered this
// many pixels outward from each corner along its diagonal, never covering the handle itself.
const ROTATE_ZONE_SIZE = 16
const ROTATE_ZONE_OFFSET = 14

const ROTATE_ZONE_CORNERS = ["nw", "ne", "se", "sw"] as const

// Height-only/width-only capability keeps the midpoint-pair fallback; every
// current type is "both", so all eight render today.
function handleDirectionsFor(axes: BlockResizableAxes): readonly HandleDirection[] {
  if (axes === "both") return ALL_HANDLE_DIRECTIONS
  if (axes === "width") return ["e", "w"]
  if (axes === "height") return ["n", "s"]

  return []
}

type SelectionChrome = {
  // A multi-selection shows a union box with no resize affordance (multi/group resize arrives
  // with the shared resize primitive); a single selection keeps its eight-handle chrome.
  isMultiSelection: boolean
  selectionRect: Rect | null
  handleAxes: BlockResizableAxes
  // A sole selection's own rotation: its handles, cursors, and rotate zones follow the rotated
  // corners. A multi-selection's chrome is the axis-aligned union at rotation 0.
  rotation: number
}

function resolveSelectionChrome(
  interaction: EditorInteraction,
  blockIndex: BlockIndex,
  overlay: InteractionOverlay,
  disabled: boolean | undefined
): SelectionChrome {
  const entries = [...interaction.selection]
    .map((id) => blockIndex.get(id))
    .filter((entry): entry is BlockIndexEntry => entry !== undefined)

  const visible =
    disabled !== true &&
    (overlay.gesture === null || overlay.gesture.kind === "resize") &&
    entries.length > 0 &&
    entries.every((entry) => !entry.block.locked && !entry.block.hidden)

  const selectionRect = visible
    ? unionRects(entries.map((entry) => overlay.liveRects?.get(entry.block.id) ?? entry.pageRect))
    : null

  const soleEntry = entries.length === 1 ? entries[0] : undefined

  return {
    isMultiSelection: entries.length > 1,
    selectionRect,
    handleAxes: soleEntry ? BLOCK_CAPABILITIES[soleEntry.block.type].resizableAxes : "both",
    rotation: soleEntry?.rotation ?? 0
  }
}

// A rotate zone's screen position: the corner handle's screen point pushed outward along the line
// from the selection's center through that corner, so the zones follow the rotated corners.
function rotateZonePosition(
  corner: Point,
  center: Point,
  margins: { top: number; left: number },
  zoom: number
): Point {
  const screen = { x: (margins.left + corner.x) * zoom, y: (margins.top + corner.y) * zoom }
  const length = Math.hypot(screen.x - center.x, screen.y - center.y) || 1

  return {
    x: screen.x + ((screen.x - center.x) / length) * ROTATE_ZONE_OFFSET,
    y: screen.y + ((screen.y - center.y) / length) * ROTATE_ZONE_OFFSET
  }
}

function hoveredRectFor(
  interaction: EditorInteraction,
  blockIndex: BlockIndex,
  overlay: InteractionOverlay
): Rect | null {
  if (overlay.gesture !== null || overlay.hoveredId === null) return null

  const entry = blockIndex.get(overlay.hoveredId)

  if (!entry || interaction.selection.has(entry.block.id)) return null

  return entry.pageRect
}

type LiveOverlayProps = {
  interaction: EditorInteraction
  blockIndex: BlockIndex
  bounds: ContentBounds
  margins: { top: number; bottom: number; left: number }
  pageHeight: number
  zoom: number
  disabled?: boolean
}

// The only per-frame React surface: resize handles around the selection plus
// the content-bounds outline and guide lines while a gesture is active. It subscribes to the
// interaction store's overlay snapshot — during a gesture the live per-member rects arrive
// through it each frame — while idle chrome derives from the committed block index. Rendered in
// screen space (outside the zoom-scaled wrapper) so handles and hairlines stay crisp at every
// zoom; every canvas coordinate is multiplied by zoom on the way out.
const LiveOverlay = ({
  interaction,
  blockIndex,
  bounds,
  margins,
  pageHeight,
  zoom,
  disabled
}: LiveOverlayProps) => {
  const { t } = useTranslation()

  const overlay = useSyncExternalStore(
    interaction.subscribeOverlay,
    interaction.getOverlay,
    interaction.getOverlay
  )

  const gestureActive = overlay.gesture !== null

  const { isMultiSelection, selectionRect, handleAxes, rotation } = resolveSelectionChrome(
    interaction,
    blockIndex,
    overlay,
    disabled
  )

  const hoveredRect = hoveredRectFor(interaction, blockIndex, overlay)

  // A group and a multi-selection resize through the same shared-box primitive as a single block
  // (services/resizeMath.ts's scaleBlockSet), so the eight handles render on the union rect exactly
  // like a single block's own rect; handleAxes already resolves to "both" for a multi-selection.
  const positions = selectionRect ? handlePositions(selectionRect, rotation) : null

  const selectionCenter = selectionRect
    ? {
        x: (margins.left + selectionRect.x + selectionRect.width / 2) * zoom,
        y: (margins.top + selectionRect.y + selectionRect.height / 2) * zoom
      }
    : null

  const badgeAnchor =
    overlay.rotationBadge !== null && overlay.liveRects
      ? unionRects([...overlay.liveRects.values()])
      : null

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {gestureActive ? (
        <div
          aria-hidden="true"
          className="border-primary/50 absolute border border-dashed"
          style={{
            top: margins.top * zoom,
            left: margins.left * zoom,
            width: bounds.width * zoom,
            height: (pageHeight - margins.top - margins.bottom) * zoom
          }}
        />
      ) : null}
      {hoveredRect ? (
        <div
          aria-hidden="true"
          className="border-primary/60 absolute border border-dashed"
          style={{
            left: (margins.left + hoveredRect.x) * zoom,
            top: (margins.top + hoveredRect.y) * zoom,
            width: hoveredRect.width * zoom,
            height: hoveredRect.height * zoom
          }}
        />
      ) : null}
      {overlay.guides.map((guide) => (
        <div
          key={guide.key}
          aria-hidden="true"
          className={cn(
            "absolute",
            guide.emphasis === "reached" ? "bg-primary" : "bg-primary/50",
            guide.orientation === "vertical" ? "inset-y-0 w-px" : "inset-x-0 h-px"
          )}
          style={
            guide.orientation === "vertical" ? { left: guide.at * zoom } : { top: guide.at * zoom }
          }
        />
      ))}
      {overlay.marquee ? (
        <div
          aria-hidden="true"
          className="border-primary bg-primary/10 absolute border"
          style={{
            left: (margins.left + overlay.marquee.x) * zoom,
            top: (margins.top + overlay.marquee.y) * zoom,
            width: overlay.marquee.width * zoom,
            height: overlay.marquee.height * zoom
          }}
        />
      ) : null}
      {selectionRect && isMultiSelection ? (
        <div
          aria-hidden="true"
          className="border-primary pointer-events-none absolute border-2 border-dashed"
          style={{
            left: (margins.left + selectionRect.x) * zoom,
            top: (margins.top + selectionRect.y) * zoom,
            width: selectionRect.width * zoom,
            height: selectionRect.height * zoom
          }}
        />
      ) : null}
      {positions && selectionCenter
        ? ROTATE_ZONE_CORNERS.map((corner) => {
            const zone = rotateZonePosition(positions[corner], selectionCenter, margins, zoom)

            return (
              <button
                key={corner}
                type="button"
                data-rotate-zone={corner}
                aria-label={t("templates.editor.rotateHandle")}
                className="pointer-events-auto absolute"
                style={{
                  left: zone.x - ROTATE_ZONE_SIZE / 2,
                  top: zone.y - ROTATE_ZONE_SIZE / 2,
                  width: ROTATE_ZONE_SIZE,
                  height: ROTATE_ZONE_SIZE,
                  cursor: ROTATE_CURSOR
                }}
              />
            )
          })
        : null}
      {positions
        ? handleDirectionsFor(handleAxes).map((direction) => {
            const position = positions[direction]

            return (
              <button
                key={direction}
                type="button"
                data-resize-handle={direction}
                aria-label={t("templates.editor.resizeHandle", { direction })}
                className="border-primary pointer-events-auto absolute rounded-[3px] border bg-white shadow-sm"
                style={{
                  left: (margins.left + position.x) * zoom - HANDLE_SIZE / 2,
                  top: (margins.top + position.y) * zoom - HANDLE_SIZE / 2,
                  width: HANDLE_SIZE,
                  height: HANDLE_SIZE,
                  cursor: cursorForHandle(direction, rotation)
                }}
              />
            )
          })
        : null}
      {overlay.rotationBadge !== null && badgeAnchor ? (
        <div
          aria-hidden="true"
          className="bg-primary text-primary-foreground absolute -translate-x-1/2 rounded-sm px-1.5 py-0.5 text-xs tabular-nums"
          style={{
            left: (margins.left + badgeAnchor.x + badgeAnchor.width / 2) * zoom,
            top: (margins.top + badgeAnchor.y) * zoom - 28
          }}
        >
          {t("templates.editor.rotationBadge", { degrees: overlay.rotationBadge })}
        </div>
      ) : null}
    </div>
  )
}

export { LiveOverlay }
