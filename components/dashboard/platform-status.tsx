import { cn } from "@/lib/utils";

type PlatformStatus = {
  platform: string;
  isHealthy: boolean;
  lastSuccessAt?: Date | null;
  consecutiveErrors: number;
};

export function PlatformStatusBar({
  statuses,
}: {
  statuses: PlatformStatus[];
}) {
  if (statuses.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((s) => (
        <div
          key={s.platform}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border",
            s.isHealthy
              ? "bg-success/10 text-success border-success/20"
              : "bg-destructive/10 text-destructive border-destructive/20",
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              s.isHealthy ? "bg-success" : "bg-destructive",
            )}
          />
          {s.platform}
          {!s.isHealthy && ` (${s.consecutiveErrors} errores)`}
        </div>
      ))}
    </div>
  );
}
