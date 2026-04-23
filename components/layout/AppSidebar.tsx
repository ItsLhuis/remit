"use client"

import { Fragment, useState } from "react"

import { SignOutDialog } from "@/features/auth/components"

import { cn, getInitials } from "@/lib/utils"

import { resolveStorageUrl } from "@/lib/storage"

import { useHotkey } from "@tanstack/react-hotkeys"

import { useScroll } from "@/hooks/useScroll"

import { usePathname, useRouter } from "next/navigation"

import { signOut, useSession } from "@/lib/authClient"

import Image from "next/image"

import Link from "next/link"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Fade,
  Icon,
  Kbd,
  ScrollArea,
  Sidebar,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Typography,
  useSidebar
} from "@/components/ui"

const mainNavItems = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard" as const },
  { label: "Clients", href: "/clients", icon: "Users" as const },
  { label: "Projects", href: "/projects", icon: "FolderOpen" as const },
  { label: "Proposals", href: "/proposals", icon: "FileText" as const },
  { label: "Invoices", href: "/invoices", icon: "Receipt" as const }
]

const configNavItems = [
  { label: "Templates", href: "/templates", icon: "LayoutTemplate" as const },
  { label: "Settings", href: "/settings", icon: "Settings2" as const }
]

type NavUserProps = {
  name?: string | null
  email?: string | null
  image?: string | null
  initials: string
  onLogout: () => void
}

const NavUser = ({ name, email, image, initials, onLogout }: NavUserProps) => {
  const { isMobile } = useSidebar()

  const [signOutOpen, setSignOutOpen] = useState(false)

  return (
    <Fragment>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-foreground"
                tooltip={name ?? "Account"}
              >
                <Avatar>
                  <AvatarImage src={image ?? ""} alt={name ?? ""} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="text-foreground grid flex-1">
                  <Typography className="truncate">{name}</Typography>
                  <Typography className="truncate" affects={["muted", "small"]}>
                    {email}
                  </Typography>
                </div>
                <Icon name="ChevronsUpDown" className="text-foreground" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="min-w-56"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="flex items-center gap-2 px-1 py-1.5">
                    <Avatar>
                      <AvatarImage src={image ?? ""} alt={name ?? ""} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="text-foreground grid flex-1">
                      <Typography className="truncate">{name}</Typography>
                      <Typography className="truncate" affects={["muted", "small"]}>
                        {email}
                      </Typography>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" onSelect={() => setSignOutOpen(true)}>
                  <Icon name="LogOut" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} onConfirm={onLogout} />
    </Fragment>
  )
}

const AppSidebar = () => {
  const pathname = usePathname()

  const router = useRouter()

  const { data: session } = useSession()

  const { state, isMobile } = useSidebar()

  const [commandOpen, setCommandOpen] = useState(false)

  const { ref: viewportRef, canScrollUp, canScrollDown } = useScroll()

  const isCollapsed = state === "collapsed"

  const user = session?.user
  const initials = user?.name ? getInitials(user.name) : "?"

  const handleLogout = async () => {
    await signOut()
    router.refresh()
  }

  useHotkey("Mod+K", (event) => {
    event.preventDefault()
    setCommandOpen((prev) => !prev)
  })

  return (
    <Fragment>
      <Sidebar collapsible="icon">
        <SidebarHeader className="flex h-14 justify-center">
          <div className="flex h-9 items-center justify-center gap-2 px-1">
            <Fade
              show={!isCollapsed || isMobile}
              duration={0.15}
              initial={false}
              exit
              className="flex items-center gap-2 overflow-hidden"
            >
              <Image src="/logo.png" width={32} height={32} alt="Remit" />
            </Fade>
            <SidebarTrigger className="ml-auto shrink-0" />
          </div>
        </SidebarHeader>
        <div className="mt-2 px-2 pb-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => setCommandOpen(true)}
                className="text-muted-foreground hover:text-foreground w-full justify-start overflow-hidden transition-all group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&_svg]:shrink-0"
              >
                <Icon name="Search" />
                <Typography className="flex-1 text-left">Search</Typography>
                <Kbd className="hidden sm:inline-flex">⌘ K</Kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" align="center" hidden={!isCollapsed || isMobile}>
              Search
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <ScrollArea
            className="min-h-0 flex-1 group-data-[collapsible=icon]:overflow-hidden"
            data-slot="sidebar-content"
            data-sidebar="content"
            viewportRef={viewportRef}
          >
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarMenu>
                {mainNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
                      }
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon name={item.icon} />
                        {item.label}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Configuration</SidebarGroupLabel>
              <SidebarMenu>
                {configNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(item.href)}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon name={item.icon} />
                        {item.label}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </ScrollArea>
          <div
            className={cn(
              "from-sidebar pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b to-transparent transition-opacity duration-200",
              canScrollUp ? "opacity-100" : "opacity-0"
            )}
          />
          <div
            className={cn(
              "from-sidebar pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t to-transparent transition-opacity duration-200",
              canScrollDown ? "opacity-100" : "opacity-0"
            )}
          />
        </div>
        <SidebarFooter>
          <NavUser
            name={user?.name}
            email={user?.email}
            image={resolveStorageUrl(user?.image)}
            initials={initials}
            onLogout={handleLogout}
          />
        </SidebarFooter>
      </Sidebar>
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <Command>
          <CommandInput placeholder="Search" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {mainNavItems.map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => {
                    router.push(item.href)
                    setCommandOpen(false)
                  }}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Configuration">
              {configNavItems.map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => {
                    router.push(item.href)
                    setCommandOpen(false)
                  }}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </Fragment>
  )
}

export { AppSidebar }
