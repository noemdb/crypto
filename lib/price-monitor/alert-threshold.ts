/**
 * Funciones de comparación de umbrales para el Monitor de Precio P2P.
 * Determina cuándo guardar un nuevo registro y cuándo enviar alerta Telegram.
 */

/** Retorna true si el cambio absoluto entre current y previous supera el threshold */
export function exceedsThreshold(
  current: number,
  previous: number,
  thresholdPct: number,
): boolean {
  if (previous === 0) return true
  const changePct = Math.abs((current - previous) / previous) * 100
  return changePct >= thresholdPct
}

/** Calcula el % de cambio (con signo) de previous a current */
export function calculateChangePct(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

/**
 * Decide si se debe guardar un nuevo PriceRecord.
 * Retorna true si el priceMin O el priceMax cambiaron más del threshold.
 */
export function shouldRecord(
  newMin: number,
  newMax: number,
  lastMin: number,
  lastMax: number,
  thresholdPct: number,
): boolean {
  return (
    exceedsThreshold(newMin, lastMin, thresholdPct) ||
    exceedsThreshold(newMax, lastMax, thresholdPct)
  )
}
