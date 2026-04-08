"use client"

import { type ComponentProps, useContext } from "react"

import { cn } from "@/lib/utils"

import { OTPInput, OTPInputContext } from "input-otp"

import { Icon } from "@/components/ui/Icon"

const InputOTP = ({
  className,
  containerClassName,
  ...props
}: ComponentProps<typeof OTPInput> & {
  containerClassName?: string
}) => {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "cn-input-otp flex items-center has-disabled:opacity-50",
        containerClassName
      )}
      spellCheck={false}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

const InputOTPGroup = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      data-slot="input-otp-group"
      className={cn(
        "has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 flex items-center rounded-lg has-aria-invalid:ring-3",
        className
      )}
      {...props}
    />
  )
}

const InputOTPSlot = ({
  index,
  className,
  ...props
}: ComponentProps<"div"> & {
  index: number
}) => {
  const inputOTPContext = useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "border-input aria-invalid:border-destructive dark:bg-input/30 relative flex size-8 items-center justify-center border-y border-r text-sm transition-all outline-none first:rounded-l-lg first:border-l last:rounded-r-lg",
        isActive &&
          "border-ring ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 z-10 ring-3",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px" />
        </div>
      )}
    </div>
  )
}

const InputOTPSeparator = ({ ...props }: ComponentProps<"div">) => {
  return (
    <div
      data-slot="input-otp-separator"
      className="flex items-center [&_svg:not([class*='size-'])]:size-4"
      role="separator"
      {...props}
    >
      <Icon name="Minus" />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot }
