"use client"

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent
} from "react"

import { FieldLabel, NumberInput } from "@/components/ui"

import { evaluateFieldExpression } from "../../../services"

type FieldRowNumberProps = {
  id: string
  label: string
  value: number | null
  min?: number
  max?: number
  step?: number
  placeholder?: string
  disabled?: boolean
  onChange: (value: number | null) => void
}

function formatFieldValue(value: number | null): string {
  return value === null ? "" : String(value)
}

function clampFieldValue(value: number, min?: number, max?: number): number {
  if (min !== undefined && value < min) return min
  if (max !== undefined && value > max) return max

  return value
}

// Enter commits by blurring the field, so the commit path is the same one the blur handler runs.
function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
  if (event.key === "Enter") event.currentTarget.blur()
}

// A plain unsigned numeral's formatted echo always equals what was typed, so committing it on every
// keystroke never disrupts typing. An expression - anything starting with "+"/"-" or containing an
// operator - evaluates to a different string than what was typed ("+10" -> "110"), so committing
// that mid-type would snap the field to the evaluated number and corrupt further typing; it is
// deferred to blur/Enter (commit-time) instead, with a local draft mirroring the raw text in
// between so the field keeps showing exactly what the user typed.
const PLAIN_NUMERAL = /^\d+(\.\d+)?$/
const FieldRowNumber = ({
  id,
  label,
  value,
  min,
  max,
  step,
  placeholder,
  disabled,
  onChange
}: FieldRowNumberProps) => {
  const [draft, setDraft] = useState(() => formatFieldValue(value))
  // The raw text already committed for the current `value`, so a blur/Enter that fires after a
  // keystroke already committed the same text (the common case for a plain numeral, which commits
  // per keystroke) does not re-commit an identical value as a second, redundant onChange call.
  const lastCommittedRawRef = useRef<string | null>(null)

  useEffect(() => {
    setDraft(formatFieldValue(value))
  }, [value])

  const commit = (raw: string): boolean => {
    if (raw.trim() === "") {
      lastCommittedRawRef.current = raw
      onChange(null)

      return true
    }

    const evaluated = evaluateFieldExpression(raw, value)

    if (evaluated === null) return false

    lastCommittedRawRef.current = raw
    onChange(clampFieldValue(evaluated, min, max))

    return true
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value

    setDraft(raw)

    // NumberInput's stepper buttons call this handler with a plain constructed object (no
    // `nativeEvent`) carrying an already-computed, always-complete numeric string, so a stepper
    // click always commits immediately, same as a plain numeral keystroke.
    if (!event.nativeEvent || PLAIN_NUMERAL.test(raw.trim())) commit(raw)
  }

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (event.target.value === lastCommittedRawRef.current) return
    if (!commit(event.target.value)) setDraft(formatFieldValue(value))
  }

  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
      <FieldLabel htmlFor={id} className="text-muted-foreground text-xs font-medium">
        {label}
      </FieldLabel>
      <NumberInput
        id={id}
        type="text"
        inputMode="decimal"
        value={draft}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

export { FieldRowNumber }
