"use client"

import { type ChangeEvent } from "react"

import { FieldLabel, Input } from "@/components/ui"

type FieldRowColorProps = {
  id: string
  label: string
  value: string | undefined
  fallback: string
  disabled?: boolean
  onChange: (value: string | undefined) => void
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

const FieldRowColor = ({ id, label, value, fallback, disabled, onChange }: FieldRowColorProps) => {
  const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.trim()

    if (raw === "") {
      onChange(undefined)

      return
    }

    const candidate = raw.startsWith("#") ? raw : `#${raw}`

    if (HEX_PATTERN.test(candidate)) onChange(candidate.toLowerCase())
  }

  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
      <FieldLabel htmlFor={id} className="text-muted-foreground text-xs font-medium">
        {label}
      </FieldLabel>
      <div className="flex items-center gap-2">
        {/* Native color input: keyboard-operable swatch with the platform picker for free. */}
        <input
          type="color"
          aria-label={label}
          value={value ?? fallback}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="border-input focus-visible:ring-ring/50 size-8 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5 focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <Input
          id={id}
          defaultValue={value ?? ""}
          key={value ?? "empty"}
          placeholder={fallback}
          disabled={disabled}
          className="font-mono text-xs uppercase"
          onBlur={handleTextChange}
        />
      </div>
    </div>
  )
}

export { FieldRowColor }
