import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Classification } from "@/lib/schemas";

const STYLES: Record<Classification, string> = {
  EXECUTABLE: "bg-success/15 text-success border-success/30",
  MARGINAL: "bg-warning/15 text-warning border-warning/30",
  INVALID: "bg-muted text-muted-foreground border-muted",
};

const LABELS: Record<Classification, string> = {
  EXECUTABLE: "Ejecutable",
  MARGINAL: "~ Marginal",
  INVALID: "✗ Inválido",
};

export function ClassificationBadge({
  classification,
}: {
  classification: Classification;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium inline-flex items-center gap-1.5",
        STYLES[classification]
      )}
    >
      {classification === "EXECUTABLE" ? (
        <>
          {/* Pulsing live-indicator dot */}
          <span className="relative flex size-1.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </span>
          {LABELS[classification]}
        </>
      ) : (
        LABELS[classification]
      )}
    </Badge>
  );
}
