import { ThemeProvider } from "@/components/theme-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <DashboardHeader />
          <main className="flex-1 overflow-auto p-4 pt-0">
            {children}
          </main>
          <footer className="border-t px-4 py-2 text-center text-[10px] text-muted-foreground">
            Made by BelgaLabs &mdash; Petrica Dulgheru
          </footer>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </ThemeProvider>
  );
}
