'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Terminal, Loader2, Play, Filter } from 'lucide-react'
import { useTimezone } from '@/lib/hooks/use-timezone'

type LogEntry = {
  timestamp: string;
  level: string;
  message: string;
}

export function LogViewerDialog() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [filterSignals, setFilterSignals] = useState(false)
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { formatTime } = useTimezone()

  useEffect(() => {
    if (!open) return
    let timeout: NodeJS.Timeout
    async function poll() {
      await fetchLogs(false)
      timeout = setTimeout(poll, 1500)
    }
    poll()
    return () => clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  async function fetchLogs(showLoader = true) {
    if (showLoader) setLoading(true)
    try {
      const res = await fetch('/api/scan-worker/scan/logs')
      if (!res.ok) throw new Error('Failed to fetch logs')
      const data = await res.json()
      if (data.logs) {
        setLogs(data.logs)
      }
    } catch (err) {
      console.error(err)
      if (showLoader) {
        setLogs([{ timestamp: new Date().toISOString(), level: 'error', message: 'No se pudo conectar al Worker. Verifica que esté corriendo (npm run worker).' }])
      }
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  async function handleScan() {
    setIsScanning(true)
    try {
      await fetch('/api/scan-worker/scan/manual', { method: 'POST' })
    } catch (err) {
      console.error(err)
    } finally {
      setIsScanning(false)
    }
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen)
    if (newOpen) fetchLogs(true)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="h-7 gap-2 px-3 text-xs border-primary/20 hover:bg-primary/10" />
        }
      >
        <Terminal className="w-3.5 h-3.5 text-primary" />
        Ver Logs
      </DialogTrigger>
      <DialogContent className="sm:max-w-[90vw] md:max-w-4xl lg:max-w-5xl w-full border-primary/20">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-6">
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Terminal del Worker de Inteligencia
              {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-2" />}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={filterSignals ? "default" : "outline"}
                onClick={() => setFilterSignals(!filterSignals)}
                className="h-7 gap-2 text-xs"
              >
                <Filter className="w-3.5 h-3.5" />
                Solo Señales
              </Button>
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={handleScan}
                disabled={isScanning}
                className="h-7 gap-2 text-xs"
              >
                {isScanning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                Forzar Escaneo
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div 
          ref={scrollRef}
          className="bg-[#0c0c0e] border border-border/50 text-gray-300 font-mono text-[11px] sm:text-xs p-4 rounded-md h-[70vh] overflow-y-auto whitespace-pre-wrap flex flex-col shadow-inner scroll-smooth"
        >
          {logs.length === 0 && !loading ? (
            <span className="text-muted-foreground">Esperando logs... (asegúrate de que el worker esté corriendo)</span>
          ) : (
            logs
              .filter(log => !filterSignals || /bcv|banking|intel|scanner|engine/i.test(log.message))
              .map((log, i) => (
              <div key={i} className="mb-1 leading-relaxed">
                <span className="text-muted-foreground">[{formatTime(log.timestamp)}]</span>{' '}
                <span className={
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warn' ? 'text-yellow-400' : 
                  log.message.includes('OK') || log.message.includes('exitoso') ? 'text-green-400' : 'text-blue-300'
                }>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
