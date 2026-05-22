'use client'

import { useState } from 'react'
import { PlatformSelector } from './platform-selector'
import { PriceStatsCard } from './price-stats-card'
import { PriceChart } from './price-chart'
import type { MonitorSummary, PriceChartData } from '@/lib/actions/monitor.actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  summary: MonitorSummary[]
  initialChartData: PriceChartData | null
  initialPlatform: string
  initialAsset: string
}

export function MonitorPanel({
  summary,
  initialChartData,
  initialPlatform,
  initialAsset,
}: Props) {
  const [platform, setPlatform] = useState(initialPlatform)

  // Obtener plataformas únicas del resumen
  const availablePlatforms = Array.from(new Set(summary.map(s => s.platform)))

  // Filtrar summary por la plataforma seleccionada
  const activeStats = summary.filter(s => s.platform === platform)

  return (
    <div className="space-y-6">
      {/* 1. Selector de Plataforma Principal */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium">Plataforma</h2>
        <PlatformSelector
          platforms={availablePlatforms}
          selected={platform}
          onSelect={setPlatform}
        />
      </div>

      {/* 2. Tarjetas de Resumen (Mínimo / Máximo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {activeStats.map((stat) => (
          <PriceStatsCard key={stat.asset} summary={stat} />
        ))}
        {activeStats.length === 0 && (
          <div className="col-span-full p-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
            No hay datos recientes para esta plataforma.
          </div>
        )}
      </div>

      {/* 3. Gráfico Histórico (Mostramos el asset inicial u el primero disponible) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Histórico de Precio</span>
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              {initialAsset}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PriceChart
            initialData={initialChartData}
            platform={platform}
            asset={initialAsset}
          />
        </CardContent>
      </Card>
    </div>
  )
}
