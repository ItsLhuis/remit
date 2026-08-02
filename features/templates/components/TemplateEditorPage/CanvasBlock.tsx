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

// includeChildren: false, because the children below mount as real CanvasBlock nodes: a nested
// block must never be both baked into its parent's HTML and mounted as its own component.
const FRAME_CONTENT_OPTIONS = { includeChildren: false }

// Frame children are positioned relative to the frame's content box, not the page, so a nested
// CanvasBlock always renders at the page margins' zero point.
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

// Split out of CanvasBlock so this branching stays off the memoized wrapper's render.
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
    // The trust boundary made visible: `html` is SanitizedHtml, which only sanitizeTemplateHtml can
    // produce, so the compiler guarantees the sanitizer ran before this sink.
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

// Split out of CanvasBlock so the container-vs-leaf branching stays off the memoized wrapper.
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

// Memoized so nothing re-renders during a pointer gesture: the engine moves the block by writing an
// inline transform to the registered wrapper node, leaving every prop untouched until the commit.
// Locked and hidden blocks render no interactive surface, staying reachable only from the Layers
// panel.
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

  // The renderer reads only content, style, and type, so keying on those keeps the HTML stable
  // across selection and gesture renders. The compiler cannot prove the subset is sufficient.
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

  // The engine replaces this transform per frame during a gesture and restores it from the block
  // index when clearing.
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

  // `scrollHeight` reports the overflowing content height when the box is too short and the box
  // height when it is not, so raising to it floors the height without ever shrinking it.
  useLayoutEffect(() => {
    if (block.type !== "text") return

    const element = contentRef.current

    if (!element) return

    const floor = contentMinHeight(element.scrollHeight)

    if (block.layout.height < floor) onSyncMinHeight(block.id, floor)
  }, [block, html, onSyncMinHeight])

  // Every exit from inline editing funnels through the same editingTextId transition, and the
  // button has already remounted by the time this layout effect runs, so the ref is populated.
  useLayoutEffect(() => {
    if (wasEditingTextRef.current && !isEditingText) surfaceRef.current?.focus()

    wasEditingTextRef.current = isEditingText
  }, [isEditingText])

  // The pointer engine already selected at pointerdown, so this handles keyboard activation only
  // (Enter/Space synthesize a click with detail 0) and never overrides a pointer shift-toggle.
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
            // CanvasBlockChildren's wrapper is pointer-events-none so clicks on the container's
            // blank area reach the parent beneath, and pointer events inherit, so a nested surface
            // must opt back in or it is unclickable under its parent's full-cover button.
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
