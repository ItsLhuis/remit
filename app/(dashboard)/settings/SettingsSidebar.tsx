"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { useScroll } from "@/hooks/useScroll"

import { usePathname } from "next/navigation"

import Link from "next/link"

import {
  Icon,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  ScrollArea,
  Sidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@/components/ui"

type NavItem = {
  label: string
  href: string
  icon: Parameters<typeof Icon>[0]["name"]
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/settings/profile", icon: "UserRound" },
      { label: "Security", href: "/settings/security", icon: "ShieldCheck" },
      { label: "Appearance", href: "/settings/appearance", icon: "Palette" }
    ]
  },
  {
    label: "Business",
    items: [
      { label: "Business", href: "/settings/business", icon: "Building2" },
      { label: "Payment", href: "/settings/payment", icon: "Landmark" }
    ]
  },
  {
    label: "Invoicing",
    items: [
      { label: "Invoicing", href: "/settings/invoicing", icon: "FileText" },
      { label: "Tax Rates", href: "/settings/tax-rates", icon: "Percent" },
      { label: "Templates", href: "/settings/templates", icon: "LayoutTemplate" }
    ]
  },
  {
    label: "Email",
    items: [{ label: "Email", href: "/settings/email", icon: "Mail" }]
  }
]

const SettingsSidebar = () => {
  const pathname = usePathname()

  const { isMobile } = useSidebar()

  const [search, setSearch] = useState("")

  const { ref: viewportRef, canScrollUp, canScrollDown } = useScroll()

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar className="bg-background" collapsible="panel">
      <SidebarHeader>
        <InputGroup>
          <InputGroupInput
            placeholder="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <InputGroupAddon>
            <Icon name="Search" />
          </InputGroupAddon>
        </InputGroup>
      </SidebarHeader>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ScrollArea
          className="min-h-0 flex-1"
          data-slot="sidebar-content"
          data-sidebar="content"
          viewportRef={viewportRef}
        >
          {filteredGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
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
          ))}
        </ScrollArea>
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b to-transparent transition-opacity",
            isMobile ? "from-sidebar" : "from-background",
            canScrollUp ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t to-transparent transition-opacity",
            isMobile ? "from-sidebar" : "from-background",
            canScrollDown ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </Sidebar>
  )
}

export { SettingsSidebar }
