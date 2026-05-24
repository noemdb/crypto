// lib/hooks/use-timezone.ts
// Hook utilitario para formatear fechas respetando la zona horaria del usuario.
// Lee `displayTimezone` del dashboard store y expone helpers de formateo.

'use client'

import { useDashboardStore } from '@/lib/store/dashboard.store'

function resolveTimezone(displayTimezone: string): string {
  return displayTimezone === 'local'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : displayTimezone
}

export function useTimezone() {
  const displayTimezone = useDashboardStore((s) => s.displayTimezone)
  const tz = resolveTimezone(displayTimezone)

  /** "8:47:23 PM" */
  function formatTime(date: string | Date | number): string {
    const d = new Date(date)
    return d.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: tz,
    })
  }

  /** "8:47 PM" — sin segundos, ideal para ejes de gráficas */
  function formatTimeShort(date: string | Date | number): string {
    const d = new Date(date)
    return d.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    })
  }

  /** "23/05/2026, 8:47:23 PM" */
  function formatDateTime(date: string | Date | number): string {
    const d = new Date(date)
    return d.toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: tz,
    })
  }

  /** Hace cuántos minutos fue */
  function ageMinutes(date: string | Date | number): number {
    return Math.round((Date.now() - new Date(date).getTime()) / 60_000)
  }

  return { tz, formatTime, formatTimeShort, formatDateTime, ageMinutes }
}
