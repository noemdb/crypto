"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import type { Session } from "next-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { TimezoneSelector } from "@/components/timezone-selector";
import { Menu, X, Shield, Activity, BarChart3, Settings, LogOut, Brain, LineChart, Radar } from "lucide-react";
import { useDashboardStore } from "@/lib/store/dashboard.store";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  user: Session["user"];
};

const NAV_ITEMS = [
  { href: "/dashboard",               label: "Arbitraje",     icon: Activity },
  { href: "/dashboard/monitor",       label: "Monitor P2P",   icon: LineChart },
  { href: "/dashboard/inteligencia",  label: "Inteligencia",  icon: Radar },
  { href: "/dashboard/opportunities", label: "Historial",     icon: BarChart3 },
  { href: "/dashboard/analysis",      label: "Análisis IA",   icon: Brain },
  { href: "/dashboard/config",        label: "Configuración", icon: Settings },
];

export function DashboardHeader({ user }: Props) {
  const { isMobileMenuOpen, setMobileMenuOpen } = useDashboardStore();
  const pathname = usePathname();

  return (
    <>
      <header className="h-16 border-b bg-card flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          <div className="flex items-center gap-2 lg:hidden">
            <Shield className="w-5 h-5 text-brand-primary" />
            <span className="font-bold text-sm tracking-tight">AIM</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <TimezoneSelector />
            <ThemeToggle />
          </div>
          
          <div className="h-8 w-[1px] bg-border mx-2 hidden sm:block" />
          
          <span className="text-xs text-muted-foreground hidden md:block max-w-[150px] truncate">
            {user.email}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive transition-colors gap-2"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed top-16 left-0 bottom-0 w-[280px] bg-card border-r z-50 lg:hidden transition-transform duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <nav className="flex flex-col p-4 gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          
          <div className="mt-4 pt-4 border-t space-y-4">
            <div className="px-4 py-2 flex flex-col gap-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Preferencias
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm">Tema</span>
                <ThemeToggle />
              </div>
              <div className="space-y-1">
                <span className="text-sm">Zona Horaria</span>
                <TimezoneSelector />
              </div>
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
