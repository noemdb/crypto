// lib/nvidia.ts
// Módulo de integración con NVIDIA NIM API.
// Usa proxy.ts internamente — no llama a fetch() directamente.

import { proxyRequest } from '@/lib/proxy'

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const NVIDIA_MODEL = 'meta/llama-3.3-70b-instruct'

const SYSTEM_PROMPT = `Eres un trader profesional analizando datos de arbitraje cripto. Hablas directo, sin adornos.

REGLAS ABSOLUTAS:
- Responde SOLO en español
- Formato Markdown estricto, máximo 500 palabras
- Cero frases de relleno ("cabe destacar", "es importante mencionar", "en conclusión")
- Cero introducción genérica — empieza con el dato más importante
- Si no hay oportunidades ejecutables: dilo en la primera línea, punto
- Usa los números exactos de los datos — no redondees ni suavices
- Si el mercado está ineficiente para arbitraje ahora mismo, dilo con esas palabras

ESTRUCTURA (sin títulos alternativos, exactamente estos):
## Estado actual
## Por qué fallan
## Lo mejor disponible
## Acción inmediata`

type NvidiaMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type NvidiaResponse = {
  choices: Array<{
    message: {
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export type NvidiaAnalysisResult =
  | { ok: true; content: string; tokensUsed: number }
  | { ok: false; error: string }

export async function generateArbitrageAnalysis(
  dataPayload: string,
): Promise<NvidiaAnalysisResult> {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'NVIDIA_API_KEY no configurada en variables de entorno' }
  }

  const messages: NvidiaMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: dataPayload },
  ]

  const result = await proxyRequest<NvidiaResponse>({
    url: NVIDIA_API_URL,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: {
      model: NVIDIA_MODEL,
      messages,
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 700,
      stream: false,
    },
    timeoutMs: 30_000,   // LLMs pueden tardar — timeout generoso
    retries: 1,          // un solo retry en caso de error transitorio
    context: 'nvidia_nim_analysis',
  })

  if (!result.ok) {
    return { ok: false, error: `Error llamando NVIDIA API: ${result.error}` }
  }

  const content = result.data.choices[0]?.message?.content
  if (!content) {
    return { ok: false, error: 'NVIDIA API retornó respuesta vacía' }
  }

  return {
    ok: true,
    content,
    tokensUsed: result.data.usage?.total_tokens ?? 0,
  }
}
