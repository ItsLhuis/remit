"use client"

import { type ComponentProps } from "react"

import { cn } from "@/lib/utils"

import { Accordion as AccordionPrimitive } from "radix-ui"

import { Icon } from "@/components/ui/Icon"

const Accordion = ({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Root>) => (
  <AccordionPrimitive.Root
    data-slot="accordion"
    className={cn("flex w-full flex-col", className)}
    {...props}
  />
)

const AccordionItem = ({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Item>) => (
  <AccordionPrimitive.Item
    data-slot="accordion-item"
    className={cn("not-last:border-b", className)}
    {...props}
  />
)

const AccordionTrigger = ({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      data-slot="accordion-trigger"
      className={cn(
        "group/accordion-trigger focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:after:border-ring **:data-[slot=accordion-trigger-icon]:text-muted-foreground relative flex flex-1 cursor-pointer items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-3 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <Icon
        name="ChevronDown"
        data-slot="accordion-trigger-icon"
        className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
      />
      <Icon
        name="ChevronUp"
        data-slot="accordion-trigger-icon"
        className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
)

const AccordionContent = ({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) => (
  <AccordionPrimitive.Content
    data-slot="accordion-content"
    className="data-open:animate-accordion-down data-closed:animate-accordion-up overflow-hidden text-sm"
    {...props}
  >
    <div
      className={cn(
        "[&_a]:hover:text-foreground h-(--radix-accordion-content-height) pt-0 pb-2.5 [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4",
        className
      )}
    >
      {children}
    </div>
  </AccordionPrimitive.Content>
)

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
