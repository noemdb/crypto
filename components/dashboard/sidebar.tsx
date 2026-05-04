import Link from "next/link";
import { BarChart3, Settings, Activity, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Monitor", icon: Activity },
  { href: "/dashboard/opportunities", label: "Historial", icon: BarChart3 },
  { href: "/dashboard/config", label: "Configuración", icon: Settings },
];

export function DashboardSidebar() {
  return (
    <aside className="w-56 shrink-0 border-r bg-card flex flex-col">
      <div className="flex items-center gap-2 px-4 py-5 border-b">
        <Shield className="w-5 h-5 text-brand-primary" />
        <span className="font-semibold text-sm tracking-tight">AIM</span>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              "transition-colors",
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t">
        <p className="text-xs text-muted-foreground px-3">
          Arbitrage Intelligence Monitor
        </p>
      </div>
    </aside>
  );
}
