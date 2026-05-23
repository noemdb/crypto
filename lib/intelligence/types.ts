// lib/intelligence/types.ts
// Tipos y constantes del módulo de Inteligencia Cambiaria Venezuela.

export const SignalType = {
  BCV_RATE_UPDATE:     'bcv_rate_update',
  BCV_RATE_SPIKE:      'bcv_rate_spike',       // cambio > threshold
  BANK_WINDOW_OPEN:    'bank_window_open',
  BANK_DIGITAL_ACTIVE: 'bank_digital_active',
  BANK_AUCTION:        'bank_auction',
  NEWS_INTERVENTION:   'news_intervention',
  NEWS_LIQUIDITY:      'news_liquidity',
  P2P_PREMIUM_HIGH:    'p2p_premium_high',     // P2P muy sobre BCV
  P2P_PREMIUM_LOW:     'p2p_premium_low',      // P2P cerca de BCV
} as const

export type SignalTypeValue = typeof SignalType[keyof typeof SignalType]

// Pesos por capa de fuente
export const SOURCE_WEIGHTS: Record<string, number> = {
  official: 1.00,
  banking:  0.85,
  news:     0.60,
  p2p:      0.75,
}

// TTL en minutos por tipo de señal
export const SIGNAL_TTL_MINUTES: Record<SignalTypeValue, number> = {
  bcv_rate_update:     1440,  // 24h
  bcv_rate_spike:      240,   // 4h
  bank_window_open:    120,   // 2h
  bank_digital_active: 120,   // 2h
  bank_auction:        180,   // 3h
  news_intervention:   360,   // 6h
  news_liquidity:      240,   // 4h
  p2p_premium_high:    30,    // 30min — P2P es volátil
  p2p_premium_low:     30,
}

export type BCVRateData = {
  rateUsd: number
  rateEur: number | null
  date: string
  changePct: number | null
  publishedAt: string
}

export type IntelSignalData = {
  id: string
  source: string
  sourceLayer: string
  signalType: SignalTypeValue
  summary: string
  confidence: number
  weight: number
  score: number
  metadata: Record<string, unknown> | null
  detectedAt: string
  expiresAt: string | null
  confirmedBy: string[]
}

export type OpportunityContext = {
  bcvRate: number | null
  p2pMid: number | null
  premiumPct: number | null            // (p2p - bcv) / bcv * 100
  activeSignals: IntelSignalData[]
  opportunityScore: number             // 0.0 – 1.0
  riskScore: number
  netScore: number
  explanation: string
}
