"use client"

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"

import { useTranslation } from "@/lib/i18n"

import { announce } from "../../engine"
import { BLOCK_LABEL_KEYS, MERGE_VARIABLE_LABEL_KEYS } from "../../labels"
import { TEXT_HTML_MAX_LENGTH, type Block, type TemplateType } from "../../schemas"
import {
  blockStyleToCss,
  getMergeVariables,
  sanitizeTemplateHtml,
  type MergeVariableId,
  type Point
} from "../../services"

import { MergeVariableAutocomplete } from "./MergeVariableAutocomplete"

type CaretPositionFromPoint = (x: number, y: number) => { offsetNode: Node; offset: number } | null

// Placed at the end for a keyboard entry; a double-click passes its client point instead, so the
// caret lands where the user actually clicked rather than jumping to the end of the text.
function placeCaretAtEnd(element: HTMLElement): void {
  const range = document.createRange()

  range.selectNodeContents(element)
  range.collapse(false)

  const selection = window.getSelection()

  selection?.removeAllRanges()
  selection?.addRange(range)
}

// Feature-detected: `caretPositionFromPoint` resolves a client point to a text position; happy-dom
// and browsers without it fall back to placeCaretAtEnd.
function placeCaretAtPoint(element: HTMLElement, point: Point): boolean {
  const doc = document as Document & { caretPositionFromPoint?: CaretPositionFromPoint }

  if (typeof doc.caretPositionFromPoint !== "function") return false

  const position = doc.caretPositionFromPoint(point.x, point.y)

  if (!position || !element.contains(position.offsetNode)) return false

  const range = document.createRange()

  range.setStart(position.offsetNode, position.offset)
  range.collapse(true)

  const selection = window.getSelection()

  selection?.removeAllRanges()
  selection?.addRange(range)

  return true
}

// insertFromPaste/insertReplacementText carry their text on dataTransfer rather than event.data.
// Anything with neither is unmeasurable, and the caller falls back to a current-length check.
function getIncomingInputLength(event: InputEvent): number | null {
  if (event.data) return event.data.length
  if (event.dataTransfer) return event.dataTransfer.getData("text/plain").length

  return null
}

// Mod-combos that collide with native text editing and must never reach the page's document-level
// hotkey listeners while the caret is inside this surface.
const COLLIDING_MOD_KEYS = new Set(["z", "y", "b", "i", "u", "a", "d"])

// Owned by the autocomplete popover while it is open, instead of doing their native
// contentEditable thing (caret movement, a newline, clearing the canvas selection).
const AUTOCOMPLETE_NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", "Escape"])
const AUTOCOMPLETE_DISMISS_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"])

type OpenMergeToken = { textNode: Text; start: number; end: number }

// Finds an unterminated "{{" before the caret, in the caret's own text node. Whitespace, a stray
// "{", or a "}" abandons the match: the user has moved past the token or already closed it.
function findOpenMergeToken(): OpenMergeToken | null {
  const selection = window.getSelection()

  if (!selection?.isCollapsed) return null

  const node = selection.anchorNode

  if (node?.nodeType !== Node.TEXT_NODE) return null

  const textNode = node as Text
  const offset = selection.anchorOffset
  const before = textNode.textContent?.slice(0, offset) ?? ""
  const openIndex = before.lastIndexOf("{{")

  if (openIndex === -1) return null
  if (/[\s{}]/.test(before.slice(openIndex + 2))) return null

  return { textNode, start: openIndex, end: offset }
}

function nextHighlightIndex(current: number, delta: number, length: number): number {
  return Math.min(Math.max(current + delta, 0), length - 1)
}

type TextBlock = Extract<Block, { type: "text" }>

type CanvasTextEditorProps = {
  block: TextBlock
  type: TemplateType
  caretPoint: Point | null
  onCommit: (html: string) => void
  onExit: () => void
}

type AutocompleteState = {
  query: string
  anchorRect: DOMRect
  highlighted: MergeVariableId | undefined
}

// Reuses the renderer's exact declarations (blockStyleToCss), so entering and leaving edit mode
// never jumps. Seeds from the raw stored content.html rather than the resolved-sample render, so
// merge tokens show their literal {{identifier}} form while editing.
const CanvasTextEditor = ({ block, type, caretPoint, onCommit, onExit }: CanvasTextEditorProps) => {
  const { t } = useTranslation()

  const [autocomplete, setAutocomplete] = useState<AutocompleteState | null>(null)

  const editableRef = useRef<HTMLDivElement>(null)
  const finishedRef = useRef(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const suppressBlurRef = useRef(false)

  const finish = () => {
    if (finishedRef.current) return

    finishedRef.current = true

    const html = sanitizeTemplateHtml(editableRef.current?.innerHTML ?? "", {
      profile: "authored"
    })

    onCommit(html)
    announce(t("templates.editor.textEdit.exit", { name: t(BLOCK_LABEL_KEYS.text) }))
    onExit()
  }

  // Mount-only seed: writes the authored HTML and places the caret exactly once when the surface
  // appears. Re-running on a changed block prop would clobber the edit in progress.
  /* eslint-disable react-hooks/exhaustive-deps -- deliberate mount-only seed (see comment above) */
  useLayoutEffect(() => {
    const element = editableRef.current

    if (!element) return

    element.style.cssText = blockStyleToCss(block.style)
    element.innerHTML = sanitizeTemplateHtml(block.content.html, { profile: "authored" })
    element.focus()

    if (!caretPoint || !placeCaretAtPoint(element, caretPoint)) placeCaretAtEnd(element)
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps */

  // Capture phase, so committing and exiting never races the canvas engine's own pointerdown
  // classification of the same click. The portaled popover is excluded: it sits outside this DOM
  // subtree, so suppressBlurRef tells the onBlur handler below to ignore the blur it causes.
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (editableRef.current?.contains(target)) return

      if (popoverRef.current?.contains(target)) {
        suppressBlurRef.current = true

        return
      }

      finish()
    }

    document.addEventListener("pointerdown", handlePointerDown, true)

    return () => document.removeEventListener("pointerdown", handlePointerDown, true)
  })

  // React's onBeforeInput prop is wired to legacy composition/keypress signals, never the native
  // `beforeinput` a contentEditable fires while typing, so this binds the real DOM event.
  useEffect(() => {
    const element = editableRef.current

    if (!element) return

    const handleBeforeInput = (event: InputEvent) => {
      if (event.inputType.startsWith("delete")) return

      const incomingLength = getIncomingInputLength(event)
      const currentLength = element.innerHTML.length

      if (incomingLength === null) {
        if (currentLength >= TEXT_HTML_MAX_LENGTH) event.preventDefault()

        return
      }

      if (currentLength + incomingLength > TEXT_HTML_MAX_LENGTH) event.preventDefault()
    }

    element.addEventListener("beforeinput", handleBeforeInput)

    return () => element.removeEventListener("beforeinput", handleBeforeInput)
  }, [])

  const suggestions = autocomplete
    ? getMergeVariables(type).filter((identifier) => {
        const query = autocomplete.query.toLowerCase()

        return (
          identifier.toLowerCase().includes(query) ||
          t(MERGE_VARIABLE_LABEL_KEYS[identifier]).toLowerCase().includes(query)
        )
      })
    : []

  // Tracks the identifier rather than an index, which would go stale as further typing changes the
  // list's length, falling back to the first suggestion when it is filtered out.
  const highlighted =
    autocomplete?.highlighted && suggestions.includes(autocomplete.highlighted)
      ? autocomplete.highlighted
      : suggestions[0]

  // Re-locates the open token at call time rather than trusting offsets stashed on an earlier
  // keystroke, so a mouse click and a keyboard Enter both insert at the caret's exact position.
  const insertMergeVariable = (identifier: MergeVariableId) => {
    const open = findOpenMergeToken()

    if (!open) return

    const token = `{{${identifier}}}`
    const currentLength = editableRef.current?.innerHTML.length ?? 0

    if (currentLength - (open.end - open.start) + token.length > TEXT_HTML_MAX_LENGTH) return

    const range = document.createRange()

    range.setStart(open.textNode, open.start)
    range.setEnd(open.textNode, open.end)
    range.deleteContents()

    const tokenNode = document.createTextNode(token)

    range.insertNode(tokenNode)

    const caret = document.createRange()

    caret.setStartAfter(tokenNode)
    caret.collapse(true)

    const selection = window.getSelection()

    selection?.removeAllRanges()
    selection?.addRange(caret)

    setAutocomplete(null)
    editableRef.current?.focus()
  }

  // An unterminated "{{query" before the caret opens or updates the popover; anything else closes
  // it.
  const handleInput = () => {
    const open = findOpenMergeToken()
    const selection = window.getSelection()

    if (!open || !selection || selection.rangeCount === 0) {
      setAutocomplete(null)

      return
    }

    const query = open.textNode.textContent?.slice(open.start + 2, open.end) ?? ""

    setAutocomplete((state) => ({
      query,
      anchorRect: selection.getRangeAt(0).getBoundingClientRect(),
      highlighted: state?.query === query ? state.highlighted : undefined
    }))
  }

  // Reports whether it consumed the key, so handleKeyDown below never reaches its own
  // Escape-commits-and-exits branch for a keypress the popover already handled.
  const handleAutocompleteKeyDown = (event: KeyboardEvent<HTMLDivElement>): boolean => {
    if (!autocomplete) return false

    if (AUTOCOMPLETE_DISMISS_KEYS.has(event.key)) {
      setAutocomplete(null)

      return false
    }

    if (!AUTOCOMPLETE_NAVIGATION_KEYS.has(event.key)) return false

    event.stopPropagation()
    event.preventDefault()

    if (event.key === "Escape") {
      setAutocomplete(null)

      return true
    }

    if (event.key === "Enter") {
      if (highlighted) insertMergeVariable(highlighted)

      return true
    }

    const currentIndex = highlighted ? suggestions.indexOf(highlighted) : -1
    const nextIndex = nextHighlightIndex(
      currentIndex,
      event.key === "ArrowDown" ? 1 : -1,
      suggestions.length
    )

    setAutocomplete((state) => (state ? { ...state, highlighted: suggestions[nextIndex] } : state))

    return true
  }

  // Everything outside COLLIDING_MOD_KEYS - Mod+S, Mod+P, zoom, panel toggles - is deliberately
  // left alone, so it keeps reaching the page's hotkey listeners while editing. Escape commits and
  // exits rather than falling through to the canvas's clear-selection behavior.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (handleAutocompleteKeyDown(event)) return

    if (event.key === "Escape") {
      event.stopPropagation()
      event.preventDefault()
      finish()

      return
    }

    if ((event.metaKey || event.ctrlKey) && COLLIDING_MOD_KEYS.has(event.key.toLowerCase())) {
      event.stopPropagation()
    }
  }

  // Set by the capture-phase pointerdown handler above: a popover click blurs this surface, which
  // would otherwise commit and exit before the click's own selection handler runs.
  const handleBlur = () => {
    if (suppressBlurRef.current) {
      suppressBlurRef.current = false

      return
    }

    finish()
  }

  return (
    <>
      <div
        ref={editableRef}
        contentEditable
        suppressContentEditableWarning
        tabIndex={0}
        role="textbox"
        aria-multiline="true"
        aria-label={t("templates.editor.textEdit.editingLabel")}
        className="focus-visible:ring-ring/50 h-full w-full cursor-text rounded-none outline-none focus-visible:ring-[3px]"
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onBlur={handleBlur}
      />
      {autocomplete ? (
        <MergeVariableAutocomplete
          anchorRect={autocomplete.anchorRect}
          variables={suggestions}
          highlightedIdentifier={highlighted}
          onHighlightChange={(identifier) =>
            setAutocomplete((state) => (state ? { ...state, highlighted: identifier } : state))
          }
          onSelect={insertMergeVariable}
          containerRef={popoverRef}
        />
      ) : null}
    </>
  )
}

export { CanvasTextEditor }
