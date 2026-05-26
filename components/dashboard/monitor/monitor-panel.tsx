'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PlatformSelector } from './platform-selector'
import { PriceStatsCard } from './price-stats-card'
import { PriceChart } from './price-chart'
import type { MonitorSummary, PriceChartData } from '@/lib/actions/monitor.actions'
import { getMonitorSummary } from '@/lib/actions/monitor.actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const explicitWorkerBase = process.env.NEXT_PUBLIC_SCAN_WORKER_URL?.replace(/\/$/, "");
const defaultWorkerBases = [
  explicitWorkerBase,
  "/api/scan-worker",
  typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3333` : null,
  "http://127.0.0.1:3333",
  "http://localhost:3333",
].filter((url): url is string => Boolean(url));

type Props = {
  summary: MonitorSummary[]
  initialChartData: PriceChartData | null
  initialPlatform: string
  initialAsset: string
}

export function MonitorPanel({
  summary,
  initialChartData,
  initialPlatform,
  initialAsset,
}: Props) {
  const [platform, setPlatform] = useState(initialPlatform)
  const [summaryData, setSummaryData] = useState<MonitorSummary[]>(summary)
  const [lastRunAt, setLastRunAt] = useState<string | null>(null)
  const lastRunAtRef = useRef<string | null>(null)

  // Sincronizar stats iniciales si cambian desde el componente de servidor
  useEffect(() => {
    setSummaryData(summary)
  }, [summary])

  const fetchWorkerStatus = useCallback(async () => {
    for (const base of defaultWorkerBases) {
      try {
        const response = await fetch(`${base}/scan/status`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Worker unavailable");
        }

        const json = await response.json();
        if (json && typeof json.lastRunAt === 'string') {
          setLastRunAt(json.lastRunAt)
        }
        return;
      } catch {
        // Intentar con el siguiente base URL
      }
    }
  }, [])

  // Sondeo periódico del estado del worker cada 5 segundos
  useEffect(() => {
    fetchWorkerStatus()
    const interval = setInterval(fetchWorkerStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchWorkerStatus])

  // Reactivar actualización de estadísticas cuando el worker finalice un ciclo
  useEffect(() => {
    if (lastRunAt && lastRunAt !== lastRunAtRef.current) {
      if (lastRunAtRef.current !== null) {
        getMonitorSummary()
          .then((newSummary) => {
            if (newSummary) {
              setSummaryData(newSummary)
            }
          })
          .catch((err) => {
            console.error("[monitor-panel] Error al actualizar estadísticas:", err)
          })
      }
      lastRunAtRef.current = lastRunAt
    }
  }, [lastRunAt])

  // Obtener plataformas únicas del resumen
  const availablePlatforms = Array.from(new Set(summaryData.map(s => s.platform)))

  // Filtrar summary por la plataforma seleccionada
  const activeStats = summaryData.filter(s => s.platform === platform)

  return (
    <div className="space-y-6">
      {/* 1. Selector de Plataforma Principal */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium">Plataforma</h2>
        <PlatformSelector
          platforms={availablePlatforms}
          selected={platform}
          onSelect={setPlatform}
        />
      </div>

      {/* 2. Tarjetas de Resumen (Mínimo / Máximo) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 min-w-0">
        {activeStats.map((stat) => (
          <PriceStatsCard key={stat.asset} summary={stat} />
        ))}
        {activeStats.length === 0 && (
          <div className="col-span-full p-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
            No hay datos recientes para esta plataforma.
          </div>
        )}
      </div>

      {/* 3. Gráfico Histórico */}
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="text-sm sm:text-base flex items-center justify-between">
            <span>Histórico de Precio</span>
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              {initialAsset}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="w-full min-w-0 overflow-hidden p-2 sm:p-6">
          <PriceChart
            initialData={initialChartData}
            platform={platform}
            asset={initialAsset}
            lastRunAt={lastRunAt}
          />
        </CardContent>
      </Card>
    </div>
  )
}
