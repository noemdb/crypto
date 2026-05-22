export const TIME_RANGES = {
  '24h': { label: '24 horas', hours: 24 },
  '3d':  { label: '3 días',   hours: 72 },
  '7d':  { label: '7 días',   hours: 168 },
  '1m':  { label: '1 mes',    hours: 720 },
  '3m':  { label: '3 meses',  hours: 2160 },
} as const

export type TimeRangeKey = keyof typeof TIME_RANGES
