"use client"

import { useRef, useState } from "react"

import { useTranslation } from "@/lib/i18n"

import { Field, FieldLabel, Textarea } from "@/components/ui"

import { TEXT_HTML_MAX_LENGTH, type Block, type TemplateType } from "../../../schemas"
import { sanitizeTemplateHtml } from "../../../services"

import { MergeVariablePicker } from "./MergeVariablePicker"

type TextBlock = Extract<Block, { type: "text" }>

type TextContentSectionProps = {
  block: TextBlock
  type: TemplateType
  disabled?: boolean
  onChange: (html: string) => void
}

// The text block is a merge-variable-insertable surface (table headers and cells are the others):
// the picker drops the raw token at the textarea cursor, and stored content is the only place raw
// {{token}} syntax may appear. Every edit reaches the store through the same authored-profile
// sanitize boundary the canvas's inline editor enforces at its commit. While focused the textarea
// shows a raw local draft — sanitizing the visible value per keystroke would wipe a half-typed tag
// like `<stro` out from under the user — and outside focus it shows the stored (sanitized) content.
const TextContentSection = ({ block, type, disabled, onChange }: TextContentSectionProps) => {
  const { t } = useTranslation()

  const [draft, setDraft] = useState("")
  const [isEditing, setIsEditing] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const value = isEditing ? draft : block.content.html

  const commit = (html: string) => {
    if (html.length > TEXT_HTML_MAX_LENGTH) return

    setDraft(html)
    onChange(sanitizeTemplateHtml(html, { profile: "authored" }))
  }

  const insertAtCursor = (identifier: string) => {
    const token = `{{${identifier}}}`
    const element = textareaRef.current

    const start = element?.selectionStart ?? value.length
    const end = element?.selectionEnd ?? value.length

    setIsEditing(true)
    commit(`${value.slice(0, start)}${token}${value.slice(end)}`)

    requestAnimationFrame(() => {
      if (!element) return

      element.focus()
      element.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Field>
        <FieldLabel htmlFor={`${block.id}-html`}>{t("templates.editor.richText")}</FieldLabel>
        <Textarea
          id={`${block.id}-html`}
          ref={textareaRef}
          value={value}
          disabled={disabled}
          className="min-h-28 font-mono text-xs"
          onFocus={() => {
            setDraft(block.content.html)
            setIsEditing(true)
          }}
          onBlur={() => setIsEditing(false)}
          onChange={(event) => commit(event.target.value)}
        />
      </Field>
      <MergeVariablePicker type={type} disabled={disabled} onInsert={insertAtCursor} />
    </div>
  )
}

export { TextContentSection }
