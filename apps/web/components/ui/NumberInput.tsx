"use client"

import { type ComponentProps } from "react"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"

type NumberInputProps = ComponentProps<"input"> & {
  step?: number
}

// Defaults to the native number input; a caller that needs to accept non-numeric interim text (an
// arithmetic expression mid-type) can pass type="text" and still gets the same stepper buttons and
// clamping math below, which read the current value with Number(...) rather than relying on the
// input's own type-driven parsing.
const NumberInput = ({
  className,
  type = "number",
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  ...props
}: NumberInputProps) => {
  const numericValue = value !== undefined && value !== "" ? Number(value) : undefined
  const numericMin = min !== undefined && min !== "" ? Number(min) : undefined
  const numericMax = max !== undefined && max !== "" ? Number(max) : undefined

  const canDecrement =
    !disabled &&
    (numericValue === undefined || numericMin === undefined || numericValue - step >= numericMin)

  const canIncrement =
    !disabled &&
    (numericValue === undefined || numericMax === undefined || numericValue + step <= numericMax)

  const adjust = (delta: number) => {
    if (!onChange) return

    const base = numericValue ?? numericMin ?? 0
    let next = base + delta

    if (numericMin !== undefined && next < numericMin) next = numericMin
    if (numericMax !== undefined && next > numericMax) next = numericMax

    const event = {
      target: { value: String(next) }
    } as React.ChangeEvent<HTMLInputElement>

    onChange(event)
  }

  return (
    <div data-slot="number-input" className={cn("relative flex items-center", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={!canDecrement}
        onClick={() => adjust(-step)}
        aria-label="Decrease"
        tabIndex={-1}
        className="text-muted-foreground absolute left-0.5 z-10"
      >
        <Icon name="Minus" aria-hidden="true" />
      </Button>
      <Input
        {...props}
        type={type}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        disabled={disabled}
        className="[appearance:textfield] px-8 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={!canIncrement}
        onClick={() => adjust(step)}
        aria-label="Increase"
        tabIndex={-1}
        className="text-muted-foreground absolute right-0.5 z-10"
      >
        <Icon name="Plus" aria-hidden="true" />
      </Button>
    </div>
  )
}

export { NumberInput }
