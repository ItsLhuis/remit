"use client"

import { usePathname, useRouter } from "next/navigation"

import { signOut, useSession } from "@/lib/authClient"

import Image from "next/image"
import Link from "next/link"

import {
  AuroraText,
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Fade,
  Icon,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
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

type NavUserProps = {
  name?: string | null
  email?: string | null
  image?: string | null
  initials: string
  onLogout: () => void
}

const NavUser = ({ name, email, image, initials, onLogout }: NavUserProps) => {
  const { isMobile } = useSidebar()

  return (
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
              <Icon name="ChevronsUpDown" className="text-muted-foreground" />
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
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Icon name="Settings" />
                  Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onClick={onLogout}>
                <Icon name="LogOut" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

const AppSidebar = () => {
  const pathname = usePathname()

  const router = useRouter()

  const { data: session } = useSession()

  const { state, isMobile } = useSidebar()

  const isCollapsed = state === "collapsed"

  const user = session?.user
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?"

  const handleLogout = async () => {
    await signOut()
    router.refresh()
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-9 items-center justify-center gap-2 px-1">
          <Fade
            show={!isCollapsed || isMobile}
            duration={0.15}
            initial={false}
            exit
            className="flex items-center gap-2 overflow-hidden"
          >
            <Image src="/logo.png" width={32} height={32} alt="Remit" />
            <Typography variant="h5">
              <AuroraText>Remit</AuroraText>
            </Typography>
          </Fade>
          <SidebarTrigger className="ml-auto shrink-0" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {mainNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
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
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          name={user?.name}
          email={user?.email}
          image={user?.image}
          initials={initials}
          onLogout={handleLogout}
        />
      </SidebarFooter>
    </Sidebar>
  )
}

export { AppSidebar }
