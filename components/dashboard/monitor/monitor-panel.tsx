'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PlatformSelector } from './platform-selector'
import { PriceStatsCard } from './price-stats-card'
import { PaymentMethodStatsCard } from './payment-method-stats-card'
import { PriceChart } from './price-chart'
import type {
  MonitorSummary,
  PriceChartData,
  PaymentMethodSummary,
  PaymentMethodSeries,
} from '@/lib/actions/monitor.actions'
import {
  getMonitorSummary,
  getPaymentMethodSummary,
  getPaymentMethodChartData,
} from '@/lib/actions/monitor.actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const explicitWorkerBase = process.env.NEXT_PUBLIC_SCAN_WORKER_URL?.replace(/\/$/, "");
const defaultWorkerBases = [
  explicitWorkerBase,
  "/api/scan-worker",
  typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3333` : null,
  "http://127.0.0.1:3333",
  "http://localhost:3333",
].filter((url): url is string => Boolean(url));

function formatMonitorPrice(price: number | null, currency: string) {
  if (price === null || Number.isNaN(price) || !Number.isFinite(price)) return '—'
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: currency === 'VES' ? 2 : 4,
    maximumFractionDigits: currency === 'VES' ? 2 : 4,
  }

  if (currency === 'USD') {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency, ...options }).format(price)
  }

  return new Intl.NumberFormat('es-VE', options).format(price)
}

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

  // Estado de métodos de pago activos — compartido entre gráfico y tarjetas
  // Persistido en sessionStorage para mantenerlo entre navegaciones
  const [activePMs, setActivePMs] = useState<Set<string>>(new Set())
  const [pmSummary, setPmSummary] = useState<PaymentMethodSummary[]>([])
  const [pmSummaryLoading, setPmSummaryLoading] = useState(false)
  const [pmSeries, setPmSeries] = useState<PaymentMethodSeries[]>([])
  const [pmSeriesLoading, setPmSeriesLoading] = useState(false)
  const [sessionLoaded, setSessionLoaded] = useState(false)

  const isP2P = platform === 'binance_p2p_ves'

  useEffect(() => {
    setSummaryData(summary)
  }, [summary])

  // Restaurar activePMs desde sessionStorage al montar
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('monitor-active-pms')
      if (stored) {
        const parsed: string[] = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActivePMs(new Set(parsed))
        }
      }
    } catch { /* ignorar errores de parse */ }
    setSessionLoaded(true)
  }, [])

  // Persistir activePMs en sessionStorage cada vez que cambia
  useEffect(() => {
    if (!sessionLoaded) return  // no sobrescribir antes de leer
    sessionStorage.setItem('monitor-active-pms', JSON.stringify([...activePMs]))
  }, [activePMs, sessionLoaded])

  // Cargar resumen de métodos de pago cuando cambia plataforma o asset
  useEffect(() => {
    if (!isP2P) {
      setPmSummary([])
      setActivePMs(new Set())
      return
    }
    setPmSummaryLoading(true)
    getPaymentMethodSummary(platform, initialAsset)
      .then(setPmSummary)
      .catch(console.error)
      .finally(() => setPmSummaryLoading(false))
  }, [platform, initialAsset, isP2P])

  // Recargar resumen PM cuando el worker finaliza un ciclo
  useEffect(() => {
    if (!isP2P || activePMs.size === 0) return
    getPaymentMethodSummary(platform, initialAsset)
      .then(setPmSummary)
      .catch(console.error)
  }, [lastRunAt, platform, initialAsset, isP2P, activePMs.size])

  useEffect(() => {
    if (!isP2P || activePMs.size === 0) {
      setPmSeries([])
      return
    }

    let active = true
    setPmSeriesLoading(true)

    getPaymentMethodChartData(platform, initialAsset, '24h', lastRunAt)
      .then(series => {
        if (active) setPmSeries(series)
      })
      .catch(console.error)
      .finally(() => {
        if (active) setPmSeriesLoading(false)
      })

    return () => {
      active = false
    }
  }, [platform, initialAsset, lastRunAt, activePMs.size, isP2P])

  function togglePM(id: string) {
    setActivePMs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fetchWorkerStatus = useCallback(async () => {
    for (const base of defaultWorkerBases) {
      try {
        const response = await fetch(`${base}/scan/status`, { cache: "no-store" });
        if (!response.ok) throw new Error("Worker unavailable");
        const json = await response.json();
        if (json && typeof json.lastRunAt === 'string') setLastRunAt(json.lastRunAt)
        return;
      } catch { /* intentar siguiente */ }
    }
  }, [])

  useEffect(() => {
    fetchWorkerStatus()
    const interval = setInterval(fetchWorkerStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchWorkerStatus])

  useEffect(() => {
    if (lastRunAt && lastRunAt !== lastRunAtRef.current) {
      if (lastRunAtRef.current !== null) {
        getMonitorSummary()
          .then(newSummary => { if (newSummary) setSummaryData(newSummary) })
          .catch(err => console.error("[monitor-panel]", err))
      }
      lastRunAtRef.current = lastRunAt
    }
  }, [lastRunAt])

  const availablePlatforms = Array.from(new Set(summaryData.map(s => s.platform)))
  const activeStats = summaryData.filter(s => s.platform === platform)

  const platformStats = activeStats.length > 0 ? {
    currentMin: activeStats.reduce<number>((acc, stat) => stat.currentMin !== null ? Math.min(acc, stat.currentMin) : acc, Number.POSITIVE_INFINITY),
    currentMax: activeStats.reduce<number>((acc, stat) => stat.currentMax !== null ? Math.max(acc, stat.currentMax) : acc, Number.NEGATIVE_INFINITY),
    avgChange24hPct: (() => {
      const changes = activeStats
        .map((stat) => stat.change24hPct)
        .filter((value): value is number => value !== null)
      return changes.length > 0
        ? changes.reduce((sum, value) => sum + value, 0) / changes.length
        : null
    })(),
    baseCurrency: activeStats[0]?.baseCurrency ?? 'USD',
  } : null

  const activePmSeriesById = Object.fromEntries(pmSeries.map(series => [series.id, series]))

  // Solo los PMs activos que tienen datos en el resumen
  const activePMSummaries = pmSummary.filter(pm => activePMs.has(pm.paymentMethodId))

  return (
    <div className="space-y-6">
      {/* 1. Selector de Plataforma */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium">Plataforma</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <PlatformSelector
            platforms={availablePlatforms}
            selected={platform}
            onSelect={setPlatform}
          />
          {platformStats && (
            <div className="rounded-2xl border border-muted/30 bg-muted/50 px-3 py-2 text-xs text-muted-foreground grid grid-cols-3 gap-3 min-w-[240px]">
              <div className="space-y-0.5">
                <p className="uppercase tracking-wide text-[10px]">Mín</p>
                <p className="font-semibold text-foreground">
                  {formatMonitorPrice(platformStats.currentMin, platformStats.baseCurrency)}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="uppercase tracking-wide text-[10px]">Máx</p>
                <p className="font-semibold text-foreground">
                  {formatMonitorPrice(platformStats.currentMax, platformStats.baseCurrency)}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="uppercase tracking-wide text-[10px]">Δ 24h</p>
                <p className={`font-semibold ${platformStats.avgChange24hPct === null ? 'text-muted-foreground' : platformStats.avgChange24hPct >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                  {platformStats.avgChange24hPct === null
                    ? '—'
                    : `${platformStats.avgChange24hPct >= 0 ? '+' : ''}${platformStats.avgChange24hPct.toFixed(2)}%`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Tarjetas de Resumen — General */}
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

      {/* 2b. Tarjetas de Resumen — Por Método de Pago (cuando hay PMs activos) */}
      {activePMSummaries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Precio actual por método de pago
          </p>
          <div className="flex flex-wrap gap-2 sm:gap-3 min-w-0">
            {activePMSummaries.map(pm => (
              <div 
                key={pm.paymentMethodId}
                className="flex-auto min-w-[calc(33.33%-1rem)] max-w-[calc(50%-0.25rem)]"
              >
                <PaymentMethodStatsCard
                  summary={pm}
                  series={activePmSeriesById[pm.paymentMethodId]}
                  onClose={() => togglePM(pm.paymentMethodId)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

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
            activePMs={activePMs}
            onTogglePM={togglePM}
          />
        </CardContent>
      </Card>
    </div>
  )
}
