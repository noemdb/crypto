// components/dashboard/analysis/kpi-cards.tsx
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, Zap, XCircle } from 'lucide-react'
import type { AnalysisKPIs } from '@/lib/actions/analysis.actions'

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  valueClass,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  valueClass?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="shrink-0 p-2 rounded-lg bg-muted">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {label}
          </p>
          <p className={`text-2xl font-bold mt-0.5 ${valueClass ?? ''}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export function KPICards({ kpis }: { kpis: AnalysisKPIs }) {
  const roiColor =
    kpis.maxROI > 0 ? 'text-green-500' : kpis.maxROI < 0 ? 'text-red-500' : ''

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KPICard
        label="Ejecutables"
        value={kpis.executable.toString()}
        sub={`de ${kpis.total} evaluadas`}
        icon={Zap}
        valueClass={kpis.executable > 0 ? 'text-green-500' : ''}
      />
      <KPICard
        label="ROI Máximo"
        value={`${kpis.maxROI.toFixed(3)}%`}
        sub="ROI ajustado más alto"
        icon={TrendingUp}
        valueClass={roiColor}
      />
      <KPICard
        label="Tasa de Invalidez"
        value={`${kpis.invalidRate.toFixed(1)}%`}
        sub="oportunidades inválidas"
        icon={XCircle}
        valueClass={kpis.invalidRate > 90 ? 'text-red-400' : 'text-yellow-400'}
      />
    </div>
  )
}
