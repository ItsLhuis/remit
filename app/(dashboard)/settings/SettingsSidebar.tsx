"use client"

import { useState } from "react"

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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
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
    items: [{ label: "Security", href: "/settings/security", icon: "ShieldCheck" }]
  }
]

const SettingsSidebar = () => {
  const pathname = usePathname()

  const [search, setSearch] = useState("")

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar className="bg-background" collapsible="panel">
      <ScrollArea className="min-h-0 flex-1" data-slot="sidebar-content" data-sidebar="content">
        <SidebarGroup>
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
        </SidebarGroup>
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
    </Sidebar>
  )
}

export { SettingsSidebar }
