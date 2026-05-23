import { requireAuth } from '@/lib/auth-helpers'
import { getIntelligenceDashboard } from '@/lib/actions/intelligence.actions'
import { IntelligencePanel } from '@/components/dashboard/intelligence/intelligence-panel'
import { Radar } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function InteligenciaPage() {
  await requireAuth()

  const data = await getIntelligenceDashboard()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Radar className="w-6 h-6 text-brand-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Inteligencia Cambiaria</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Contexto BCV · Ventanas bancarias · Señales del mercado venezolano
          </p>
        </div>
      </div>

      {data ? (
        <IntelligencePanel
          context={data.context}
          bcvHistory={data.bcvHistory}
          bankingWindows={data.bankingWindows}
        />
      ) : (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Error cargando datos. Verifica la autenticación.
        </div>
      )}
    </div>
  )
}
