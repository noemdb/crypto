'use client'

import { useState, useTransition, useEffect } from 'react'
import {
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
import { getPriceChartData, getPaymentMethodChartData } from '@/lib/actions/monitor.actions'
import type { PriceChartData, PaymentMethodSeries } from '@/lib/actions/monitor.actions'
import type { TimeRangeKey } from '@/lib/price-monitor/constants'
import { Loader2 } from 'lucide-react'
import { useTimezone } from '@/lib/hooks/use-timezone'

// Colores para los métodos de pago populares
const PM_COLORS: Record<string, string> = {
  PagoMovil:        '#3B82F6', // azul
  Banesco:          '#003C71', // azul oscuro banesco
  BancoDeVenezuela: '#EAB308', // amarillo BDV
  BANK:             '#8B5CF6', // violeta
  Mercantil:        '#10B981', // verde
}

const PM_LABELS: Record<string, string> = {
  PagoMovil:        'Pago Movil',
  Banesco:          'Banesco',
  BancoDeVenezuela: 'Banco de Venezuela',
  BANK:             'Bank Transfer',
  Mercantil:        'Mercantil',
}

const CHART_CONFIG = {
  priceMid: { label: 'General (Medio)', color: 'var(--color-brand-primary)' },
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
  activePMs: Set<string>
  onTogglePM: (id: string) => void
}

export function PriceChart({ initialData, platform, asset, lastRunAt, activePMs, onTogglePM }: Props) {
  const [data, setData] = useState<PriceChartData | null>(initialData)
  const [rangeKey, setRangeKey] = useState<TimeRangeKey>('24h')
  const [chartType, setChartType] = useState<'global' | 'detail'>('detail')
  const [isPending, startTransition] = useTransition()
  const { tz, formatTimeShort, formatDateTime } = useTimezone()
  const [mounted, setMounted] = useState(false)

  // Payment method overlay state (series para el gráfico; activePMs viene del padre)
  const [pmSeries, setPmSeries] = useState<PaymentMethodSeries[]>([])
  const [pmLoading, setPmLoading] = useState(false)
  const isP2P = platform === 'binance_p2p_ves'

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

  // Cargar datos generales
  useEffect(() => {
    let active = true
    async function loadData() {
      const newData = await getPriceChartData(platform, asset, rangeKey, lastRunAt)
      if (active) setData(newData)
    }
    loadData()
    return () => { active = false }
  }, [platform, asset, rangeKey, lastRunAt])

  // Cargar series de métodos de pago cuando hay alguno activo
  useEffect(() => {
    if (!isP2P || activePMs.size === 0) {
      setPmSeries([])
      return
    }
    let active = true
    setPmLoading(true)
    getPaymentMethodChartData(platform, asset, rangeKey, lastRunAt).then(series => {
      if (active) {
        setPmSeries(series.filter(s => activePMs.has(s.id)))
        setPmLoading(false)
      }
    }).catch(() => setPmLoading(false))
    return () => { active = false }
  }, [platform, asset, rangeKey, lastRunAt, activePMs, isP2P])

  // togglePM delegado al padre (MonitorPanel)

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

  // Mapa de tiempo → datos por método de pago para hacer join con los puntos generales
  const pmDataByTime: Record<string, Record<string, number>> = {}
  for (const series of pmSeries) {
    for (const pt of series.points) {
      // Redondear a minuto para hacer join aproximado
      const roundedMs = Math.round(new Date(pt.time).getTime() / 60000) * 60000
      if (!pmDataByTime[roundedMs]) pmDataByTime[roundedMs] = {}
      pmDataByTime[roundedMs][`pm_${series.id}`] = pt.priceMid
    }
  }

  // Construir chartData general + inyectar datos de métodos de pago
  const generalPoints = [...points]
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .map(p => {
      const timeMs = new Date(p.time).getTime()
      const roundedMs = Math.round(timeMs / 60000) * 60000
      const pmData = pmDataByTime[roundedMs] ?? {}
      return {
        timeMs,
        timeRaw: p.time,
        priceMid: p.priceMid,
        priceMin: p.priceMin,
        priceMax: p.priceMax,
        priceRange: [p.priceMin, p.priceMax] as [number, number],
        ...pmData,
      }
    })

  // También agregar puntos de PM que no coincidan con puntos generales
  // No inyectamos 0 en la serie general, para evitar dips falsos en el gráfico.
  const pmOnlyPoints: typeof generalPoints = []
  for (const series of pmSeries) {
    for (const pt of series.points) {
      const timeMs = new Date(pt.time).getTime()
      const roundedMs = Math.round(timeMs / 60000) * 60000
      const alreadyInGeneral = generalPoints.some(
        g => Math.abs(g.timeMs - roundedMs) < 60000
      )
      if (!alreadyInGeneral) {
        pmOnlyPoints.push({
          timeMs,
          timeRaw: pt.time,
          [`pm_${series.id}`]: pt.priceMid,
        } as any)
      }
    }
  }

  const chartData = [...generalPoints, ...pmOnlyPoints]
    .sort((a, b) => a.timeMs - b.timeMs)

  const yAxisWidth = currency === 'VES' ? 58 : 44
  const commonAxisProps = {
    tick: { fontSize: 9 },
    tickLine: false,
    axisLine: false,
  }
  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 6,
    fontSize: 12,
  }

  return (
    <div className="space-y-4 w-full min-w-0 overflow-hidden">
      {/* Extremes header */}
      {extremes && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3 text-center">
          <div className="rounded-lg border bg-red-500/5 border-red-500/20 p-1.5 min-[400px]:p-2 sm:p-3 min-w-0 overflow-hidden">
            <p className="text-[8px] min-[400px]:text-[10px] text-muted-foreground uppercase tracking-wide truncate">Mínimo</p>
            <p className="text-xs min-[400px]:text-sm sm:text-lg font-bold text-red-400 mt-0.5 truncate">
              {extremes.absoluteMin !== null ? formatPrice(extremes.absoluteMin, currency) : '—'}
            </p>
            {extremes.absoluteMinTime && (
              <p className="text-[9px] min-[400px]:text-[10px] text-muted-foreground mt-0.5 truncate">
                {mounted ? formatDateTime(extremes.absoluteMinTime) : ''}
              </p>
            )}
          </div>
          <div className="rounded-lg border bg-muted/30 p-1.5 min-[400px]:p-2 sm:p-3 min-w-0 overflow-hidden">
            <p className="text-[8px] min-[400px]:text-[10px] text-muted-foreground uppercase tracking-wide truncate">Promedio</p>
            <p className="text-xs min-[400px]:text-sm sm:text-lg font-bold mt-0.5 truncate">
              {extremes.average !== null ? formatPrice(extremes.average, currency) : '—'}
            </p>
          </div>
          <div className="rounded-lg border bg-green-500/5 border-green-500/20 p-1.5 min-[400px]:p-2 sm:p-3 min-w-0 overflow-hidden">
            <p className="text-[8px] min-[400px]:text-[10px] text-muted-foreground uppercase tracking-wide truncate">Máximo</p>
            <p className="text-xs min-[400px]:text-sm sm:text-lg font-bold text-green-500 mt-0.5 truncate">
              {extremes.absoluteMax !== null ? formatPrice(extremes.absoluteMax, currency) : '—'}
            </p>
            {extremes.absoluteMaxTime && (
              <p className="text-[9px] min-[400px]:text-[10px] text-muted-foreground mt-0.5 truncate">
                {mounted ? formatDateTime(extremes.absoluteMaxTime) : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Controles: rango, tipo, métodos de pago */}
      <div className="flex flex-col gap-3">
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

            {(isPending || pmLoading) && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-1" />
            )}
          </div>
          <PriceHistoryDialog platform={platform} asset={asset} baseCurrency={currency} />
        </div>

        {/* Selector de métodos de pago (solo para Binance P2P VES) */}
        {isP2P && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide whitespace-nowrap">
              Por pago:
            </span>
            {Object.entries(PM_LABELS).map(([id, label]) => {
              const active = activePMs.has(id)
              return (
                <button
                  key={id}
                  id={`pm-toggle-${id}`}
                  onClick={() => onTogglePM(id)}
                  title={active ? `Ocultar ${label}` : `Mostrar ${label}`}
                  className={cn(
                    'flex items-center gap-1.5 h-6 px-2 rounded text-[11px] border transition-all',
                    active
                      ? 'text-white border-transparent'
                      : 'text-muted-foreground border-border bg-muted/30 hover:bg-muted/60',
                  )}
                  style={active ? { backgroundColor: PM_COLORS[id], borderColor: PM_COLORS[id] } : {}}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PM_COLORS[id] }}
                  />
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Gráfico */}
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          Sin datos en este período. Ejecuta un scan para comenzar a registrar precios.
        </div>
      ) : (
        <ChartContainer config={CHART_CONFIG} className="h-40 sm:h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="gradRange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="timeMs"
                scale="time"
                type="number"
                domain={['dataMin', 'dataMax']}
                {...commonAxisProps}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                tickFormatter={(ms) =>
                  mounted ? formatAxisTime(new Date(ms as number).toISOString(), rangeKey, tz) : ''
                }
              />
              <YAxis
                domain={chartType === 'global'
                  ? ([0, 'auto'] as [number, string])
                  : (([dataMin, dataMax]: readonly [number, number]) => {
                      const pad = (dataMax - dataMin) * 0.1 || 1
                      return [Math.max(0, dataMin - pad), dataMax + pad] as [number, number]
                    })
                }
                {...commonAxisProps}
                tickFormatter={(v) => formatPrice(v as number, currency)}
                width={yAxisWidth}
              />
              <Tooltip
                formatter={(value: any, name: any) => {
                  if (name === 'Rango') return []
                  if (Array.isArray(value)) {
                    return [`${formatPrice(value[0], currency)} – ${formatPrice(value[1], currency)}`, name]
                  }
                  return [formatPrice(value as number, currency), name]
                }}
                labelFormatter={(ms) =>
                  mounted ? formatAxisTime(new Date(ms as number).toISOString(), rangeKey, tz) : ''
                }
                contentStyle={tooltipStyle}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />

              {/* Rango min-max general */}
              <Area
                type="stepAfter"
                dataKey="priceRange"
                name="Rango"
                stroke="none"
                fill="url(#gradRange)"
              />
              {/* Precio general */}
              <Line
                type="stepAfter"
                dataKey="priceMid"
                name="General"
                stroke="var(--color-brand-primary)"
                strokeWidth={2}
                dot={chartData.length === 1}
                connectNulls
              />

              {/* Líneas por método de pago activos */}
              {pmSeries.map(series => (
                <Line
                  key={series.id}
                  type="monotone"
                  dataKey={`pm_${series.id}`}
                  name={PM_LABELS[series.id] ?? series.label}
                  stroke={PM_COLORS[series.id] ?? '#888'}
                  strokeWidth={1.5}
                  strokeDasharray="5 2"
                  dot={false}
                  connectNulls
                />
              ))}
            </ComposedChart>
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
