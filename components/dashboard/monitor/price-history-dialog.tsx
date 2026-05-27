'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TimeRangeSelector } from './time-range-selector'
import type { TimeRangeKey } from '@/lib/price-monitor/constants'
import { getPaginatedPriceHistory } from '@/lib/actions/monitor.actions'
import type { PaginatedPriceHistoryResult } from '@/lib/actions/monitor.actions'
import { useTimezone } from '@/lib/hooks/use-timezone'
import { History, ChevronLeft, ChevronRight, ArrowDown, ArrowUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatPrice(value: number, currency: string): string {
  if (currency === 'VES') {
    return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(value)
  }
  return `$${value.toFixed(2)}`
}

type Props = {
  platform: string
  asset: string
  baseCurrency: string
}

type SortField = 'recordedAt' | 'priceMin' | 'priceMax' | 'priceMid'
type SortOrder = 'asc' | 'desc'

export function PriceHistoryDialog({ platform, asset, baseCurrency }: Props) {
  const [open, setOpen] = useState(false)
  const [rangeKey, setRangeKey] = useState<TimeRangeKey | 'all'>('24h')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortField>('recordedAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [data, setData] = useState<PaginatedPriceHistoryResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const { tz, formatTimeShort } = useTimezone()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, rangeKey, page, sortBy, sortOrder])

  function loadData() {
    startTransition(async () => {
      const result = await getPaginatedPriceHistory(
        platform,
        asset,
        rangeKey,
        page,
        20, // pageSize
        sortBy,
        sortOrder
      )
      setData(result)
    })
  }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(1) // Reset to first page on sort
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return null
    return sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 inline" /> : <ArrowDown className="w-3 h-3 ml-1 inline" />
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="h-7 text-xs flex items-center gap-1">
            <History className="w-3 h-3" />
            <span className="hidden sm:inline">Ver Histórico</span>
          </Button>
        }
      />
      <DialogContent className="max-w-[95vw] md:max-w-[90vw] lg:max-w-[85vw] xl:max-w-7xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            Histórico de Precios: {asset} en {platform}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 pb-4 border-b">
          <div className="flex items-center gap-2 overflow-x-auto w-full pb-1 sm:pb-0">
            <TimeRangeSelector 
              value={rangeKey as TimeRangeKey} 
              onChange={(v) => { setRangeKey(v); setPage(1); }} 
            />
            <Button 
              variant={rangeKey === 'all' ? 'default' : 'outline'} 
              size="sm" 
              className={cn('h-7 px-2.5 text-xs', rangeKey === 'all' && 'shadow-sm')}
              onClick={() => { setRangeKey('all'); setPage(1); }}
            >
              Todo
            </Button>
          </div>
          {isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="flex-1 overflow-auto min-h-[300px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('recordedAt')}>
                  Fecha y Hora <SortIcon field="recordedAt" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => handleSort('priceMin')}>
                  Mínimo <SortIcon field="priceMin" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => handleSort('priceMid')}>
                  Medio <SortIcon field="priceMid" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => handleSort('priceMax')}>
                  Máximo <SortIcon field="priceMax" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No se encontraron registros para el período seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                data?.data.map((record) => {
                  const date = new Date(record.time)
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {mounted 
                          ? date.toLocaleDateString('es-VE', { 
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit', second: '2-digit',
                              timeZone: tz
                            }) 
                          : record.time}
                      </TableCell>
                      <TableCell className="text-right text-red-400 font-medium">
                        {formatPrice(record.priceMin, baseCurrency)}
                      </TableCell>
                      <TableCell className="text-right text-brand-primary font-medium">
                        {formatPrice(record.priceMid, baseCurrency)}
                      </TableCell>
                      <TableCell className="text-right text-green-500 font-medium">
                        {formatPrice(record.priceMax, baseCurrency)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between pt-4 border-t mt-auto">
          <div className="text-xs text-muted-foreground">
            Total: {data?.total ?? 0} registros
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground">
              Página {page} de {Math.max(1, data?.totalPages ?? 1)}
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="w-8 h-8"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || isPending}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="w-8 h-8"
                onClick={() => setPage(p => Math.min(data?.totalPages ?? 1, p + 1))}
                disabled={!data || page >= data.totalPages || isPending}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
