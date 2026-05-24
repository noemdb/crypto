"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  CircleOff,
  Play,
  Pause,
  RefreshCw,
  WifiOff,
  Timer,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTimezone } from "@/lib/hooks/use-timezone";

const explicitWorkerBase = process.env.NEXT_PUBLIC_SCAN_WORKER_URL?.replace(/\/$/, "");
const defaultWorkerBases = [
  explicitWorkerBase,
  "/api/scan-worker",
  typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3333` : null,
  "http://127.0.0.1:3333",
  "http://localhost:3333",
].filter((url): url is string => Boolean(url));

const WORKER_BASE = defaultWorkerBases[0] ?? "";

type WorkerStatus = {
  mode: "idle" | "manual" | "online";
  running: boolean;
  intervalSeconds: number;
  lastRunAt: string | null;
  /** ISO string of when the next online scan is scheduled. Null if scanning or not online. */
  nextRunAt: string | null;
  lastStatus: "success" | "failure" | null;
  lastError: string | null;
  sourceIpMode: "device-executor";
};

function formatTimestamp(timestamp: string | null, tz: string) {
  if (!timestamp) return "Nunca";
  try {
    return new Date(timestamp).toLocaleString('es-VE', { timeZone: tz });
  } catch {
    return timestamp;
  }
}

// ─── Countdown sub-component ──────────────────────────────────────────────────

function NextScanCountdown({
  nextRunAt,
  intervalSeconds,
  scanning,
}: {
  nextRunAt: string | null;
  intervalSeconds: number;
  scanning: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (scanning || !nextRunAt) {
      setSecondsLeft(null);
      return;
    }

    function computeSecondsLeft() {
      const diff = Math.max(0, Math.round((new Date(nextRunAt!).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    }

    computeSecondsLeft();
    const id = setInterval(computeSecondsLeft, 1000);
    return () => clearInterval(id);
  }, [nextRunAt, scanning]);

  // ── If actively scanning ────────────────────────────────────────────────────
  if (scanning) {
    return (
      <div className="flex items-center gap-2 text-sm text-brand-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="font-medium">Escaneando ahora…</span>
      </div>
    );
  }

  // ── Waiting for nextRunAt from worker ───────────────────────────────────────
  if (secondsLeft === null) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Timer className="h-4 w-4" />
        <span>Esperando primer ciclo…</span>
      </div>
    );
  }

  const total = intervalSeconds;
  const elapsed = total - secondsLeft;
  const progress = Math.min(1, elapsed / total); // 0→1
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");

  // Color urgency: green → yellow → red as time approaches 0
  const urgencyClass =
    secondsLeft > 60
      ? "text-success"
      : secondsLeft > 20
        ? "text-warning"
        : "text-destructive";

  const strokeColor =
    secondsLeft > 60
      ? "oklch(60% 0.18 145)"   // --color-success
      : secondsLeft > 20
        ? "oklch(75% 0.16 75)"  // --color-warning
        : "oklch(57.7% 0.245 27.36)"; // --color-destructive

  return (
    <div className="flex items-center gap-3">
      {/* Circular progress ring */}
      <div className="relative shrink-0" style={{ width: 36, height: 36 }}>
        <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
          {/* Track */}
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-border"
          />
          {/* Progress arc */}
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.5s ease" }}
          />
        </svg>
        {/* Timer icon overlay */}
        <Timer
          className={`absolute inset-0 m-auto h-3.5 w-3.5 ${urgencyClass}`}
          style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
        />
      </div>

      {/* Time text */}
      <div className="space-y-0.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
          Próximo scan
        </p>
        <p className={`text-lg font-mono font-semibold leading-none tabular-nums ${urgencyClass}`}>
          {mm}:{ss}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ScannerButton() {
  const router = useRouter();
  const [status, setStatus] = React.useState<WorkerStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [workerUrl, setWorkerUrl] = React.useState(`${WORKER_BASE}`);
  const { tz } = useTimezone();

  const isWorkerOnline = status !== null;
  const isOnlineMode = status?.mode === "online";
  const isManualBusy = isLoading && !isOnlineMode;

  const fetchStatus = React.useCallback(async () => {
    for (const base of defaultWorkerBases) {
      try {
        const response = await fetch(`${base}/scan/status`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Worker unavailable");
        }

        const json = (await response.json()) as WorkerStatus;
        setStatus(json);
        setWorkerUrl(base);
        return;
      } catch {
        // Try the next candidate.
      }
    }

    setStatus(null);
  }, []);

  const lastRunAtRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Sincronizar dashboard cuando el worker reporta una nueva ejecución
  React.useEffect(() => {
    if (status?.lastRunAt && status.lastRunAt !== lastRunAtRef.current) {
      if (lastRunAtRef.current !== null) {
        // Solo refrescar si no es la carga inicial
        router.refresh();
      }
      lastRunAtRef.current = status.lastRunAt;
    }
  }, [status?.lastRunAt, router]);

  const requestWorker = async (path: string, method: "POST" | "GET") => {
    for (const base of defaultWorkerBases) {
      try {
        const response = await fetch(`${base}${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const message = body?.error ?? response.statusText;
          throw new Error(message);
        }

        setWorkerUrl(base);
        return response.json();
      } catch {
        // Try the next candidate.
      }
    }

    throw new Error("Worker unavailable");
  };

  const handleManualScan = async () => {
    if (isManualBusy || isOnlineMode) return;
    setIsLoading(true);
    const toastId = toast.loading("Iniciando escaneo de mercados...");

    try {
      await requestWorker("/scan/manual", "POST");
      toast.success("Escaneo completado desde el dispositivo.", { id: toastId });
      router.refresh();
      fetchStatus();
    } catch (error) {
      toast.error(`Error: ${(error as Error).message}`, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnlineToggle = async () => {
    setIsLoading(true);
    const toastId = toast.loading(isOnlineMode ? "Deteniendo Datos online..." : "Iniciando Datos online...");

    try {
      if (isOnlineMode) {
        await requestWorker("/scan/online/stop", "POST");
        toast.success("Datos online detenido.", { id: toastId });
      } else {
        await requestWorker("/scan/online/start", "POST");
        toast.success("Datos online iniciado.", { id: toastId });
      }

      await fetchStatus();
    } catch (error) {
      toast.error(`Error: ${(error as Error).message}`, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button
          onClick={handleManualScan}
          disabled={!isWorkerOnline || isLoading || isOnlineMode}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {isManualBusy ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isManualBusy ? "Ejecutando..." : "Ejecutar Escáner"}
        </Button>

        <Button
          onClick={handleOnlineToggle}
          disabled={!isWorkerOnline || isLoading}
          variant={isOnlineMode ? "destructive" : "outline"}
          size="sm"
          className="gap-2"
        >
          {isOnlineMode ? <Pause className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {isOnlineMode ? "Detener Datos online" : "Datos online"}
        </Button>
      </div>

      <Card className={isOnlineMode ? "border-success/25 bg-success/[0.02]" : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Estado del worker local
            {isOnlineMode && (
              <span className="relative flex size-2 ml-1">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Countdown banner — only when online mode is active ── */}
          {isOnlineMode && (
            <div className="flex items-center justify-between rounded-lg border border-success/20 bg-success/5 px-4 py-3">
              <NextScanCountdown
                nextRunAt={status?.nextRunAt ?? null}
                intervalSeconds={status?.intervalSeconds ?? 180}
                scanning={status?.running ?? false}
              />
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Intervalo
                </p>
                <p className="text-sm font-mono font-medium tabular-nums">
                  {status ? `${status.intervalSeconds}s` : "—"}
                </p>
              </div>
            </div>
          )}

          {/* ── Status grid ── */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Modo:</span>
                <Badge variant="secondary">{status?.mode ?? "offline"}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Worker activo:</span>
                {status ? (
                  <span className="inline-flex items-center gap-1 text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Sí
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose-500">
                    <CircleOff className="h-4 w-4" />
                    No
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Última ejecución:</span>
                <span>{formatTimestamp(status?.lastRunAt ?? null, tz)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Origen:</span>
                <Badge variant="secondary">{status?.sourceIpMode ?? "device-executor"}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              {!isOnlineMode && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Intervalo activo:</span>
                  <span>{status ? `${status.intervalSeconds}s` : "—"}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Último estado:</span>
                <Badge variant={status?.lastStatus === "failure" ? "destructive" : "secondary"}>
                  {status?.lastStatus ?? "N/A"}
                </Badge>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Último error:</span>
                <p className="mt-1 break-words text-sm text-foreground">{status?.lastError ?? "Sin errores"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
