"use client"

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"

import { useTranslation } from "@/lib/i18n"

import { BLOCK_LABEL_KEYS, MERGE_VARIABLE_LABEL_KEYS } from "../../labels"
import { TEXT_HTML_MAX_LENGTH, type Block, type TemplateType } from "../../schemas"
import {
  blockStyleToCss,
  getMergeVariables,
  sanitizeTemplateHtml,
  type MergeVariableId,
  type Point
} from "../../services"

import { announce } from "./engine/announcer"
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

// insertFromPaste/insertReplacementText carry the incoming text on dataTransfer rather than
// event.data; anything else with neither is unmeasurable, and the caller falls back to the
// conservative current-length check for it.
function getIncomingInputLength(event: InputEvent): number | null {
  if (event.data) return event.data.length
  if (event.dataTransfer) return event.dataTransfer.getData("text/plain").length

  return null
}

// Mod-combos that collide with native text editing and must never reach the page's document-level
// hotkey listeners while the caret is inside this surface: undo/redo, formatting, select-all, and
// the page's duplicate hotkey.
const COLLIDING_MOD_KEYS = new Set(["z", "y", "b", "i", "u", "a", "d"])

// The keys the autocomplete popover owns while it is open, moving its own highlight or closing it
// instead of doing their native contentEditable thing (arrow caret movement, a newline, clearing the
// canvas selection).
const AUTOCOMPLETE_NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", "Escape"])
const AUTOCOMPLETE_DISMISS_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"])

type OpenMergeToken = { textNode: Text; start: number; end: number }

// Finds an unterminated "{{...}}" immediately before the caret, in the caret's own text node: start
// is the index of the first "{" of the pair, end is the caret itself. Whitespace, a stray "{", or a
// "}" inside the candidate abandons the match - the user has moved past the token or already closed
// it by hand.
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

// Replaces the block's static HTML div in place while editing: same positioned wrapper, same
// padding/typography (blockStyleToCss - the exact declarations the renderer emits), so entering and
// leaving edit mode never jumps. Seeds from the raw stored content.html (never the resolved-sample
// render), so merge tokens show their literal {{identifier}} form while editing.
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

  // Mount-only: seeds the raw authored HTML and places the caret exactly once when the surface
  // appears. Re-running on every render would clobber in-progress edits with the stale block prop.
  /* eslint-disable react-hooks/exhaustive-deps -- deliberate mount-only seed (see comment above) */
  // Mount-only seed: the inline editor writes the authored HTML and places the caret exactly once
  // when the surface appears. Re-running on a changed block prop would clobber the edit in progress.
  useLayoutEffect(() => {
    const element = editableRef.current

    if (!element) return

    element.style.cssText = blockStyleToCss(block.style)
    element.innerHTML = sanitizeTemplateHtml(block.content.html, { profile: "authored" })
    element.focus()

    if (!caretPoint || !placeCaretAtPoint(element, caretPoint)) placeCaretAtEnd(element)
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps */

  // Capture phase: runs before the click's default focus/selection handling, so committing and
  // exiting here never races the canvas engine's own pointerdown classification of the same click.
  // A click inside the portaled autocomplete popover is excluded - it is not part of this surface's
  // DOM subtree, so the browser blurs the contentEditable for it exactly as it would for any other
  // outside click; suppressBlurRef tells the onBlur handler below to ignore that one (pointerdown
  // always fires before the resulting blur), so selecting a suggestion never commits and exits the
  // block before its own click handler runs.
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

  // React's onBeforeInput prop is wired to legacy composition/keypress/textInput/paste signals,
  // never the native `beforeinput` event a contentEditable actually fires while typing, so the
  // guard binds to the real DOM event directly instead of the synthetic prop.
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

  // Falls back to the first suggestion whenever the previously highlighted identifier is unset or
  // has been filtered out by further typing, instead of tracking an index that would go stale as
  // the list's length changes on every keystroke.
  const highlighted =
    autocomplete?.highlighted && suggestions.includes(autocomplete.highlighted)
      ? autocomplete.highlighted
      : suggestions[0]

  // Replaces the open "{{query" span with the completed token and re-collapses the caret right
  // after it, so typing can continue immediately. Re-locates the open token at call time (rather
  // than trusting stashed offsets from an earlier keystroke) so a mouse click and a keyboard Enter
  // both insert against the caret's current, exact position.
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

  // Runs after every native input: an unterminated "{{query" right before the caret opens (or
  // updates) the popover, positioned from the current selection range's bounding rect; anything
  // else closes it.
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

  // Consumes ArrowDown/ArrowUp/Enter/Escape while the popover is open (moving its highlight,
  // inserting the highlighted token, or closing it) and reports whether it did, so handleKeyDown
  // below never reaches its own Escape-commits-and-exits branch for the same keypress.
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

  // Only Mod-combos that would otherwise collide with native text editing are stopped here:
  // undo/redo (native text undo must win over the page's Mod+Z/Mod+Shift+Z/Mod+Y), formatting
  // (Mod+B/I/U), select-all (Mod+A must select the surface's own text), and Mod+D (the page's
  // duplicate hotkey must not fire while the caret is inside the text). Everything else - Mod+S,
  // Mod+P, zoom, panel toggles - is left alone so it keeps reaching the page's document-level
  // hotkey listeners while editing. Escape additionally commits and exits rather than falling
  // through to the canvas's clear-selection behavior.
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

  // A click inside the popover blurs this surface (it lives outside this DOM subtree), which would
  // otherwise commit and exit the block before the click's own selection handler ever runs; the
  // capture-phase pointerdown handler above sets the flag this reads and clears.
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
