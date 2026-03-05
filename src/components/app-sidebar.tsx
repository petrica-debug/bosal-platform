"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ShoppingCart,
  Package,
  Warehouse,
  Radar,
  ShieldCheck,
  FileCheck,
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  PieChart,
  Plug,
  Settings,
  FlaskConical,
  ChevronsUpDown,
  LogOut,
  Flame,
  Thermometer,
  Atom,
  Droplets,
  Database,
  Layers,
  Activity,
  FileText,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

import { useUser } from "@/hooks/use-user";
import { signOut } from "@/app/(auth)/actions";
import {
  NAV_ITEMS,
  NAV_GROUPS,
  ROLE_LABELS,
  AI_MODE_LABELS,
  AI_MODE_COLORS,
  type Phase,
  type UserRole,
  type AIMode,
} from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useState } from "react";

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  ShoppingCart,
  Package,
  Warehouse,
  Radar,
  ShieldCheck,
  FileCheck,
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  PieChart,
  Plug,
  Settings,
  FlaskConical,
  Flame,
  Thermometer,
  Atom,
  Droplets,
  Database,
  Layers,
  Activity,
  FileText,
  MessageSquare,
};

const PHASE_VARIANT: Record<Phase, "default" | "secondary" | "outline"> = {
  P0: "default",
  P1: "secondary",
  P2: "outline",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { profile, organization, role } = useUser();
  const [aiMode, setAiMode] = useState<AIMode>("online");

  const displayName = profile?.full_name ?? "User";
  const orgName = organization?.name ?? "BOSAL";
  const roleLabel = role ? ROLE_LABELS[role as UserRole] : "Member";

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/command-center">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#C8102E] text-white shadow-sm">
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
                    <path d="M8.5 2h7" />
                    <path d="M7 16.5h10" />
                  </svg>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold">BOSAL</span>
                  <span className="truncate text-xs text-sidebar-foreground/50">
                    Chemistry Copilot
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* AI Mode Indicator */}
        <div className="mx-3 mt-1 mb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-sidebar-accent">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: AI_MODE_COLORS[aiMode] }}
                />
                <span className="text-sidebar-foreground/70">{AI_MODE_LABELS[aiMode]}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-xs">AI Assistant Mode</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setAiMode("online")}>
                <span className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                Claude (Online)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAiMode("offline")}>
                <span className="mr-2 h-2 w-2 rounded-full bg-amber-500" />
                Ollama (Offline)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAiMode("off")}>
                <span className="mr-2 h-2 w-2 rounded-full bg-gray-500" />
                Manual Only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group);
          if (items.length === 0) return null;

          return (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{group}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = ICON_MAP[item.icon];
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link href={item.href}>
                          {Icon && <Icon />}
                          <span className="flex-1 truncate">{item.title}</span>
                          {item.phase !== "P0" && (
                            <Badge
                              variant={PHASE_VARIANT[item.phase]}
                              className="ml-auto text-[10px] px-1.5 py-0"
                            >
                              {item.phase}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {/* BelgaLabs credit */}
          <div className="px-3 py-2 text-[10px] text-sidebar-foreground/30 text-center">
            Made by BelgaLabs &mdash; Petrica Dulgheru
          </div>

          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {displayName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {roleLabel}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {displayName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 size-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    void signOut();
                  }}
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
