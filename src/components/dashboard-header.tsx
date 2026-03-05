"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, Moon, Sun, MessageSquare } from "lucide-react";

import { useUser } from "@/hooks/use-user";
import { signOut } from "@/app/(auth)/actions";
import { NAV_ITEMS, ROLE_LABELS, type UserRole } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function DashboardHeader() {
  const pathname = usePathname();
  const { setTheme, theme } = useTheme();
  const { profile, role } = useUser();

  const currentNav = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const pageTitle = currentNav?.title ?? "Dashboard";

  const displayName = profile?.full_name ?? "User";
  const roleLabel = role ? ROLE_LABELS[role as UserRole] : "Member";

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <nav aria-label="Breadcrumb" className="flex items-center gap-2">
          <h1 className="text-sm font-semibold">{pageTitle}</h1>
        </nav>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* AI Chat toggle */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="AI Assistant"
          className="relative"
        >
          <MessageSquare className="size-4" />
          <span className="absolute -top-0.5 -right-0.5 flex size-2 rounded-full bg-green-500" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative size-8 rounded-full">
              <Avatar className="size-8">
                <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {displayName}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {roleLabel}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void signOut();
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
