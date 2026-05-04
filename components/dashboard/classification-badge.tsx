import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Classification } from "@/lib/schemas";

const STYLES: Record<Classification, string> = {
  EXECUTABLE: "bg-success/15 text-success border-success/30",
  MARGINAL: "bg-warning/15 text-warning border-warning/30",
  INVALID: "bg-muted text-muted-foreground border-muted",
};

const LABELS: Record<Classification, string> = {
  EXECUTABLE: "✓ Ejecutable",
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
      className={cn("text-xs font-medium", STYLES[classification])}
    >
      {LABELS[classification]}
    </Badge>
  );
}
