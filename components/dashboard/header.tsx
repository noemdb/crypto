"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import type { Session } from "next-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { TimezoneSelector } from "@/components/timezone-selector";
import { 
  Menu, X, Shield, Activity, BarChart3, Settings, LogOut, Brain, LineChart, Radar,
  Server, CheckCircle2, AlertTriangle, Clock, Loader2, Play, Pause 
} from "lucide-react";
import { useDashboardStore } from "@/lib/store/dashboard.store";
import { useTimezone } from "@/lib/hooks/use-timezone";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

const explicitWorkerBase = process.env.NEXT_PUBLIC_SCAN_WORKER_URL?.replace(/\/$/, "");
const defaultWorkerBases = [
  explicitWorkerBase,
  "/api/scan-worker",
  typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3333` : null,
  "http://127.0.0.1:3333",
  "http://localhost:3333",
].filter((url): url is string => Boolean(url));

type WorkerStatus = {
  mode: "idle" | "manual" | "online";
  running: boolean;
  intervalSeconds: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: "success" | "failure" | null;
  lastError: string | null;
  sourceIpMode: "device-executor";
};

type Props = {
  user: Session["user"];
};

const NAV_ITEMS = [
  { href: "/dashboard",               label: "Arbitraje",     icon: Activity },
  { href: "/dashboard/monitor",       label: "Monitor P2P",   icon: LineChart },
  { href: "/dashboard/inteligencia",  label: "Inteligencia",  icon: Radar },
  { href: "/dashboard/opportunities", label: "Historial",     icon: BarChart3 },
  { href: "/dashboard/analysis",      label: "Análisis IA",   icon: Brain },
  { href: "/dashboard/config",        label: "Configuración", icon: Settings },
];

export function DashboardHeader({ user }: Props) {
  const { isMobileMenuOpen, setMobileMenuOpen } = useDashboardStore();
  const pathname = usePathname();

  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [, setTick] = useState(0);
  const { formatDateTime, ageMinutes } = useTimezone();

  const fetchStatus = useCallback(async () => {
    for (const base of defaultWorkerBases) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 2500);

        const response = await fetch(`${base}/scan/status`, {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(id);

        if (!response.ok) {
          throw new Error("Worker unavailable");
        }

        const json = (await response.json()) as WorkerStatus;
        setStatus(json);
        setIsConnected(true);
        return;
      } catch {
        // Ignorar y probar el siguiente endpoint candidato
      }
    }
    setStatus(null);
    setIsConnected(false);
  }, []);

  const handleOnlineToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isConnected || !status || isToggling) return;

    setIsToggling(true);
    const isOnlineMode = status.mode === "online";
    const toastId = toast.loading(isOnlineMode ? "Deteniendo Datos online..." : "Iniciando Datos online...");

    try {
      let requestSuccess = false;
      for (const base of defaultWorkerBases) {
        try {
          const path = isOnlineMode ? "/scan/online/stop" : "/scan/online/start";
          const response = await fetch(`${base}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const message = body?.error ?? response.statusText;
            throw new Error(message);
          }
          requestSuccess = true;
          break;
        } catch {
          // Probar siguiente base url
        }
      }

      if (!requestSuccess) {
        throw new Error("Worker no disponible");
      }

      toast.success(isOnlineMode ? "Datos online detenidos." : "Datos online iniciados.", { id: toastId });
      await fetchStatus();
    } catch (error) {
      toast.error(`Error: ${(error as Error).message}`, { id: toastId });
    } finally {
      setIsToggling(false);
    }
  }, [isConnected, status, isToggling, fetchStatus]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Actualizar el texto del contador "hace X min" cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <header className="h-16 border-b bg-card flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          <div className="flex items-center gap-2 lg:hidden">
            <Shield className="w-5 h-5 text-brand-primary" />
            <span className="font-bold text-sm tracking-tight">AIM</span>
          </div>
        </div>

        {/* --- Centro: Panel de Estado del Worker (Desktop) --- */}
        <div className="hidden lg:flex items-center gap-5 px-4 py-1.5 bg-muted/40 border border-border/80 rounded-full text-[11px] select-none shadow-sm">
          {/* Conexión del Worker */}
          <div className="flex items-center gap-2 border-r pr-3.5 border-border/80">
            <Server className={cn("h-3.5 w-3.5 transition-colors duration-300", isConnected ? "text-emerald-500" : "text-destructive")} />
            <span className="text-muted-foreground font-medium">Worker:</span>
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="relative flex h-2 w-2">
                {isConnected && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                )}
                <span className={cn("relative inline-flex rounded-full h-2 w-2 transition-colors duration-300", isConnected ? "bg-emerald-500" : "bg-destructive")} />
              </span>
              <span className={cn("transition-colors duration-300", isConnected ? "text-emerald-500" : "text-destructive")}>
                {isConnected ? "En línea" : "Desconectado"}
              </span>
            </span>
          </div>

          {/* Loop de Datos Online (Escaneo Continuo) */}
          <div className="flex items-center gap-2 border-r pr-3.5 border-border/80">
            <Activity className={cn(
              "h-3.5 w-3.5 transition-all duration-300", 
              isConnected && status?.mode === "online" ? "text-emerald-500 animate-pulse" : "text-muted-foreground"
            )} />
            <span className="text-muted-foreground font-medium">Datos Online:</span>
            {isConnected && status ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 font-semibold">
                  {status.running ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                      <span className="text-emerald-500 animate-pulse">Escaneando...</span>
                    </>
                  ) : status.mode === "online" ? (
                    <>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                      </span>
                      <span className="text-emerald-500">Activo</span>
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span className="text-amber-500">Inactivo</span>
                    </>
                  )}
                </span>
                
                {/* Botón rápido para alternar Datos Online */}
                <button
                  onClick={handleOnlineToggle}
                  disabled={isToggling}
                  className={cn(
                    "p-0.5 rounded transition-all duration-200 border flex items-center justify-center cursor-pointer shadow-sm",
                    status.mode === "online"
                      ? "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
                      : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title={status.mode === "online" ? "Detener Datos Online (Escaneo automático)" : "Iniciar Datos Online (Escaneo automático)"}
                >
                  {isToggling ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : status.mode === "online" ? (
                    <Pause className="h-2.5 w-2.5" />
                  ) : (
                    <Play className="h-2.5 w-2.5" />
                  )}
                </button>
              </div>
            ) : (
              <span className="text-muted-foreground font-medium">—</span>
            )}
          </div>

          {/* Último Escaneo */}
          <div 
            className="flex items-center gap-2 cursor-help transition-all duration-300"
            title={status?.lastRunAt ? `Último scan completo: ${formatDateTime(status.lastRunAt)}` : "No hay escaneos registrados"}
          >
            {isConnected && status?.lastStatus ? (
              status.lastStatus === "success" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 transition-colors" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-destructive animate-bounce" />
              )
            ) : (
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-muted-foreground font-medium">Último scan:</span>
            <span className="font-semibold text-foreground">
              {isConnected && status?.lastRunAt ? (
                ageMinutes(status.lastRunAt) === 0 ? "hace instantes" : `hace ${ageMinutes(status.lastRunAt)}m`
              ) : (
                "Nunca"
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* --- Mobile Compact Status Indicators (Interactivo al toque) --- */}
          <button 
            onClick={handleOnlineToggle}
            disabled={!isConnected || isToggling}
            className={cn(
              "flex lg:hidden items-center gap-1.5 px-2.5 py-1 bg-muted/40 border border-border/60 rounded-full text-[10px] select-none mr-1.5 cursor-pointer hover:bg-muted/70 transition-all shadow-sm",
              "disabled:opacity-75 disabled:cursor-not-allowed"
            )}
            title={
              isConnected && status
                ? `Worker: En línea | Modo: ${status.mode} | Último scan: ${
                    status.lastRunAt ? `${ageMinutes(status.lastRunAt)}m` : 'Nunca'
                  } (Pulsa para alternar Datos Online)`
                : "Worker: Desconectado"
            }
          >
            {/* Connection Dot */}
            <span className="relative flex h-1.5 w-1.5">
              {isConnected && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />}
              <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", isConnected ? "bg-emerald-500" : "bg-destructive")} />
            </span>
            {/* Auto-Scan Dot */}
            {isConnected && (
              isToggling ? (
                <Loader2 className="h-1.5 w-1.5 animate-spin text-muted-foreground" />
              ) : status?.mode === "online" ? (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
                </span>
              ) : null
            )}
            {/* Last scan ago in minutes */}
            <span className="text-muted-foreground font-mono font-medium leading-none">
              {isConnected && status?.lastRunAt ? (
                `${ageMinutes(status.lastRunAt)}m`
              ) : (
                "—"
              )}
            </span>
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <TimezoneSelector />
            <ThemeToggle />
          </div>
          
          <div className="h-8 w-[1px] bg-border mx-2 hidden sm:block" />
          
          <span className="text-xs text-muted-foreground hidden md:block max-w-[150px] truncate">
            {user.email}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive transition-colors gap-2"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed top-16 left-0 bottom-0 w-[280px] bg-card border-r z-50 lg:hidden transition-transform duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <nav className="flex flex-col p-4 gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          
          <div className="mt-4 pt-4 border-t space-y-4">
            <div className="px-4 py-2 flex flex-col gap-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Preferencias
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm">Tema</span>
                <ThemeToggle />
              </div>
              <div className="space-y-1">
                <span className="text-sm">Zona Horaria</span>
                <TimezoneSelector />
              </div>
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
