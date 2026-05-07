// app/(dashboard)/dashboard/analysis/page.tsx
import { requireAuth } from '@/lib/auth-helpers'
import { getAnalysisKPIs } from '@/lib/actions/analysis.actions'
import { AnalysisPanel } from '@/components/dashboard/analysis/analysis-panel'
import { Brain } from 'lucide-react'

// Sin cache — siempre leer datos frescos de DB
export const dynamic = 'force-dynamic'

export default async function AnalysisPage() {
  await requireAuth()

  // Calcular KPIs iniciales en servidor (con las últimas 50 oportunidades)
  const initialKPIs = await getAnalysisKPIs(50)

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
