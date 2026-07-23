"use client"

import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type RefObject
} from "react"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { Icon, Typography } from "@/components/ui"

import { type CanvasBlockHandlers, type EditorInteraction } from "../../hooks"
import { BLOCK_ICON_NAMES, BLOCK_LABEL_KEYS } from "../../labels"
import { type Block, type TemplateType } from "../../schemas"
import {
  contentMinHeight,
  renderBlockContent,
  unwrapSanitizedHtml,
  type Point,
  type SanitizedHtml,
  type TemplateRenderData
} from "../../services"

import { CanvasBlockHotkeys } from "./CanvasBlockHotkeys"
import { CanvasTextEditor } from "./CanvasTextEditor"

// The hidden keyboard-instructions node in EditorCanvas that every block surface describes
// itself with.
export const CANVAS_INSTRUCTIONS_ID = "template-canvas-instructions"

type CanvasBlockProps = CanvasBlockHandlers & {
  block: Block
  margins: { top: number; left: number }
  type: TemplateType
  renderData: TemplateRenderData
  assets: Record<string, string>
  disabled?: boolean
  interaction: EditorInteraction
  onRegisterNode: (id: string, element: HTMLElement | null) => void
}

// A frame's own content renders without its recursive child markup (includeChildren: false) — the
// children below render as real interactive CanvasBlock nodes instead, so a nested block is never
// both baked into its parent's HTML and mounted as its own component.
const FRAME_CONTENT_OPTIONS = { includeChildren: false }

// Frame children are positioned relative to the frame's own content box (blockIndex.ts), not the
// page, so a nested CanvasBlock always renders at the page margins' zero point.
const NESTED_MARGINS = { top: 0, left: 0 }

type CanvasBlockContentProps = {
  block: Block
  type: TemplateType
  html: SanitizedHtml
  isEditingText: boolean
  caretPoint: Point | null
  onCommitText: (html: string) => void
  onExitText: () => void
  contentRef: RefObject<HTMLDivElement | null>
}

// The block's main surface: the inline text editor while editing, otherwise its rendered HTML, or
// a placeholder for empty content. Split out of CanvasBlock so that surface's own branching stays
// off the memoized block wrapper's render.
const CanvasBlockContent = ({
  block,
  type,
  html,
  isEditingText,
  caretPoint,
  onCommitText,
  onExitText,
  contentRef
}: CanvasBlockContentProps) => {
  const { t } = useTranslation()

  if (isEditingText && block.type === "text") {
    return (
      <CanvasTextEditor
        block={block}
        type={type}
        caretPoint={caretPoint}
        onCommit={onCommitText}
        onExit={onExitText}
      />
    )
  }

  if (!html) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none flex h-full w-full items-center justify-center gap-1.5 border border-dashed border-neutral-300 text-neutral-500"
      >
        <Icon name={BLOCK_ICON_NAMES[block.type]} aria-hidden="true" className="size-3.5" />
        <Typography affects="small">{t(BLOCK_LABEL_KEYS[block.type])}</Typography>
      </div>
    )
  }

  return (
    // The unwrap is the trust boundary made visible: `html` is typed SanitizedHtml, which only
    // sanitizeTemplateHtml can produce, so the compiler — not a comment — guarantees the sanitizer
    // ran before anything reaches this sink.
    <div
      ref={contentRef}
      aria-hidden="true"
      className="pointer-events-none h-full w-full"
      dangerouslySetInnerHTML={{ __html: unwrapSanitizedHtml(html) }}
    />
  )
}

type CanvasBlockChildrenProps = CanvasBlockHandlers & {
  block: Block
  type: TemplateType
  renderData: TemplateRenderData
  assets: Record<string, string>
  disabled?: boolean
  interaction: EditorInteraction
  onRegisterNode: (id: string, element: HTMLElement | null) => void
}

// A frame or group's children, rendered as real interactive CanvasBlock nodes absolutely positioned
// over the parent's surface. Split out of CanvasBlock so its container-vs-leaf branching stays off
// the memoized block wrapper's render.
const CanvasBlockChildren = ({ block, ...rest }: CanvasBlockChildrenProps) => {
  if (block.type !== "frame" && block.type !== "group") return null
  if (block.content.children.length === 0) return null

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0",
        block.type === "frame" && block.content.clip && "overflow-hidden"
      )}
    >
      {block.content.children.map((child) => (
        <CanvasBlock key={child.id} block={child} margins={NESTED_MARGINS} {...rest} />
      ))}
    </div>
  )
}

// Memoized so nothing here re-renders during a pointer gesture: the engine moves the block by
// writing an inline transform to the wrapper registered in the interaction store's node map, and
// every prop (including the referentially stable handlers from useCanvasBlockHandlers) is
// untouched until the commit. Locked and hidden blocks render no interactive surface — they are
// excluded from canvas pointer selection and stay reachable from the Layers panel.
const CanvasBlock = memo(function CanvasBlock({
  block,
  margins,
  type,
  renderData,
  assets,
  disabled,
  interaction,
  onRegisterNode,
  onSyncMinHeight,
  onSelect,
  onSetTextContent,
  onNudge,
  onMoveBy,
  onResizeBy,
  onRemove,
  onDescend,
  onAscend
}: CanvasBlockProps) {
  const { t } = useTranslation()

  const isSelected = interaction.selection.has(block.id)
  const isEditingText = block.type === "text" && interaction.editingTextId === block.id

  const surfaceRef = useRef<HTMLButtonElement>(null)
  const wasEditingTextRef = useRef(false)

  const registerRef = useCallback(
    (element: HTMLElement | null) => onRegisterNode(block.id, element),
    [onRegisterNode, block.id]
  )

  // The renderer reads only content, style, and type; keying on those keeps a block's HTML stable
  // across selection and gesture renders, which never touch content. The compiler cannot prove the
  // subset is sufficient, so this deliberate memo opts out of its dependency check.
  /* eslint-disable react-hooks/exhaustive-deps -- deliberate subset key (see comment above) */
  const html = useMemo(
    () =>
      renderBlockContent(
        block,
        { renderData, type, assets },
        block.type === "frame" || block.type === "group" ? FRAME_CONTENT_OPTIONS : undefined
      ),
    [
      block.content,
      block.type === "group" ? undefined : block.style,
      block.type,
      renderData,
      type,
      assets
    ]
  )
  /* eslint-enable react-hooks/exhaustive-deps */

  const childHandlers: CanvasBlockHandlers = {
    onSyncMinHeight,
    onSelect,
    onSetTextContent,
    onNudge,
    onMoveBy,
    onResizeBy,
    onRemove,
    onDescend,
    onAscend
  }

  // Committed rotation renders as the wrapper's transform (a group never carries one); the engine
  // replaces it per frame during a gesture and restores it from the block index when clearing.
  const rotation = block.type === "group" ? 0 : (block.rotation ?? 0)

  const boxStyle: CSSProperties = {
    left: margins.left + block.layout.x,
    top: margins.top + block.layout.y,
    width: block.layout.width,
    height: block.layout.height,
    ...(rotation !== 0 ? { transform: `rotate(${rotation}deg)` } : {})
  }

  const contentRef = useRef<HTMLDivElement>(null)

  const interactive = !block.locked && !block.hidden

  // Text is freely resizable on both axes, but its stored height is floored at the content it must
  // contain so it never clips. Measure the content at the current width: when the box is shorter
  // than the content, `scrollHeight` reports the overflowing content height (the floor) and the
  // height is raised to it; when the box is already tall enough, `scrollHeight` equals the box
  // height and the user's height is left untouched. The hook shrinks nothing.
  useLayoutEffect(() => {
    if (block.type !== "text") return

    const element = contentRef.current

    if (!element) return

    const floor = contentMinHeight(element.scrollHeight)

    if (block.layout.height < floor) onSyncMinHeight(block.id, floor)
  }, [block, html, onSyncMinHeight])

  // Focus returns to the block's own selection surface the render after inline editing ends
  // (blur/Escape/outside pointerdown all funnel through the same editingTextId transition) - the
  // button has already remounted by the time this layout effect runs, so the ref is populated.
  useLayoutEffect(() => {
    if (wasEditingTextRef.current && !isEditingText) surfaceRef.current?.focus()

    wasEditingTextRef.current = isEditingText
  }, [isEditingText])

  // The pointer engine owns pointer selection at pointerdown; this click handler exists for
  // keyboard activation only (Enter/Space synthesize a click with detail 0), so a pointer
  // shift-toggle is never overridden by the trailing click.
  const handleSurfaceClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) onSelect(block.id)
  }

  return (
    <div
      ref={registerRef}
      style={boxStyle}
      className={cn(
        "group/canvas-block absolute",
        block.hidden && "pointer-events-none opacity-40"
      )}
    >
      <CanvasBlockContent
        block={block}
        type={type}
        html={html}
        isEditingText={isEditingText}
        caretPoint={interaction.editingTextCaretPoint}
        onCommitText={(nextHtml) => onSetTextContent(block.id, nextHtml)}
        onExitText={interaction.endTextEdit}
        contentRef={contentRef}
      />
      {interactive && !isEditingText ? (
        /* Raw button: a transparent full-cover selection/keyboard surface has no Button
           primitive equivalent; the focus-visible ring keeps the system's focus contract. */
        <button
          ref={surfaceRef}
          type="button"
          aria-label={t("templates.editor.selectBlock", {
            name: t(BLOCK_LABEL_KEYS[block.type])
          })}
          aria-pressed={isSelected}
          aria-describedby={CANVAS_INSTRUCTIONS_ID}
          disabled={disabled}
          className={cn(
            // A nested child renders inside CanvasBlockChildren's pointer-events-none wrapper (so
            // clicks on the container's own blank area pass through to the parent beneath); pointer
            // events are inherited, so the child's own surface must opt back in explicitly or a
            // nested block's surface would be unclickable under its parent's full-cover button.
            "focus-visible:ring-ring/50 pointer-events-auto absolute inset-0 cursor-grab touch-none rounded-none focus-visible:ring-[3px] focus-visible:outline-none active:cursor-grabbing",
            isSelected ? "ring-primary ring-1" : "hover:ring-primary/50 hover:ring-1"
          )}
          onClick={handleSurfaceClick}
        />
      ) : isSelected ? (
        <span
          aria-hidden="true"
          className="ring-primary pointer-events-none absolute inset-0 ring-1"
        />
      ) : null}
      <CanvasBlockChildren
        block={block}
        type={type}
        renderData={renderData}
        assets={assets}
        disabled={disabled}
        interaction={interaction}
        onRegisterNode={onRegisterNode}
        {...childHandlers}
      />
      {block.locked ? (
        <span className="bg-background/80 text-muted-foreground pointer-events-none absolute top-1 right-1 rounded-sm p-0.5">
          <Icon name="Lock" aria-hidden="true" className="size-3" />
        </span>
      ) : null}
      {interactive && !disabled ? (
        <CanvasBlockHotkeys
          block={block}
          target={surfaceRef}
          interaction={interaction}
          onNudge={onNudge}
          onMoveBy={onMoveBy}
          onResizeBy={onResizeBy}
          onRemove={onRemove}
          onDescend={onDescend}
          onAscend={onAscend}
        />
      ) : null}
    </div>
  )
})

export { CanvasBlock }
