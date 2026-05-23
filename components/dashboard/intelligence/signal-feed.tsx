import { Badge } from '@/components/ui/badge'
import type { IntelSignalData } from '@/lib/intelligence/types'

const SIGNAL_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  bcv_rate_update:     { label: 'BCV Rate',         color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',       emoji: '🏦' },
  bcv_rate_spike:      { label: 'BCV Spike',         color: 'bg-red-500/15 text-red-400 border-red-500/30',          emoji: '🚨' },
  bank_window_open:    { label: 'Ventana Bancaria',  color: 'bg-green-500/15 text-green-400 border-green-500/30',    emoji: '🟢' },
  bank_digital_active: { label: 'Intervención Dig.', color: 'bg-green-500/15 text-green-400 border-green-500/30',    emoji: '✅' },
  bank_auction:        { label: 'Subasta Privada',   color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', emoji: '🔔' },
  news_intervention:   { label: 'Prensa — Interv.',  color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', emoji: '📰' },
  news_liquidity:      { label: 'Liquidez',          color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', emoji: '💧' },
  p2p_premium_high:    { label: 'P2P Premium Alto',  color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', emoji: '📈' },
  p2p_premium_low:     { label: 'P2P Premium Bajo',  color: 'bg-muted/50 text-muted-foreground border-border',       emoji: '📉' },
}

function SignalRow({ signal }: { signal: IntelSignalData }) {
  const config = SIGNAL_LABELS[signal.signalType] ?? { label: signal.signalType, color: '', emoji: 'ℹ️' }
  const ageMin = Math.round((Date.now() - new Date(signal.detectedAt).getTime()) / 60_000)
  const ageLabel = ageMin < 60 ? `hace ${ageMin}min` : `hace ${Math.round(ageMin / 60)}h`
  const filled   = Math.round(signal.score * 10)
  const scoreBar = '█'.repeat(filled) + '░'.repeat(10 - filled)

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <span className="text-base mt-0.5">{config.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.color}`}>
            {config.label}
          </Badge>
          {signal.confirmedBy.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/20">
              ✓ Confirmada
            </Badge>
          )}
        </div>
        <p className="text-sm mt-1 font-medium">{signal.summary}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] font-mono text-muted-foreground">
            {scoreBar} {(signal.score * 100).toFixed(0)}%
          </span>
          <span className="text-[10px] text-muted-foreground">{ageLabel}</span>
        </div>
      </div>
    </div>
  )
}

export function SignalFeed({ signals }: { signals: IntelSignalData[] }) {
  if (signals.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Sin señales activas. El sistema está monitoreando.
      </div>
    )
  }

  return (
    <div className="divide-y">
      {signals.map(s => <SignalRow key={s.id} signal={s} />)}
    </div>
  )
}
