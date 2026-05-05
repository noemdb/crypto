"use client";

import * as React from "react";
import { Globe } from "lucide-react";
import { useDashboardStore } from "@/lib/store/dashboard.store";
import { Button } from "@/components/ui/button";

const TIMEZONE_OPTIONS = [
  { label: "Local", value: "local" },
  { label: "UTC", value: "UTC" },
  { label: "UTC−4 (VET)", value: "America/Caracas" },
  { label: "UTC−5 (EST)", value: "America/New_York" },
  { label: "UTC−6 (CST)", value: "America/Chicago" },
  { label: "UTC−8 (PST)", value: "America/Los_Angeles" },
  { label: "UTC+1 (CET)", value: "Europe/Madrid" },
];

export function TimezoneSelector() {
  const { displayTimezone, setDisplayTimezone } = useDashboardStore();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  // Cerrar al hacer click fuera
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-1.5 text-xs">
        <Globe className="h-3.5 w-3.5" />
        <span>···</span>
      </Button>
    );
  }

  const resolvedTz =
    displayTimezone === "local"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : displayTimezone;

  const activeLabel =
    TIMEZONE_OPTIONS.find((o) => o.value === displayTimezone)?.label ??
    displayTimezone;

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        title={`Zona horaria: ${resolvedTz}`}
        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        id="timezone-selector-btn"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{activeLabel}</span>
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[10rem] rounded-md border bg-popover shadow-md py-1">
          {TIMEZONE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              id={`tz-option-${opt.value.replace(/\//g, "-").replace(/[^a-z0-9-]/gi, "")}`}
              onClick={() => {
                setDisplayTimezone(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground ${
                displayTimezone === opt.value
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {opt.label}
              {opt.value === "local" && (
                <span className="ml-1 opacity-60">
                  ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
