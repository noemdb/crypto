"use client";

import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/lib/store/dashboard.store";
import { DashboardSidebar } from "./sidebar";
import { DashboardHeader } from "./header";
import type { Session } from "next-auth";

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: Session["user"];
}) {
  const { isSidebarCollapsed } = useDashboardStore();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <DashboardSidebar />
      <div className="flex flex-1 flex-col transition-all duration-300">
        <DashboardHeader user={user} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
