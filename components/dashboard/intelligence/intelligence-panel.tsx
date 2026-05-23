'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BCVRateCard } from './bcv-rate-card'
import { SignalFeed } from './signal-feed'
import { ContextPanel } from './context-panel'
import { SpreadCorrelationChart } from './spread-correlation-chart'
import { getSignalHistory } from '@/lib/actions/intelligence.actions'
import { RefreshCw } from 'lucide-react'
import type { OpportunityContext, BCVRateData, IntelSignalData } from '@/lib/intelligence/types'

type BankingWindowData = {
  bank: string
  windowType: string
  isActive: boolean
  detectedAt: string
  keywords: string[]
}

type Props = {
  context: OpportunityContext
  bcvHistory: BCVRateData[]
  bankingWindows: BankingWindowData[]
}

export function IntelligencePanel({ context, bcvHistory, bankingWindows }: Props) {
  const [signals, setSignals] = useState<IntelSignalData[]>(context.activeSignals)
  const [isPending, startTransition] = useTransition()

  const latestBCV = bcvHistory[bcvHistory.length - 1]
  const prevBCV   = bcvHistory[bcvHistory.length - 2]
  const changePct = latestBCV && prevBCV
    ? ((latestBCV.rateUsd - prevBCV.rateUsd) / prevBCV.rateUsd) * 100
    : null

  function handleRefresh() {
    startTransition(async () => {
      const fresh = await getSignalHistory(48)
      setSignals(fresh.map(s => ({
        id: s.id,
        source: s.source,
        sourceLayer: s.sourceLayer,
        signalType: s.signalType as IntelSignalData['signalType'],
        summary: s.summary,
        confidence: s.confidence,
        weight: s.weight,
        score: s.score,
        metadata: s.metadata as Record<string, unknown> | null,
        detectedAt: s.detectedAt.toISOString(),
        expiresAt: s.expiresAt?.toISOString() ?? null,
        confirmedBy: s.confirmedBy,
      })))
    })
  }

  return (
    <div className="space-y-6">
      {/* Tasas + Premium */}
      <BCVRateCard
        bcvRate={context.bcvRate}
        p2pMid={context.p2pMid}
        premiumPct={context.premiumPct}
        changePct={changePct}
      />

      {/* Context Score + Signal Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ContextPanel context={context} />

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Feed de Señales</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isPending}
                  className="h-7 px-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <SignalFeed signals={signals} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Ventanas bancarias activas */}
      {bankingWindows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">✅ Ventanas Bancarias Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bankingWindows.map((w, i) => (
                <div key={i} className="rounded-lg border bg-green-500/5 border-green-500/20 p-3">
                  <p className="font-semibold text-sm text-green-400 capitalize">{w.bank}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{w.windowType}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {w.keywords.slice(0, 2).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico histórico BCV */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Historial Tasa BCV — últimos 30 días
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SpreadCorrelationChart history={bcvHistory} />
        </CardContent>
      </Card>
    </div>
  )
}
