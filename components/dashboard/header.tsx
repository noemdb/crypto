"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import type { Session } from "next-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { TimezoneSelector } from "@/components/timezone-selector";

type Props = {
  user: Session["user"];
};

export function DashboardHeader({ user }: Props) {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6">
      <div /> {/* Spacer */}
      <div className="flex items-center gap-2">
        <TimezoneSelector />
        <ThemeToggle />
        <span className="text-sm text-muted-foreground ml-2">{user.email}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Salir
        </Button>
      </div>
    </header>
  );
}
