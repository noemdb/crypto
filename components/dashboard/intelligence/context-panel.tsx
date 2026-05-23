import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OpportunityContext } from '@/lib/intelligence/types'

function ScoreGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct  = Math.round(value * 100)
  const bar  = '█'.repeat(Math.round(value * 20))
  const empty = '░'.repeat(20 - Math.round(value * 20))

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-bold ${color}`}>{pct}%</span>
      </div>
      <p className={`font-mono text-xs ${color}`}>{bar}{empty}</p>
    </div>
  )
}

export function ContextPanel({ context }: { context: OpportunityContext }) {
  const netColor =
    context.netScore > 0.3 ? 'text-green-500' :
    context.netScore > 0   ? 'text-yellow-500' : 'text-red-400'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Contexto de Mercado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScoreGauge value={context.opportunityScore} label="Oportunidad" color="text-green-500" />
        <ScoreGauge value={context.riskScore}        label="Riesgo"      color="text-red-400"   />

        <div className="border-t pt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground font-medium">Score Neto</span>
            <span className={`text-lg font-bold ${netColor}`}>
              {context.netScore > 0 ? '+' : ''}{(context.netScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {context.explanation && (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2 leading-relaxed">
            {context.explanation}
          </p>
        )}

        {context.activeSignals.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {context.activeSignals.length} señal(es) activa(s)
          </p>
        )}
      </CardContent>
    </Card>
  )
}
