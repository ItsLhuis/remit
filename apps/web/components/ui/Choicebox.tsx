"use client"

import { type ComponentProps } from "react"

import { type VariantProps } from "class-variance-authority"

import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

import { buttonVariants } from "@/components/ui/Button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card"
import { RadioGroup } from "@/components/ui/RadioGroup"

const Choicebox = ({ className, ...props }: ComponentProps<typeof RadioGroup>) => (
  <RadioGroup className={cn("w-full", className)} data-slot="choicebox" {...props} />
)

export type ChoiceboxItemProps = ComponentProps<typeof RadioGroupPrimitive.Item> &
  VariantProps<typeof buttonVariants>

const ChoiceboxItem = ({
  className,
  variant = "outline",
  size,
  children,
  ...props
}: ChoiceboxItemProps) => (
  <RadioGroupPrimitive.Item className="text-left focus:outline-hidden" asChild {...props}>
    <Card
      data-slot="choicebox-item"
      className={cn(
        buttonVariants({ variant, size }),
        "group/choicebox-item data-checked:border-primary flex h-auto flex-row items-center justify-between gap-3 rounded-lg p-3 ring-0 transition-all",
        className
      )}
    >
      {children}
    </Card>
  </RadioGroupPrimitive.Item>
)

const ChoiceboxItemHeader = ({ className, ...props }: ComponentProps<typeof CardHeader>) => (
  <CardHeader
    data-slot="choicebox-item-header"
    className={cn("flex-1 gap-1 p-0", className)}
    {...props}
  />
)

const ChoiceboxItemTitle = ({ className, ...props }: ComponentProps<typeof CardTitle>) => (
  <CardTitle
    data-slot="choicebox-item-title"
    className={cn("flex items-center gap-2 text-sm font-medium", className)}
    {...props}
  />
)

const ChoiceboxItemSubtitle = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="choicebox-item-subtitle"
    className={cn("text-muted-foreground text-xs font-normal", className)}
    {...props}
  />
)

const ChoiceboxItemDescription = ({
  className,
  ...props
}: ComponentProps<typeof CardDescription>) => (
  <CardDescription
    data-slot="choicebox-item-description"
    className={cn("text-sm font-normal", className)}
    {...props}
  />
)

const ChoiceboxItemContent = ({ className, ...props }: ComponentProps<typeof CardContent>) => (
  <CardContent
    data-slot="choicebox-item-content"
    className={cn(
      "border-input group-data-[state=checked]/choicebox-item:border-primary group-data-[state=checked]/choicebox-item:bg-primary group-data-[state=checked]/choicebox-item:text-primary-foreground relative flex aspect-square size-4 shrink-0 items-center justify-center rounded-full border p-0 transition-all",
      className
    )}
    {...props}
  />
)

const ChoiceboxItemIndicator = ({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Indicator>) => (
  <RadioGroupPrimitive.Indicator
    data-slot="choicebox-item-indicator"
    className="flex items-center justify-center"
    {...props}
  >
    <span className={cn("bg-primary-foreground size-2 rounded-full", className)} />
  </RadioGroupPrimitive.Indicator>
)

export {
  Choicebox,
  ChoiceboxItem,
  ChoiceboxItemContent,
  ChoiceboxItemDescription,
  ChoiceboxItemHeader,
  ChoiceboxItemIndicator,
  ChoiceboxItemSubtitle,
  ChoiceboxItemTitle
}
