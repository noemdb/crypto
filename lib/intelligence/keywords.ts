// lib/intelligence/keywords.ts
// Keywords para detección de ventanas cambiarias en sitios bancarios venezolanos.

export const BANKING_KEYWORDS = {
  HIGH_SIGNAL: [
    'intervención digital',
    'intervencion digital',
    'subasta privada',
    'ordenes de divisas',
    'órdenes de divisas',
  ],
  MEDIUM_SIGNAL: [
    'menudeo',
    'venta de divisas',
    'jornada cambiaria',
    'operaciones cambiarias',
    'mesa de cambio',
    'divisas disponibles',
  ],
  INFORMATIONAL: [
    'compra y venta de divisas',
    'disponible esta semana',
    'tipo de cambio oficial',
  ],
} as const
