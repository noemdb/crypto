'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useTimezone } from '@/lib/hooks/use-timezone'
import { X } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { PaymentMethodSummary, PaymentMethodSeries } from '@/lib/actions/monitor.actions'

const PM_COLORS: Record<string, string> = {
  PagoMovil:        '#3B82F6',
  Banesco:          '#003C71',
  BancoDeVenezuela: '#EAB308',
  BANK:             '#8B5CF6',
  Mercantil:        '#10B981',
}

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return '—'
  if (currency === 'VES') {
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }
  return `$${price.toFixed(4)}`
}

type Props = {
  summary: PaymentMethodSummary
  series: PaymentMethodSeries | undefined
  onClose: () => void
}

export function PaymentMethodStatsCard({ summary, series, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const { formatDateTime } = useTimezone()

  useEffect(() => {
    setMounted(true)
  }, [])

  const color = PM_COLORS[summary.paymentMethodId] ?? '#888'

  const age = mounted && summary.lastRecordedAt
    ? Math.round((Date.now() - new Date(summary.lastRecordedAt).getTime()) / 60_000)
    : null

  const hasData = summary.currentMin !== null || summary.currentMax !== null

  return (
    <Card className="min-w-0 overflow-hidden relative" style={{ borderColor: `${color}40` }}>
      {/* Barra de color superior */}
      <div className="h-0.5 w-full" style={{ backgroundColor: color }} />

      <CardContent className="p-2 sm:p-3 space-y-2">
        {/* Header con nombre y botón cerrar */}
        <div className="flex items-center justify-between gap-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <p className="text-[10px] sm:text-xs font-medium truncate" style={{ color }}>
              {summary.paymentMethodLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title={`Ocultar ${summary.paymentMethodLabel}`}
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {hasData ? (
          <>
            {/* Min / Max */}
            <div className="grid grid-cols-2 gap-1">
              <div className="rounded bg-red-500/5 border border-red-500/15 p-1 min-w-0">
                <p className="text-[8px] text-muted-foreground uppercase tracking-wide">Min</p>
                <p className="text-[10px] sm:text-xs font-bold text-red-400 truncate">
                  {formatPrice(summary.currentMin, summary.baseCurrency)}
                </p>
              </div>
              <div className="rounded bg-green-500/5 border border-green-500/15 p-1 min-w-0">
                <p className="text-[8px] text-muted-foreground uppercase tracking-wide">Max</p>
                <p className="text-[10px] sm:text-xs font-bold text-green-500 truncate">
                  {formatPrice(summary.currentMax, summary.baseCurrency)}
                </p>
              </div>
            </div>

            {series && series.points.length > 0 && (
              <div className="h-28 mt-2 -mx-2 sm:-mx-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={series.points.map(point => ({
                      time: new Date(point.time).getTime(),
                      priceMid: point.priceMid,
                    }))}
                    margin={{ top: 4, right: 4, left: 4, bottom: 22 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/40" />
                    <XAxis
                      dataKey="time"
                      type="number"
                      scale="time"
                      tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={true}
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(value) => {
                        const date = new Date(value as number)
                        return date.toLocaleTimeString('es-VE', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'America/Caracas',
                        })
                      }}
                      label={{ value: 'Hora', position: 'insideBottomRight', offset: -4, style: { fontSize: 9, fill: 'var(--muted-foreground)' } }}
                      minTickGap={18}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={true}
                      domain={([dataMin, dataMax]: readonly [number, number]) => {
                        const pad = (dataMax - dataMin) * 0.05 || 1
                        return [Math.max(0, dataMin - pad), dataMax + pad] as [number, number]
                      }}
                      width={40}
                      tickFormatter={(value: number) => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}
                      label={{ value: 'Precio', angle: -90, position: 'insideLeft', offset: -12, style: { fontSize: 9, fill: 'var(--muted-foreground)' } }}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatPrice(value as number, summary.baseCurrency), 'Precio']}
                      labelFormatter={(value) => {
                        const date = new Date(value as number)
                        return date.toLocaleTimeString('es-VE', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'America/Caracas',
                        })
                      }}
                      wrapperStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                    />
                    <Line
                      dataKey="priceMid"
                      stroke={color}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Timestamp / Age */}
            {summary.lastRecordedAt && (
              <p className="text-[8px] text-muted-foreground text-right truncate">
                {mounted
                  ? age !== null
                    ? `Hace ${age < 60 ? `${age}min` : `${Math.round(age / 60)}h`}`
                    : formatDateTime(summary.lastRecordedAt)
                  : ''}
              </p>
            )}
          </>
        ) : (
          <p className="text-[9px] text-muted-foreground text-center py-1">
            Sin datos aún
          </p>
        )}
      </CardContent>
    </Card>
  )
}
