"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import type { Session } from "next-auth";

type Props = {
  user: Session["user"];
};

import { ThemeToggle } from "@/components/theme-toggle";

export function DashboardHeader({ user }: Props) {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6">
      <div /> {/* Spacer */}
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <span className="text-sm text-muted-foreground">{user.email}</span>
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
