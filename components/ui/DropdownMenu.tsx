"use client"

import { type ComponentProps } from "react"

import { cn } from "@/lib/utils"

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

import { Icon } from "@/components/ui/Icon"

const DropdownMenu = ({ ...props }: ComponentProps<typeof DropdownMenuPrimitive.Root>) => (
  <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
)

const DropdownMenuPortal = ({ ...props }: ComponentProps<typeof DropdownMenuPrimitive.Portal>) => (
  <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
)

const DropdownMenuTrigger = ({
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Trigger>) => (
  <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
)

const DropdownMenuContent = ({
  className,
  align = "start",
  sideOffset = 4,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      align={align}
      className={cn(
        "bg-popover text-popover-foreground ring-foreground/10 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 z-50 max-h-(--radix-dropdown-menu-content-available-height) w-(--radix-dropdown-menu-trigger-width) min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg p-1 shadow-md ring-1 data-[state=closed]:overflow-hidden",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
)

const DropdownMenuGroup = ({ ...props }: ComponentProps<typeof DropdownMenuPrimitive.Group>) => (
  <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
)

const DropdownMenuItem = ({
  className,
  inset,
  variant = "default",
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) => (
  <DropdownMenuPrimitive.Item
    data-slot="dropdown-menu-item"
    data-inset={inset}
    data-variant={variant}
    className={cn(
      "group/dropdown-menu-item focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:*:[svg]:text-destructive relative flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden transition-all select-none active:translate-y-px data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:pl-7 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  />
)

const DropdownMenuCheckboxItem = ({
  className,
  children,
  checked,
  inset,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & {
  inset?: boolean
}) => (
  <DropdownMenuPrimitive.CheckboxItem
    data-slot="dropdown-menu-checkbox-item"
    data-inset={inset}
    className={cn(
      "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground relative flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden transition-all select-none active:translate-y-px data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:pl-7 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    checked={checked}
    {...props}
  >
    <span
      className="pointer-events-none absolute right-2 flex items-center justify-center"
      data-slot="dropdown-menu-checkbox-item-indicator"
    >
      <DropdownMenuPrimitive.ItemIndicator>
        <Icon name="Check" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
)

const DropdownMenuRadioGroup = ({
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) => (
  <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
)

const DropdownMenuRadioItem = ({
  className,
  children,
  inset,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & {
  inset?: boolean
}) => (
  <DropdownMenuPrimitive.RadioItem
    data-slot="dropdown-menu-radio-item"
    data-inset={inset}
    className={cn(
      "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground relative flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden transition-all select-none active:translate-y-px data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:pl-7 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  >
    <span
      className="pointer-events-none absolute right-2 flex items-center justify-center"
      data-slot="dropdown-menu-radio-item-indicator"
    >
      <DropdownMenuPrimitive.ItemIndicator>
        <Icon name="Check" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
)

const DropdownMenuLabel = ({
  className,
  inset,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) => (
  <DropdownMenuPrimitive.Label
    data-slot="dropdown-menu-label"
    data-inset={inset}
    className={cn(
      "text-muted-foreground px-1.5 py-1 text-xs font-medium data-inset:pl-7",
      className
    )}
    {...props}
  />
)

const DropdownMenuSeparator = ({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) => (
  <DropdownMenuPrimitive.Separator
    data-slot="dropdown-menu-separator"
    className={cn("bg-border -mx-1 my-1 h-px", className)}
    {...props}
  />
)

const DropdownMenuShortcut = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="dropdown-menu-shortcut"
    className={cn(
      "text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground ml-auto text-xs tracking-widest",
      className
    )}
    {...props}
  />
)

const DropdownMenuSub = ({ ...props }: ComponentProps<typeof DropdownMenuPrimitive.Sub>) => (
  <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
)

const DropdownMenuSubTrigger = ({
  className,
  inset,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) => (
  <DropdownMenuPrimitive.SubTrigger
    data-slot="dropdown-menu-sub-trigger"
    data-inset={inset}
    className={cn(
      "focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden transition-all select-none active:translate-y-px data-inset:pl-7 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  >
    {children}
    <Icon name="ChevronRight" className="ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
)

const DropdownMenuSubContent = ({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubContent>) => (
  <DropdownMenuPrimitive.SubContent
    data-slot="dropdown-menu-sub-content"
    className={cn(
      "bg-popover text-popover-foreground ring-foreground/10 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 z-50 min-w-24 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg p-1 shadow-lg ring-1",
      className
    )}
    {...props}
  />
)

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
}
