"use client"

import { type ComponentProps } from "react"

import { cn } from "@/lib/utils"

import { Command as CommandPrimitive } from "cmdk"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/Dialog"
import { Icon } from "@/components/ui/Icon"
import { InputGroup, InputGroupAddon } from "@/components/ui/InputGroup"

const Command = ({ className, ...props }: ComponentProps<typeof CommandPrimitive>) => (
  <CommandPrimitive
    data-slot="command"
    className={cn(
      "bg-popover text-popover-foreground flex size-full flex-col overflow-hidden rounded-xl! p-1",
      className
    )}
    {...props}
  />
)

const CommandDialog = ({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}) => (
  <Dialog {...props}>
    <DialogHeader className="sr-only">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
    <DialogContent
      className={cn("top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0", className)}
      showCloseButton={showCloseButton}
    >
      {children}
    </DialogContent>
  </Dialog>
)

const CommandInput = ({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) => (
  <div data-slot="command-input-wrapper" className="p-1 pb-0">
    <InputGroup className="border-input/30 bg-input/30 h-8! rounded-lg! shadow-none! *:data-[slot=input-group-addon]:pl-2!">
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      <InputGroupAddon>
        <Icon name="Search" className="size-4 shrink-0 opacity-50" />
      </InputGroupAddon>
    </InputGroup>
  </div>
)

const CommandList = ({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) => (
  <CommandPrimitive.List
    data-slot="command-list"
    className={cn(
      "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
      className
    )}
    {...props}
  />
)

const CommandEmpty = ({ className, ...props }: ComponentProps<typeof CommandPrimitive.Empty>) => (
  <CommandPrimitive.Empty
    data-slot="command-empty"
    className={cn("py-6 text-center text-sm", className)}
    {...props}
  />
)

const CommandGroup = ({ className, ...props }: ComponentProps<typeof CommandPrimitive.Group>) => (
  <CommandPrimitive.Group
    data-slot="command-group"
    className={cn(
      "text-foreground **:[[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium",
      className
    )}
    {...props}
  />
)

const CommandSeparator = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>) => (
  <CommandPrimitive.Separator
    data-slot="command-separator"
    className={cn("bg-border -mx-1 h-px", className)}
    {...props}
  />
)

const CommandItem = ({
  className,
  children,
  ...props
}: ComponentProps<typeof CommandPrimitive.Item>) => (
  <CommandPrimitive.Item
    data-slot="command-item"
    className={cn(
      "group/command-item data-selected:bg-muted data-selected:text-foreground data-selected:*:[svg]:text-foreground relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden transition-all select-none active:translate-y-px in-data-[slot=dialog-content]:rounded-lg! data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  >
    {children}
    <Icon
      name="Check"
      className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100"
    />
  </CommandPrimitive.Item>
)

const CommandShortcut = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="command-shortcut"
    className={cn(
      "text-muted-foreground group-data-selected/command-item:text-foreground ml-auto text-xs tracking-widest",
      className
    )}
    {...props}
  />
)

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
}
