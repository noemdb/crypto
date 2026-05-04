"use client";

import { useDashboardStore } from "@/lib/store/dashboard.store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS = ["ALL", "EXECUTABLE", "MARGINAL", "INVALID"] as const;

export function ClassificationFilter() {
  const { activeClassification, setClassification } = useDashboardStore();

  return (
    <div className="flex gap-2 flex-wrap">
      {OPTIONS.map((opt) => (
        <Button
          key={opt}
          variant={activeClassification === opt ? "default" : "outline"}
          size="sm"
          onClick={() => setClassification(opt)}
          className={cn("text-xs", activeClassification === opt && "shadow-sm")}
        >
          {opt}
        </Button>
      ))}
    </div>
  );
}
