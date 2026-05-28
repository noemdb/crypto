'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  AreaChart,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TimeRangeSelector } from './time-range-selector'
import { PriceHistoryDialog } from './price-history-dialog'
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
  const [chartType, setChartType] = useState<'global' | 'detail'>('detail')
  const [isPending, startTransition] = useTransition()
  const { tz, formatTimeShort, formatDateTime } = useTimezone()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedType = sessionStorage.getItem('monitor-chart-type')
    if (savedType === 'global' || savedType === 'detail') {
      setChartType(savedType)
    }
  }, [])

  function handleChartTypeChange(type: 'global' | 'detail') {
    setChartType(type)
    sessionStorage.setItem('monitor-chart-type', type)
  }

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

  // Ordenar cronológicamente (asc) antes de renderizar para garantizar
  // que Recharts dibuje la línea de izquierda a derecha en el tiempo.
  const chartData = [...points]
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .map(p => ({
      // Usamos el timestamp numérico como clave del eje X para que Recharts
      timeMs: new Date(p.time).getTime(),
      timeRaw: p.time,
      priceMin: p.priceMin,
      priceMax: p.priceMax,
      priceMid: p.priceMid,
      priceRange: [p.priceMin, p.priceMax],
    }))

  return (
    <div className="space-y-4 w-full min-w-0 overflow-hidden">
      {/* Header con stats extremos */}
      {extremes && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3 text-center">
          <div className="rounded-lg border bg-red-500/5 border-red-500/20 p-1.5 min-[400px]:p-2 sm:p-3 min-w-0 overflow-hidden">
            <p className="text-[8px] min-[400px]:text-[10px] text-muted-foreground uppercase tracking-wide truncate">
              Mínimo
            </p>
            <p className="text-xs min-[400px]:text-sm sm:text-lg font-bold text-red-400 mt-0.5 truncate">
              {extremes.absoluteMin !== null
                ? formatPrice(extremes.absoluteMin, currency)
                : '—'}
            </p>
            {extremes.absoluteMinTime && (
              <p className="text-[9px] min-[400px]:text-[10px] text-muted-foreground mt-0.5 truncate">
                {mounted ? formatDateTime(extremes.absoluteMinTime) : ''}
              </p>
            )}
          </div>
          <div className="rounded-lg border bg-muted/30 p-1.5 min-[400px]:p-2 sm:p-3 min-w-0 overflow-hidden">
            <p className="text-[8px] min-[400px]:text-[10px] text-muted-foreground uppercase tracking-wide truncate">
              Promedio
            </p>
            <p className="text-xs min-[400px]:text-sm sm:text-lg font-bold mt-0.5 truncate">
              {extremes.average !== null
                ? formatPrice(extremes.average, currency)
                : '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-green-500/5 border-green-500/20 p-1.5 min-[400px]:p-2 sm:p-3 min-w-0 overflow-hidden">
            <p className="text-[8px] min-[400px]:text-[10px] text-muted-foreground uppercase tracking-wide truncate">
              Máximo
            </p>
            <p className="text-xs min-[400px]:text-sm sm:text-lg font-bold text-green-500 mt-0.5 truncate">
              {extremes.absoluteMax !== null
                ? formatPrice(extremes.absoluteMax, currency)
                : '—'}
            </p>
            {extremes.absoluteMaxTime && (
              <p className="text-[9px] min-[400px]:text-[10px] text-muted-foreground mt-0.5 truncate">
                {mounted ? formatDateTime(extremes.absoluteMaxTime) : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Selector de rango y Botón de Histórico */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <TimeRangeSelector value={rangeKey} onChange={handleRangeChange} />
          
          <div className="h-4 w-px bg-border mx-1 hidden sm:block" />
          
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={chartType === 'detail' ? 'default' : 'outline'}
              className={cn('h-7 px-2.5 text-xs', chartType === 'detail' && 'shadow-sm')}
              onClick={() => handleChartTypeChange('detail')}
              title="Adaptado para diferencias pequeñas (Zoom en el spread)"
            >
              Detalle
            </Button>
            <Button
              size="sm"
              variant={chartType === 'global' ? 'default' : 'outline'}
              className={cn('h-7 px-2.5 text-xs', chartType === 'global' && 'shadow-sm')}
              onClick={() => handleChartTypeChange('global')}
              title="Adaptado para diferencias grandes (Eje desde 0)"
            >
              Global
            </Button>
          </div>

          {isPending && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-1" />
          )}
        </div>
        <PriceHistoryDialog platform={platform} asset={asset} baseCurrency={currency} />
      </div>

      {/* Gráfico */}
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          Sin datos en este período. Ejecuta un scan para comenzar a registrar precios.
        </div>
      ) : (
        <ChartContainer config={CHART_CONFIG} className="h-40 sm:h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'global' ? (
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
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
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="timeMs"
                  scale="time"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tickFormatter={(ms) =>
                    mounted ? formatAxisTime(new Date(ms as number).toISOString(), rangeKey, tz) : ''
                  }
                />
                <YAxis
                  domain={[0, 'auto']}
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatPrice(v as number, currency)}
                  width={currency === 'VES' ? 58 : 44}
                />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    if (Array.isArray(value)) {
                      return [`${formatPrice(value[0], currency)} - ${formatPrice(value[1], currency)}`, name]
                    }
                    return [formatPrice(value as number, currency), name]
                  }}
                  labelFormatter={(ms) =>
                    mounted
                      ? formatAxisTime(new Date(ms as number).toISOString(), rangeKey, tz)
                      : ''
                  }
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="priceMax" name="Máximo" stroke="var(--color-success)" strokeWidth={1.5} fill="url(#gradMax)" dot={chartData.length === 1} />
                <Area type="monotone" dataKey="priceMid" name="Medio" stroke="var(--color-brand-primary)" strokeWidth={1.5} fill="none" dot={chartData.length === 1} strokeDasharray="4 2" />
                <Area type="monotone" dataKey="priceMin" name="Mínimo" stroke="var(--color-destructive)" strokeWidth={1.5} fill="url(#gradMin)" dot={chartData.length === 1} />
              </AreaChart>
            ) : (
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="gradRange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="timeMs"
                  scale="time"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tickFormatter={(ms) =>
                    mounted ? formatAxisTime(new Date(ms as number).toISOString(), rangeKey, tz) : ''
                  }
                />
                <YAxis
                  domain={([dataMin, dataMax]) => {
                    const pad = (dataMax - dataMin) * 0.1 || 1;
                    return [Math.max(0, dataMin - pad), dataMax + pad];
                  }}
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatPrice(v as number, currency)}
                  width={currency === 'VES' ? 58 : 44}
                />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    if (name === 'Rango (Mín-Máx)') return [];
                    if (Array.isArray(value)) {
                      return [`${formatPrice(value[0], currency)} - ${formatPrice(value[1], currency)}`, name]
                    }
                    return [formatPrice(value as number, currency), name]
                  }}
                  labelFormatter={(ms) =>
                    mounted
                      ? formatAxisTime(new Date(ms as number).toISOString(), rangeKey, tz)
                      : ''
                  }
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                
                <Area type="stepAfter" dataKey="priceRange" name="Rango (Mín-Máx)" stroke="none" fill="url(#gradRange)" />
                <Line type="stepAfter" dataKey="priceMid" name="Medio" stroke="var(--color-brand-primary)" strokeWidth={2} dot={chartData.length === 1} />
                <Line type="stepAfter" dataKey="priceMax" name="Máximo" stroke="var(--color-success)" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                <Line type="stepAfter" dataKey="priceMin" name="Mínimo" stroke="var(--color-destructive)" strokeWidth={1} strokeDasharray="3 3" dot={false} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </ChartContainer>
      )}

      <div className="flex flex-wrap justify-between items-center gap-1 mt-2 border-t pt-2 min-w-0 overflow-hidden">
        <p className="text-[10px] text-muted-foreground whitespace-nowrap">
          Último scan: <span className="font-mono text-foreground">{mounted && lastRunAt ? formatTimeShort(lastRunAt) : 'Pendiente'}</span>
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {extremes?.dataPoints ?? 0} pts · {data?.asset}
        </p>
      </div>
    </div>
  )
}
