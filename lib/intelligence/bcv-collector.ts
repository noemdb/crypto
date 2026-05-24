// lib/intelligence/bcv-collector.ts
// Colecta la tasa BCV oficial usando API pública + fallback scraping.
// NUNCA llama fetch() directamente — usa proxyRequest desde lib/proxy.ts

import { proxyRequest } from '@/lib/proxy'
import { prisma } from '@/lib/db/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { BCVRateData } from './types'

const execAsync = promisify(exec)

const BCV_API_URL = 'https://bcv-api.rafnixg.dev/rates/'
const BCV_FALLBACK_URL = 'https://www.bcv.org.ve'

type BcvApiResponse = {
  usd: string | number
  eur?: string | number
  date?: string
}

export async function collectBCVRate(): Promise<BCVRateData | null> {
  // Estrategia 1: API pública (más estable)
  const apiResult = await proxyRequest<BcvApiResponse>({
    url: BCV_API_URL,
    context: 'bcv_rate_api',
    timeoutMs: 8000,
    retries: 2,
  })

  if (apiResult.ok) {
    const data = apiResult.data
    const rateUsd = parseFloat(String(data.usd))
    const rateEur = data.eur ? parseFloat(String(data.eur)) : null
    const date = data.date ?? new Date().toISOString().slice(0, 10)

    if (!isNaN(rateUsd) && rateUsd > 0) {
      return { rateUsd, rateEur, date, changePct: null, publishedAt: new Date().toISOString() }
    }
  }

  console.warn('[bcv-collector] API falló, intentando scraping directo')

  // Estrategia 2: Scraping directo del BCV (fallback)
  const scrapeResult = await proxyRequest<string>({
    url: BCV_FALLBACK_URL,
    context: 'bcv_rate_scrape',
    timeoutMs: 12000,
    retries: 1,
    responseType: 'text',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    }
  })

  if (scrapeResult.ok) {
    const data = parseBCVHtml(scrapeResult.data)
    if (data) return data
  }

  console.warn('[bcv-collector] Fetch falló, intentando cURL nativo (Estrategia 3)')

  // Estrategia 3: cURL nativo (Evita problemas de TLS de Node.js con BCV)
  try {
    const { stdout } = await execAsync(
      `curl -k -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" ${BCV_FALLBACK_URL}`,
      { timeout: 15000 }
    )
    if (stdout) {
      const data = parseBCVHtml(stdout)
      if (data) {
        console.info('[bcv-collector] cURL nativo exitoso')
        return data
      }
    }
  } catch (err) {
    console.error('[bcv-collector] cURL nativo falló:', err instanceof Error ? err.message : err)
  }

  console.error('[bcv-collector] Todas las estrategias fallaron')
  return null
}

function parseBCVHtml(html: string): BCVRateData | null {
  // El BCV publica la tasa en un elemento específico del HTML
  const patterns = [
    /id="dolar"[^>]*>[\s\S]*?<strong[^>]*>\s*([\d,]+(?:\.\d+)?)\s*<\/strong>/i,
    /<strong[^>]*>\s*([\d,]+(?:\.\d+)?)\s*<\/strong>/i,
    /Tipo de Cambio[^<]*<[^>]+>\s*([\d,]+)/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      const raw = match[1].replace('.', '').replace(',', '.')
      const rate = parseFloat(raw)
      if (!isNaN(rate) && rate > 0) {
        return {
          rateUsd: rate,
          rateEur: null,
          date: new Date().toISOString().slice(0, 10),
          changePct: null,
          publishedAt: new Date().toISOString(),
        }
      }
    }
  }

  console.error('[bcv-collector] No se pudo parsear la tasa del HTML del BCV')
  return null
}

export async function persistBCVRate(data: BCVRateData): Promise<{
  saved: boolean
  changed: boolean
  changePct: number | null
}> {
  // Buscar tasa del día anterior para calcular changePct
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const prevRate = await prisma.bCVRate.findFirst({
    where: { date: yesterdayStr },
    select: { rateUsd: true },
  })

  const changePct = prevRate
    ? ((data.rateUsd - prevRate.rateUsd) / prevRate.rateUsd) * 100
    : null

  // Upsert por fecha — un registro por día
  const existing = await prisma.bCVRate.findUnique({ where: { date: data.date } })

  if (existing && Math.abs(existing.rateUsd - data.rateUsd) < 0.0001) {
    // Sin cambio — no actualizar
    return { saved: false, changed: false, changePct }
  }

  await prisma.bCVRate.upsert({
    where: { date: data.date },
    update: {
      rateUsd: data.rateUsd,
      rateEur: data.rateEur,
      changePct,
      collectedAt: new Date(),
    },
    create: {
      rateUsd: data.rateUsd,
      rateEur: data.rateEur,
      date: data.date,
      changePct,
      publishedAt: new Date(data.publishedAt),
      sourceUrl: BCV_API_URL,
    },
  })

  return { saved: true, changed: true, changePct }
}
