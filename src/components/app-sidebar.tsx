import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Users,
  Wallet,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import { useAuth } from "../contexts/AuthContext"

export function AppSidebar({
  onLogout,
  onChangePassword,
  onLogoClick,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  onLogout?: () => void
  onChangePassword?: () => void
  onLogoClick?: () => void
}) {
  const { user } = useAuth()

  const navGroups = [
    {
      title: "Main",
      items: [
        { title: "Dashboard", url: "/", icon: LayoutDashboard },
        { title: "Attendance", url: "/", icon: CalendarDays },
        { title: "Leave", url: "/", icon: CalendarDays },
        { title: "Payroll", url: "/", icon: Wallet },
        { title: "Reports", url: "/", icon: BarChart3 },
      ],
    },
    {
      title: "Administration",
      items: [{ title: "User Management", url: "/admin", icon: Users }],
    },
  ]

  if (user?.role !== "admin") {
    navGroups[1].items = []
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5 group-data-[collapsible=icon]/sidebar-wrapper:!size-auto group-data-[collapsible=icon]/sidebar-wrapper:!p-0.5"
            >
              <Link href="/" onClick={() => onLogoClick?.()}>
                <Image
                  src="/logo-only.svg"
                  alt="Mindsfire"
                  width={20}
                  height={20}
                  className="object-contain !h-7 !w-7 group-data-[collapsible=icon]/sidebar-wrapper:!h-7 group-data-[collapsible=icon]/sidebar-wrapper:!w-7"
                  priority
                />
                <span className="flex flex-col leading-none group-data-[collapsible=icon]/sidebar-wrapper:hidden">
                  <span className="text-xl font-semibold">mindsfire</span>
                  <span className="-mt-1 text-[8px] font-normal text-muted-foreground">
                    Employees
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={navGroups.filter((group) => group.items.length > 0)} />
      </SidebarContent>
      <SidebarFooter>
        {user && (
          <NavUser
            user={{ name: user.name, email: user.email }}
            onLogout={onLogout}
            onChangePassword={onChangePassword}
          />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
