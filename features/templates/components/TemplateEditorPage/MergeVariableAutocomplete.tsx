"use client"

import { type RefObject } from "react"
import { createPortal } from "react-dom"

import { useTranslation } from "@/lib/i18n"

import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui"

import { MERGE_VARIABLE_LABEL_KEYS } from "../../labels"
import { type MergeVariableId } from "../../services"

type MergeVariableAutocompleteProps = {
  anchorRect: DOMRect
  variables: readonly MergeVariableId[]
  highlightedIdentifier: MergeVariableId | undefined
  onHighlightChange: (identifier: MergeVariableId) => void
  onSelect: (identifier: MergeVariableId) => void
  containerRef: RefObject<HTMLDivElement | null>
}

// Portaled to the body rather than rendered inline: the inline editing surface lives inside the
// canvas's CSS-scaled zoom wrapper, and position: fixed inside a transformed ancestor no longer
// resolves against the viewport, only against that ancestor. Keyboard navigation is driven entirely
// by the caller (CanvasTextEditor) through the controlled value/highlight props - cmdk's own
// keyboard handling never sees these keys, since focus stays in the contentEditable surface, not in
// this portaled list. data-text-edit-surface marks this as part of the inline editing surface for
// the canvas pointer engine (see isTextEditSurfaceTarget), so a click here is never mistaken for a
// canvas gesture. onMouseDown suppresses the browser's default caret-move-to-click-point action,
// which would otherwise relocate the DOM selection out of the contentEditable before onSelect can
// re-find the open token there.
const MergeVariableAutocomplete = ({
  anchorRect,
  variables,
  highlightedIdentifier,
  onHighlightChange,
  onSelect,
  containerRef
}: MergeVariableAutocompleteProps) => {
  const { t } = useTranslation()

  return createPortal(
    <div
      ref={containerRef}
      data-text-edit-surface
      style={{ position: "fixed", top: anchorRect.bottom, left: anchorRect.left }}
      className="bg-popover text-popover-foreground ring-foreground/10 z-50 w-64 rounded-lg p-1 shadow-md ring-1"
    >
      <Command
        shouldFilter={false}
        value={highlightedIdentifier}
        onValueChange={(value) => onHighlightChange(value as MergeVariableId)}
        onMouseDown={(event) => event.preventDefault()}
        aria-label={t("templates.editor.textEdit.mergeVariableSuggestionsLabel")}
      >
        <CommandList>
          <CommandEmpty>{t("templates.mergeVariables.noResults")}</CommandEmpty>
          <CommandGroup heading={t("templates.mergeVariables.title")}>
            {variables.map((identifier) => (
              <CommandItem
                key={identifier}
                value={identifier}
                onSelect={() => onSelect(identifier)}
              >
                {t(MERGE_VARIABLE_LABEL_KEYS[identifier])}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>,
    // Only ever mounts from CanvasTextEditor, which renders solely while inline editing is active -
    // client-only state that is null on the server, so this never renders during SSR.
    // react-doctor-disable-next-line no-unguarded-browser-global-in-render-or-hook-init
    document.body
  )
}

export { MergeVariableAutocomplete }
