'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useTimezone } from '@/lib/hooks/use-timezone'
import { X } from 'lucide-react'
import type { PaymentMethodSummary } from '@/lib/actions/monitor.actions'

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
  onClose: () => void
}

export function PaymentMethodStatsCard({ summary, onClose }: Props) {
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
