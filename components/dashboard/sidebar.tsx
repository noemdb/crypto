"use client";

import Link from "next/link";
import { BarChart3, Settings, Activity, Shield, ChevronLeft, ChevronRight, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/lib/store/dashboard.store";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Monitor", icon: Activity },
  { href: "/dashboard/opportunities", label: "Historial", icon: BarChart3 },
  { href: "/dashboard/analysis", label: "Análisis IA", icon: Brain },
  { href: "/dashboard/config", label: "Configuración", icon: Settings },
];

export function DashboardSidebar() {
  const { isSidebarCollapsed, toggleSidebar } = useDashboardStore();

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r bg-card transition-all duration-300 relative",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex items-center gap-3 px-6 py-6 border-b h-16">
        <Shield className="w-6 h-6 text-brand-primary shrink-0" />
        {!isSidebarCollapsed && (
          <span className="font-bold text-lg tracking-tight truncate">AIM</span>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={isSidebarCollapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
              "text-muted-foreground hover:text-foreground hover:bg-accent",
              "transition-all",
              isSidebarCollapsed && "justify-center px-0"
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t">
        {!isSidebarCollapsed ? (
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-2">
            Arbitrage Intelligence Monitor
          </p>
        ) : (
          <Activity className="w-4 h-4 text-muted-foreground mx-auto opacity-50" />
        )}
      </div>

      {/* Collapse Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="absolute -right-4 top-20 h-8 w-8 rounded-full border bg-card shadow-sm z-50 hover:bg-accent"
      >
        {isSidebarCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </aside>
  );
}
