'use client'

import { Badge } from '@/components/ui/badge'
import type { IntelSignalData } from '@/lib/intelligence/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Eye, ExternalLink, Clock, Sparkles } from 'lucide-react'
import { useTimezone } from '@/lib/hooks/use-timezone'

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
  const { formatDateTime, ageMinutes } = useTimezone()
  const ageMin = ageMinutes(signal.detectedAt)
  const ageLabel = ageMin < 60 ? `hace ${ageMin}min` : `hace ${Math.round(ageMin / 60)}h`
  const filled   = Math.round(signal.score * 10)
  const scoreBar = '█'.repeat(filled) + '░'.repeat(10 - filled)

  // Identificar si esta señal representa una ventana bancaria / de intervención cambiaria
  const isBankWindow = [
    'bank_window_open',
    'bank_digital_active',
    'bank_auction',
  ].includes(signal.signalType)

  // Extraer metadatos específicos
  const metadata = signal.metadata as { keywords?: string[]; url?: string } | null
  const keywords = metadata?.keywords ?? []
  const sourceUrl = metadata?.url

  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b last:border-0">
      <div className="flex items-start gap-3 min-w-0 flex-1">
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

      {isBankWindow && (
        <div className="flex items-center self-center shrink-0">
          <Dialog>
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="h-7 w-7 text-xs border-primary/20 hover:bg-primary/10 hover:text-primary transition-all duration-200"
                  title="Ver detalles de la ventana"
                />
              }
            >
              <Eye className="w-3.5 h-3.5" />
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-primary/20 bg-background/95 backdrop-blur-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                  <span className="text-xl">{config.emoji}</span>
                  Detalle de Ventana Bancaria
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 py-4 text-sm">
                {/* Resumen principal */}
                <div className="rounded-lg bg-muted/40 border p-3">
                  <p className="font-semibold text-foreground text-sm capitalize">
                    {signal.source}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {signal.summary}
                  </p>
                </div>

                {/* Grid de Métricas */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-2.5 bg-muted/20">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Impacto</p>
                    <p className="text-sm font-semibold text-primary mt-0.5">
                      {(signal.score * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="rounded-lg border p-2.5 bg-muted/20">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Confianza</p>
                    <p className="text-sm font-semibold text-green-400 mt-0.5">
                      {(signal.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                {/* Palabras Clave */}
                {keywords.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-primary" />
                      Keywords Detectadas
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {keywords.map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary border-primary/20 capitalize">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cronología */}
                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Detección:
                    </span>
                    <span className="font-mono">{formatDateTime(signal.detectedAt)}</span>
                  </div>
                  {signal.expiresAt && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expiración:
                      </span>
                      <span className="font-mono">{formatDateTime(signal.expiresAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="sm:justify-between items-center gap-2 border-t pt-3">
                <span className="text-[10px] text-muted-foreground font-mono">
                  ID: {signal.id}
                </span>
                {sourceUrl && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90"
                    nativeButton={false}
                    render={
                      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" />
                    }
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Verificar Fuente
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
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
