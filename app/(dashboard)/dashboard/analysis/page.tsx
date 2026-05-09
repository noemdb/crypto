// app/(dashboard)/dashboard/analysis/page.tsx
import { requireAuth } from '@/lib/auth-helpers'
import { getUserConfig } from '@/lib/db/queries/user-config'
import { getAnalysisKPIs } from '@/lib/actions/analysis.actions'
import { AnalysisPanel } from '@/components/dashboard/analysis/analysis-panel'
import { Brain } from 'lucide-react'

// Sin cache — siempre leer datos frescos de DB
export const dynamic = 'force-dynamic'

export default async function AnalysisPage() {
  const session = await requireAuth()
  const config = await getUserConfig(session.user.id)
  const limit = config?.opportunitiesLimit ?? 50
  
  // Calcular KPIs iniciales en servidor (con las últimas oportunidades según config)
  const initialKPIs = await getAnalysisKPIs(limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6 text-brand-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Análisis Inteligente</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Interpretación LLM de las últimas oportunidades evaluadas por el motor
          </p>
        </div>
      </div>

      <AnalysisPanel initialKPIs={initialKPIs} />
    </div>
  )
}
