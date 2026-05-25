'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import { TimeRangeSelector } from './time-range-selector'
import { getPriceChartData } from '@/lib/actions/monitor.actions'
import type { PriceChartData } from '@/lib/actions/monitor.actions'
import type { TimeRangeKey } from '@/lib/price-monitor/constants'
import { Loader2 } from 'lucide-react'
import { useTimezone } from '@/lib/hooks/use-timezone'

const CHART_CONFIG = {
  priceMin: { label: 'Precio Mínimo', color: 'var(--color-destructive)' },
  priceMax: { label: 'Precio Máximo', color: 'var(--color-success)' },
  priceMid: { label: 'Precio Medio',  color: 'var(--color-brand-primary)' },
}

function formatAxisTime(isoString: string, rangeKey: TimeRangeKey, tz: string): string {
  const d = new Date(isoString)
  if (rangeKey === '24h') {
    return d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  }
  if (rangeKey === '3d' || rangeKey === '7d') {
    return d.toLocaleDateString('es-VE', { weekday: 'short', hour: '2-digit', timeZone: tz })
  }
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', timeZone: tz })
}

function formatPrice(value: number, currency: string): string {
  if (currency === 'VES') {
    return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(value)
  }
  return `$${value.toFixed(2)}`
}

type Props = {
  initialData: PriceChartData | null
  platform: string
  asset: string
  lastRunAt?: string | null
}

export function PriceChart({ initialData, platform, asset, lastRunAt }: Props) {
  const [data, setData] = useState<PriceChartData | null>(initialData)
  const [rangeKey, setRangeKey] = useState<TimeRangeKey>('24h')
  const [isPending, startTransition] = useTransition()
  const { tz } = useTimezone()

  // Sincronizar datos reactivamente cuando cambia la plataforma, el activo, el rango de tiempo o la última ejecución del worker
  useEffect(() => {
    let active = true
    async function loadData() {
      // Pasamos lastRunAt como cache buster para garantizar que Next.js no devuelva una respuesta cacheada de la Server Action
      const newData = await getPriceChartData(platform, asset, rangeKey, lastRunAt)
      if (active) {
        setData(newData)
      }
    }
    loadData()
    return () => {
      active = false
    }
  }, [platform, asset, rangeKey, lastRunAt])

  function handleRangeChange(newRange: TimeRangeKey) {
    setRangeKey(newRange)
    startTransition(async () => {
      const newData = await getPriceChartData(platform, asset, newRange)
      setData(newData)
    })
  }

  const currency = data?.baseCurrency ?? 'USD'
  const points = data?.points ?? []
  const extremes = data?.extremes

  const chartData = points.map(p => ({
    time: formatAxisTime(p.time, rangeKey, tz),
    timeRaw: p.time,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    priceMid: p.priceMid,
  }))

  return (
    <div className="space-y-4">
      {/* Header con stats extremos */}
      {extremes && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border bg-red-500/5 border-red-500/20 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Mínimo del período
            </p>
            <p className="text-lg font-bold text-red-400 mt-0.5">
              {extremes.absoluteMin !== null
                ? formatPrice(extremes.absoluteMin, currency)
                : '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Promedio
            </p>
            <p className="text-lg font-bold mt-0.5">
              {extremes.average !== null
                ? formatPrice(extremes.average, currency)
                : '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-green-500/5 border-green-500/20 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Máximo del período
            </p>
            <p className="text-lg font-bold text-green-500 mt-0.5">
              {extremes.absoluteMax !== null
                ? formatPrice(extremes.absoluteMax, currency)
                : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Selector de rango */}
      <div className="flex items-center justify-between">
        <TimeRangeSelector value={rangeKey} onChange={handleRangeChange} />
        {isPending && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Gráfico */}
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          Sin datos en este período. Ejecuta un scan para comenzar a registrar precios.
        </div>
      ) : (
        <ChartContainer config={CHART_CONFIG} className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <defs>
                <linearGradient id="gradMin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-destructive)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--color-destructive)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradMax" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatPrice(v as number, currency)}
                width={currency === 'VES' ? 70 : 55}
              />
              <Tooltip
                formatter={(value: any) => [formatPrice(value as number, currency), '']}
                labelFormatter={(label) => `Hora: ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="priceMax"
                name="Máximo"
                stroke="var(--color-success)"
                strokeWidth={1.5}
                fill="url(#gradMax)"
                dot={chartData.length === 1}
              />
              <Area
                type="monotone"
                dataKey="priceMid"
                name="Medio"
                stroke="var(--color-brand-primary)"
                strokeWidth={1.5}
                fill="none"
                dot={chartData.length === 1}
                strokeDasharray="4 2"
              />
              <Area
                type="monotone"
                dataKey="priceMin"
                name="Mínimo"
                stroke="var(--color-destructive)"
                strokeWidth={1.5}
                fill="url(#gradMin)"
                dot={chartData.length === 1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}

      <p className="text-[10px] text-muted-foreground text-right">
        {extremes?.dataPoints ?? 0} puntos de datos · {data?.platform} · {data?.asset}
      </p>
    </div>
  )
}
