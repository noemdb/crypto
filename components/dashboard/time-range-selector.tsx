"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RANGES = [
  { label: "12h", value: "12h" },
  { label: "24h", value: "24h" },
  { label: "3d", value: "3d" },
  { label: "7d", value: "7d" },
  { label: "15d", value: "15d" },
  { label: "30d", value: "30d" },
  { label: "3m", value: "3m" },
  { label: "6m", value: "6m" },
  { label: "9m", value: "9m" },
  { label: "12m", value: "12m" },
];

export function TimeRangeSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRange = searchParams.get("range") || "7d";

  const handleRangeChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-xs font-medium text-muted-foreground mr-1">Rango:</span>
      <div className="flex flex-wrap gap-1">
        {RANGES.map((range) => (
          <Button
            key={range.value}
            variant={currentRange === range.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleRangeChange(range.value)}
            className={cn(
              "h-7 px-2.5 text-[11px] font-medium",
              currentRange === range.value ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {range.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
