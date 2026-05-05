"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, CircleOff, Play, Pause, RefreshCw, WifiOff } from "lucide-react";
import { toast } from "sonner";

const WORKER_BASE = process.env.NEXT_PUBLIC_SCAN_WORKER_URL ?? "http://127.0.0.1:3333";

type WorkerStatus = {
  mode: "idle" | "manual" | "online";
  running: boolean;
  intervalSeconds: number;
  lastRunAt: string | null;
  lastStatus: "success" | "failure" | null;
  lastError: string | null;
  sourceIpMode: "device-executor";
};

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return "Nunca";
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
}

export function ScannerButton() {
  const [status, setStatus] = React.useState<WorkerStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const workerUrl = `${WORKER_BASE}`;

  const isWorkerOnline = status !== null;
  const isOnlineMode = status?.mode === "online";
  const isManualBusy = isLoading && !isOnlineMode;

  const fetchStatus = React.useCallback(async () => {
    try {
      const response = await fetch(`${workerUrl}/scan/status`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Worker unavailable");
      }

      const json = (await response.json()) as WorkerStatus;
      setStatus(json);
    } catch (error) {
      setStatus(null);
    }
  }, [workerUrl]);

  React.useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const requestWorker = async (path: string, method: "POST" | "GET") => {
    const response = await fetch(`${workerUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body?.error ?? response.statusText;
      throw new Error(message);
    }

    return response.json();
  };

  const handleManualScan = async () => {
    if (isManualBusy || isOnlineMode) return;
    setIsLoading(true);
    const toastId = toast.loading("Iniciando escaneo de mercados...");

    try {
      await requestWorker("/scan/manual", "POST");
      toast.success("Escaneo completado desde el dispositivo.", { id: toastId });
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Estado del worker local</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
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
              <span>{formatTimestamp(status?.lastRunAt ?? null)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Origen:</span>
              <Badge variant="secondary">{status?.sourceIpMode ?? "device-executor"}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Intervalo activo:</span>
              <span>{status ? `${status.intervalSeconds}s` : "—"}</span>
            </div>
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
        </CardContent>
      </Card>
    </div>
  );
}
