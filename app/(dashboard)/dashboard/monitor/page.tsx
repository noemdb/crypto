import { requireAuth } from '@/lib/auth-helpers'
import { getMonitorSummary, getPriceChartData } from '@/lib/actions/monitor.actions'
import { getOrCreateDefaultUserConfig } from '@/lib/db/queries/user-config'
import { MonitorPanel } from '@/components/dashboard/monitor/monitor-panel'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Settings2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MonitorPage() {
  const session = await requireAuth()

  // 1. Obtener config para saber qué monitorear por defecto
  const config = await getOrCreateDefaultUserConfig(session.user.id)

  const defaultPlatform = config.monitorPlatforms[0] ?? 'binance_p2p_ves'
  const defaultAsset = config.monitorAssets[0] ?? 'USDT'

  // 2. Cargar resumen y datos iniciales del gráfico
  const [summary, initialChartData] = await Promise.all([
    getMonitorSummary(),
    getPriceChartData(defaultPlatform, defaultAsset, '24h'),
  ])

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Monitor P2P</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visualización en tiempo real e histórico de precios.
          </p>
        </div>
        <Link href="/dashboard/config">
          <Button variant="outline" size="sm" className="gap-2">
            <Settings2 className="w-4 h-4" />
            Umbrales de Alerta
          </Button>
        </Link>
      </div>

      {/* Contenido Principal */}
      {!config.monitorEnabled ? (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
          <h3 className="font-medium text-lg">Monitor Desactivado</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            El monitor de precios está inactivo en tu configuración. Los precios no se están registrando y las alertas están pausadas.
          </p>
          <Link href="/dashboard/config" className="mt-4 inline-block">
            <Button variant="default">Activar en Configuración</Button>
          </Link>
        </div>
      ) : (
        <MonitorPanel
          summary={summary}
          initialChartData={initialChartData}
          initialPlatform={defaultPlatform}
          initialAsset={defaultAsset}
        />
      )}
    </div>
  )
}
