import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { MonitorSummary } from '@/lib/actions/monitor.actions'

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

function ChangeIndicator({ changePct }: { changePct: number | null }) {
  if (changePct === null) return <span className="text-xs text-muted-foreground">—</span>
  const abs = Math.abs(changePct)
  if (abs < 0.01) return (
    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="w-3 h-3" /> {abs.toFixed(2)}%
    </span>
  )
  const isUp = changePct > 0
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-green-500' : 'text-red-400'}`}>
      {isUp
        ? <TrendingUp className="w-3 h-3" />
        : <TrendingDown className="w-3 h-3" />
      }
      {isUp ? '+' : ''}{changePct.toFixed(2)}%
    </span>
  )
}

const PLATFORM_LABELS: Record<string, string> = {
  binance_p2p_ves: 'Binance P2P · VES',
  binance_spot:    'Binance Spot',
  bybit_spot:      'Bybit Spot',
  bybit_p2p_ves:   'Bybit P2P · VES',
}

export function PriceStatsCard({ summary }: { summary: MonitorSummary }) {
  const age = summary.lastRecordedAt
    ? Math.round((Date.now() - new Date(summary.lastRecordedAt).getTime()) / 60_000)
    : null

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono font-semibold text-sm">{summary.asset}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {PLATFORM_LABELS[summary.platform] ?? summary.platform}
            </p>
          </div>
          <ChangeIndicator changePct={summary.change24hPct} />
        </div>

        {/* Min/Max */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-red-500/5 border border-red-500/15 p-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Mínimo</p>
            <p className="text-sm font-bold text-red-400">
              {formatPrice(summary.currentMin, summary.baseCurrency)}
            </p>
          </div>
          <div className="rounded-md bg-green-500/5 border border-green-500/15 p-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Máximo</p>
            <p className="text-sm font-bold text-green-500">
              {formatPrice(summary.currentMax, summary.baseCurrency)}
            </p>
          </div>
        </div>

        {/* Age */}
        {age !== null && (
          <p className="text-[10px] text-muted-foreground text-right">
            Actualizado hace {age < 60 ? `${age}min` : `${Math.round(age / 60)}h`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
