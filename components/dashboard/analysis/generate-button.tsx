// components/dashboard/analysis/generate-button.tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sparkles, Loader2 } from 'lucide-react'
import { generateAnalysis, getAnalysisKPIs } from '@/lib/actions/analysis.actions'
import type { AnalysisKPIs } from '@/lib/actions/analysis.actions'

type Props = {
  initialCount: number
  onResult: (content: string) => void
  onError: (error: string) => void
  onKPIsChange: (kpis: AnalysisKPIs) => void
  onLoading: (loading: boolean) => void
}

export function GenerateButton({
  initialCount,
  onResult,
  onError,
  onKPIsChange,
  onLoading,
}: Props) {
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()

  function handleCountChange(value: string | null) {
    if (!value) return
    const newCount = parseInt(value)
    setCount(newCount)
    // Actualizar KPIs inmediatamente al cambiar el selector
    startTransition(async () => {
      const kpis = await getAnalysisKPIs(newCount)
      onKPIsChange(kpis)
    })
  }

  function handleGenerate() {
    onLoading(true)
    startTransition(async () => {
      const result = await generateAnalysis(count)
      if (result.ok) {
        onResult(result.content)
      } else {
        onError(result.error)
      }
      onLoading(false)
    })
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Considerando:</span>
        <Select value={count.toString()} onValueChange={handleCountChange} disabled={isPending}>
          <SelectTrigger className="w-24 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">oportunidades</span>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={isPending}
        className="gap-2"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analizando...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generar análisis
          </>
        )}
      </Button>
    </div>
  )
}
