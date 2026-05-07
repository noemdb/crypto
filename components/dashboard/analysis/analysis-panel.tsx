// components/dashboard/analysis/analysis-panel.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GenerateButton } from './generate-button'
import { KPICards } from './kpi-cards'
import { Sparkles, AlertCircle, FileText } from 'lucide-react'
import type { AnalysisKPIs } from '@/lib/actions/analysis.actions'

// Renderizador Markdown liviano — convierte a HTML básico sin dependencias externas
function renderMarkdown(md: string): string {
  return md
    .replace(/^#### (.+)$/gm, '<h4 class="font-semibold text-sm mt-4 mb-1">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold text-base mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-lg mt-6 mb-2 border-b pb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-xl mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$2</li>')
    .replace(/\n\n/g, '</p><p class="mb-3 text-sm leading-relaxed">')
    .replace(/^(?!<[h|l|p])(.+)$/gm, '<p class="mb-3 text-sm leading-relaxed">$1</p>')
}

type Props = {
  initialKPIs: AnalysisKPIs
}

export function AnalysisPanel({ initialKPIs }: Props) {
  const [kpis, setKPIs] = useState<AnalysisKPIs>(initialKPIs)
  const [analysisContent, setAnalysisContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function handleResult(content: string) {
    setAnalysisContent(content)
    setError(null)
  }

  function handleError(err: string) {
    setError(err)
    setAnalysisContent(null)
  }

  function handleKPIsChange(newKpis: AnalysisKPIs) {
    setKPIs(newKpis)
    setAnalysisContent(null) // Reset analysis when count changes
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <KPICards kpis={kpis} />

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <GenerateButton
          initialCount={50}
          onResult={handleResult}
          onError={handleError}
          onKPIsChange={handleKPIsChange}
          onLoading={setIsLoading}
        />
        {analysisContent && (
          <p className="text-xs text-muted-foreground">
            El análisis es temporal — no se guarda.
          </p>
        )}
      </div>

      {/* Result Panel */}
      <Card className="min-h-[200px]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Análisis Generado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Idle state */}
          {!isLoading && !analysisContent && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <Sparkles className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Presiona <strong>Generar análisis</strong> para obtener
                <br />
                una interpretación inteligente de los datos.
              </p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="relative">
                <Sparkles className="w-8 h-8 text-brand-primary animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground">
                Analizando oportunidades con IA...
              </p>
              <p className="text-xs text-muted-foreground/60">
                Esto puede tomar 5–15 segundos
              </p>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Analysis result */}
          {analysisContent && !isLoading && (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(analysisContent) }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
