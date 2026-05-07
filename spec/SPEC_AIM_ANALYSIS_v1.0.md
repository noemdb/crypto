# SPEC_AIM_ANALYSIS v1.0

**Módulo: Análisis Inteligente de Oportunidades con LLM**
**Sistema padre:** Arbitrage Intelligence Monitor (AIM)
**Clasificación:** Feature Spec — Production Grade
**Versión:** 1.0.0
**Fecha:** 2026-05-06
**Estado:** Listo para ejecución por agente IA

---

## 0. Control de Cambios

| Versión | Fecha      | Cambio                                                                     |
| ------- | ---------- | -------------------------------------------------------------------------- |
| 1.0.0   | 2026-05-06 | Spec inicial — análisis LLM de últimas 50 oportunidades via NVIDIA NIM API |

---

## 1. Resumen del Feature

Nueva página `/dashboard/analysis` que permite al operador generar un análisis en lenguaje natural de las **últimas 50 oportunidades evaluadas por el motor de arbitraje**, usando un LLM de NVIDIA NIM.

El análisis es **efímero** — no se persiste en base de datos. Se genera on-demand al presionar un botón, se muestra en pantalla en formato Markdown, y desaparece al navegar fuera de la página. El estado reside exclusivamente en React (`useState`).

---

## 2. Contexto del Proyecto

**Stack existente relevante:**

- Next.js 15.5.15 · App Router · TypeScript strict · Tailwind 4 · shadcn/ui
- `lib/proxy.ts` — todas las llamadas HTTP externas pasan por este módulo
- `lib/db/queries/opportunities.ts` — `getOpportunities()` ya existe
- `lib/auth-helpers.ts` — `requireAuth()` para RSC layouts
- Patrón de protección: `requireAuth()` en layout RSC, sin `middleware.ts`
- `lib/schemas/opportunity.schema.ts` — `OpportunityOutput` tipado con Zod

**Archivos a crear (todos nuevos, sin modificar existentes salvo sidebar):**

```
app/(dashboard)/dashboard/analysis/page.tsx
lib/nvidia.ts
lib/actions/analysis.actions.ts
components/dashboard/analysis/kpi-cards.tsx
components/dashboard/analysis/analysis-panel.tsx
components/dashboard/analysis/generate-button.tsx
```

**Archivo a modificar:**

```
components/dashboard/sidebar.tsx  ← añadir link de navegación
```

---

## 3. Diseño Funcional

### 3.1 Layout de la página

```
┌─────────────────────────────────────────────────────┐
│  Análisis Inteligente                               │
│  Últimas N oportunidades evaluadas                  │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Ejecutables  │  │  ROI Máx     │  │  Inválidas│ │
│  │     3        │  │   2.14%      │  │    47     │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
├─────────────────────────────────────────────────────┤
│  Considerando: [50 ▼]    [Generar análisis →]       │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐  │
│  │  [Estado: idle / generando... / resultado]    │  │
│  │                                               │  │
│  │  Markdown renderizado aquí                    │  │
│  │  - Resumen ejecutivo                          │  │
│  │  - Patrones detectados                        │  │
│  │  - Oportunidades destacadas                   │  │
│  │  - Recomendaciones                            │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 3.2 KPIs mostrados (calculados en el servidor, no por el LLM)

Los 3 indicadores son deterministas, calculados a partir de los datos crudos antes de llamar al LLM:

| KPI                           | Cálculo                                       | Ejemplo |
| ----------------------------- | --------------------------------------------- | ------- |
| **Oportunidades Ejecutables** | `count where classification === 'EXECUTABLE'` | 3       |
| **ROI Ajustado Máximo**       | `max(roiAdjusted)` de todas las oportunidades | 2.14%   |
| **Tasa de Invalidez**         | `count(INVALID) / total * 100`                | 94%     |

### 3.3 Selector de cantidad

El operador puede ajustar cuántas oportunidades considera el análisis: `10 | 25 | 50` (default: 50). El cambio re-calcula los KPIs en cliente y resetea el análisis previo.

### 3.4 Flujo de generación

```
[Usuario presiona "Generar análisis"]
        │
        ▼
[Client Component llama a Server Action: generateAnalysis(count)]
        │
        ▼
[Server Action: leer últimas N oportunidades de DB]
        │
        ▼
[Server Action: serializar a texto estructurado para el prompt]
        │
        ▼
[lib/nvidia.ts: POST a NVIDIA NIM API con streaming]
        │
        ▼
[Server Action retorna string completo]
        │
        ▼
[Client Component: renderizar Markdown con estado local]
```

**El análisis NO usa streaming en la UI** — la Server Action espera la respuesta completa y la retorna como string. Más simple, sin complejidad de ReadableStream en Server Actions. El botón muestra un spinner durante la espera.

---

## 4. Contrato de la NVIDIA NIM API

**Endpoint:** `https://integrate.api.nvidia.com/v1/chat/completions`
**Modelo:** `meta/llama-3.3-70b-instruct` (razonamiento sólido, salida en español fluido)
**Autenticación:** `Authorization: Bearer nvapi-...`
**Método:** POST JSON

**Request body:**

```typescript
{
  model: "meta/llama-3.3-70b-instruct",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: dataPayload }
  ],
  temperature: 0.3,       // baja temperatura — análisis factual, no creativo
  top_p: 0.9,
  max_tokens: 700,        // ~500 palabras de output + buffer de tokens internos
  stream: false           // respuesta completa, sin streaming
}
```

**Response relevante:**

```typescript
response.choices[0].message.content; // string con el análisis en Markdown
```

---

## 5. Prompt Engineering

### 5.1 System Prompt

**Filosofía:** Sin diplomacia, sin adornos, sin frases de relleno. El operador quiere saber exactamente qué está pasando y qué hacer. Si los datos son malos, decirlo sin suavizar. Si no hay oportunidades, decirlo sin rodeos.

```
Eres un trader profesional analizando datos de arbitraje cripto. Hablas directo, sin adornos.

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
Una oración. Ejecutables: N. ROI máximo: X%. Veredicto de mercado.

## Por qué fallan
Las razones concretas con números. Qué ruta falla, cuánto le falta para ser rentable y por qué.

## Lo mejor disponible
Si hay EXECUTABLE o MARGINAL: ruta, ROI exacto, fill prob, capital requerido, ventana estimada.
Si solo hay INVALID: cuál es la menos mala y cuánto le falta para cruzar el umbral.

## Acción inmediata
Una sola recomendación operativa. Sin condicionales, sin "podría", sin "tal vez".
```

### 5.2 Data Payload (user message)

```typescript
function buildDataPayload(
  opportunities: OpportunityOutput[],
  count: number,
): string {
  const stats = {
    total: opportunities.length,
    executable: opportunities.filter((o) => o.classification === "EXECUTABLE")
      .length,
    marginal: opportunities.filter((o) => o.classification === "MARGINAL")
      .length,
    invalid: opportunities.filter((o) => o.classification === "INVALID").length,
    maxROI: Math.max(...opportunities.map((o) => o.roiAdjusted)).toFixed(4),
    minROI: Math.min(...opportunities.map((o) => o.roiAdjusted)).toFixed(4),
    avgROI: (
      opportunities.reduce((s, o) => s + o.roiAdjusted, 0) /
      opportunities.length
    ).toFixed(4),
    topRoutes: getTopRoutes(opportunities), // top 3 rutas por frecuencia
    timeRange: getTimeRange(opportunities), // "hace Xmin → hace Ymin"
  };

  const executableDetails = opportunities
    .filter(
      (o) =>
        o.classification === "EXECUTABLE" || o.classification === "MARGINAL",
    )
    .slice(0, 5) // máximo 5 para no inflar el prompt
    .map(
      (o) =>
        `  - ${o.route} | ROI: ${o.roiAdjusted.toFixed(3)}% | Fill: ${(o.fillProbability * 100).toFixed(0)}%`,
    )
    .join("\n");

  return `
ANÁLISIS DE ${count} OPORTUNIDADES RECIENTES
=============================================
Período: ${stats.timeRange}

ESTADÍSTICAS GENERALES:
- Total evaluadas: ${stats.total}
- Ejecutables: ${stats.executable}
- Marginales: ${stats.marginal}  
- Inválidas: ${stats.invalid} (${((stats.invalid / stats.total) * 100).toFixed(1)}%)

ROI AJUSTADO:
- Máximo: ${stats.maxROI}%
- Mínimo: ${stats.minROI}%
- Promedio: ${stats.avgROI}%

RUTAS MÁS FRECUENTES:
${stats.topRoutes.map((r) => `  - ${r.route}: ${r.count} veces`).join("\n")}

OPORTUNIDADES NO-INVÁLIDAS (hasta 5):
${executableDetails || "  (ninguna)"}
`.trim();
}
```

---

## 6. Especificación de Archivos

### 6.1 `lib/nvidia.ts`

```typescript
// lib/nvidia.ts
// Módulo de integración con NVIDIA NIM API.
// Usa proxy.ts internamente — no llama a fetch() directamente.

import { proxyRequest } from "@/lib/proxy";

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";

const SYSTEM_PROMPT = `Eres un analista experto en arbitraje de criptomonedas. 
Recibes datos estructurados de oportunidades evaluadas por un motor de arbitraje 
entre exchanges (Binance, Bybit y plataformas P2P).

Tu tarea es generar un análisis conciso en español, en formato Markdown, 
de NO MÁS DE 500 PALABRAS.

El análisis debe cubrir exactamente estas 4 secciones:
1. **Resumen ejecutivo** — estado general del mercado en 2-3 oraciones
2. **Patrones detectados** — qué rutas, activos o plataformas dominan; por qué la mayoría son inválidas
3. **Oportunidades destacadas** — si hay EXECUTABLE o MARGINAL, describirlas con sus números clave
4. **Recomendación operativa** — qué debería hacer el operador ahora mismo

Usa solo los datos provistos. No inventes cifras. Si no hay oportunidades ejecutables, dilo claramente.
Sé directo, técnico y útil. Evita introducción y conclusión genéricas.`;

type NvidiaMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type NvidiaResponse = {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type NvidiaAnalysisResult =
  | { ok: true; content: string; tokensUsed: number }
  | { ok: false; error: string };

export async function generateArbitrageAnalysis(
  dataPayload: string,
): Promise<NvidiaAnalysisResult> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "NVIDIA_API_KEY no configurada en variables de entorno",
    };
  }

  const messages: NvidiaMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: dataPayload },
  ];

  const result = await proxyRequest<NvidiaResponse>({
    url: NVIDIA_API_URL,
    method: "POST",
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
    timeoutMs: 30_000, // LLMs pueden tardar — timeout generoso
    retries: 1, // un solo retry en caso de error transitorio
    context: "nvidia_nim_analysis",
  });

  if (!result.ok) {
    return { ok: false, error: `Error llamando NVIDIA API: ${result.error}` };
  }

  const content = result.data.choices[0]?.message?.content;
  if (!content) {
    return { ok: false, error: "NVIDIA API retornó respuesta vacía" };
  }

  return {
    ok: true,
    content,
    tokensUsed: result.data.usage?.total_tokens ?? 0,
  };
}
```

### 6.2 `lib/actions/analysis.actions.ts`

```typescript
// lib/actions/analysis.actions.ts
"use server";

import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { getOpportunities } from "@/lib/db/queries/opportunities";
import { generateArbitrageAnalysis } from "@/lib/nvidia";
import type { OpportunityOutput } from "@/lib/schemas";

// ── Helpers de serialización ──────────────────────────────────────────────

function getTopRoutes(opps: OpportunityOutput[]) {
  const counts: Record<string, number> = {};
  for (const o of opps) {
    counts[o.route] = (counts[o.route] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([route, count]) => ({ route, count }));
}

function getTimeRange(opps: OpportunityOutput[]): string {
  if (opps.length === 0) return "sin datos";
  const times = opps.map((o) => new Date(o.evaluatedAt).getTime());
  const newest = Math.min(...times);
  const oldest = Math.max(...times);
  const newestMin = Math.round((Date.now() - newest) / 60_000);
  const oldestMin = Math.round((Date.now() - oldest) / 60_000);
  return `hace ${newestMin}min → hace ${oldestMin}min`;
}

function buildDataPayload(opps: OpportunityOutput[], count: number): string {
  const total = opps.length;
  const executable = opps.filter(
    (o) => o.classification === "EXECUTABLE",
  ).length;
  const marginal = opps.filter((o) => o.classification === "MARGINAL").length;
  const invalid = opps.filter((o) => o.classification === "INVALID").length;

  const rois = opps.map((o) => o.roiAdjusted);
  const maxROI = Math.max(...rois).toFixed(4);
  const minROI = Math.min(...rois).toFixed(4);
  const avgROI = (rois.reduce((s, r) => s + r, 0) / total).toFixed(4);

  const topRoutes = getTopRoutes(opps);
  const timeRange = getTimeRange(opps);

  const nonInvalidDetails = opps
    .filter((o) => o.classification !== "INVALID")
    .slice(0, 5)
    .map(
      (o) =>
        `  - [${o.classification}] ${o.asset}: ${o.route} | ROI: ${o.roiAdjusted.toFixed(3)}% | Fill: ${(o.fillProbability * 100).toFixed(0)}% | Compra: $${o.buyPrice.toFixed(4)} | Venta: $${o.sellPrice.toFixed(4)}`,
    )
    .join("\n");

  return `
ANÁLISIS DE ${count} OPORTUNIDADES RECIENTES
=============================================
Período: ${timeRange}

ESTADÍSTICAS GENERALES:
- Total evaluadas: ${total}
- Ejecutables: ${executable}
- Marginales: ${marginal}
- Inválidas: ${invalid} (${total > 0 ? ((invalid / total) * 100).toFixed(1) : 0}%)

ROI AJUSTADO:
- Máximo: ${maxROI}%
- Mínimo: ${minROI}%
- Promedio: ${avgROI}%

RUTAS MÁS FRECUENTES:
${topRoutes.map((r) => `  - ${r.route}: ${r.count} veces`).join("\n")}

OPORTUNIDADES NO-INVÁLIDAS (hasta 5):
${nonInvalidDetails || "  (ninguna en este período)"}
`.trim();
}

// ── Tipos de resultado ────────────────────────────────────────────────────

export type AnalysisResult =
  | {
      ok: true;
      content: string;
      tokensUsed: number;
      opportunitiesAnalyzed: number;
    }
  | { ok: false; error: string };

export type AnalysisKPIs = {
  executable: number;
  maxROI: number;
  invalidRate: number;
  total: number;
};

// ── Server Actions ────────────────────────────────────────────────────────

/**
 * Calcula los KPIs de las últimas N oportunidades sin llamar al LLM.
 * Se usa para actualizar los indicadores cuando el operador cambia el selector.
 */
export async function getAnalysisKPIs(count: number): Promise<AnalysisKPIs> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { executable: 0, maxROI: 0, invalidRate: 0, total: 0 };

  const rows = await getOpportunities({ limit: count });

  const total = rows.length;
  if (total === 0)
    return { executable: 0, maxROI: 0, invalidRate: 0, total: 0 };

  const executable = rows.filter(
    (r) => r.classification === "EXECUTABLE",
  ).length;
  const invalid = rows.filter((r) => r.classification === "INVALID").length;
  const maxROI = Math.max(...rows.map((r) => r.roiAdjusted));

  return {
    executable,
    maxROI,
    invalidRate: (invalid / total) * 100,
    total,
  };
}

/**
 * Genera el análisis LLM de las últimas N oportunidades.
 * Retorna string Markdown o error. No persiste nada.
 */
export async function generateAnalysis(count: number): Promise<AnalysisResult> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { ok: false, error: "No autenticado" };

  // Validar rango permitido
  const safeCount = Math.min(Math.max(count, 10), 50);

  // Leer oportunidades de DB
  const rows = await getOpportunities({ limit: safeCount });

  if (rows.length === 0) {
    return {
      ok: false,
      error: "No hay oportunidades registradas. Ejecuta un scan primero.",
    };
  }

  // Normalizar a OpportunityOutput (rows viene de Prisma con tipos Date)
  const opportunities: OpportunityOutput[] = rows.map((r) => ({
    id: r.id,
    route: r.route,
    buyPlatform: r.buyPlatform,
    sellPlatform: r.sellPlatform,
    asset: r.asset,
    buyPrice: r.buyPrice,
    sellPrice: r.sellPrice,
    capitalAmount: r.capitalAmount,
    roiGross: r.roiGross,
    feesImpact: r.feesImpact,
    slippageImpact: r.slippageImpact,
    networkImpact: r.networkImpact,
    roiAdjusted: r.roiAdjusted,
    fillProbability: r.fillProbability,
    liquidityRatio: r.liquidityRatio,
    latencyRiskMs: r.latencyRiskMs,
    classification: r.classification as OpportunityOutput["classification"],
    rejectionReasons: r.rejectionReasons,
    evaluatedAt: r.evaluatedAt.toISOString(),
    snapshotAge: {
      buyMs: r.snapshotAgeBuyMs,
      sellMs: r.snapshotAgeSellMs,
    },
  }));

  // Construir payload de datos para el prompt
  const dataPayload = buildDataPayload(opportunities, safeCount);

  // Llamar al LLM
  const llmResult = await generateArbitrageAnalysis(dataPayload);

  if (!llmResult.ok) {
    return { ok: false, error: llmResult.error };
  }

  return {
    ok: true,
    content: llmResult.content,
    tokensUsed: llmResult.tokensUsed,
    opportunitiesAnalyzed: rows.length,
  };
}
```

### 6.3 `components/dashboard/analysis/kpi-cards.tsx`

```tsx
// components/dashboard/analysis/kpi-cards.tsx
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Zap, XCircle } from "lucide-react";
import type { AnalysisKPIs } from "@/lib/actions/analysis.actions";

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="shrink-0 p-2 rounded-lg bg-muted">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {label}
          </p>
          <p className={`text-2xl font-bold mt-0.5 ${valueClass ?? ""}`}>
            {value}
          </p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function KPICards({ kpis }: { kpis: AnalysisKPIs }) {
  const roiColor =
    kpis.maxROI > 0 ? "text-green-500" : kpis.maxROI < 0 ? "text-red-500" : "";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KPICard
        label="Ejecutables"
        value={kpis.executable.toString()}
        sub={`de ${kpis.total} evaluadas`}
        icon={Zap}
        valueClass={kpis.executable > 0 ? "text-green-500" : ""}
      />
      <KPICard
        label="ROI Máximo"
        value={`${kpis.maxROI.toFixed(3)}%`}
        sub="ROI ajustado más alto"
        icon={TrendingUp}
        valueClass={roiColor}
      />
      <KPICard
        label="Tasa de Invalidez"
        value={`${kpis.invalidRate.toFixed(1)}%`}
        sub="oportunidades inválidas"
        icon={XCircle}
        valueClass={kpis.invalidRate > 90 ? "text-red-400" : "text-yellow-400"}
      />
    </div>
  );
}
```

### 6.4 `components/dashboard/analysis/generate-button.tsx`

```tsx
// components/dashboard/analysis/generate-button.tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import {
  generateAnalysis,
  getAnalysisKPIs,
} from "@/lib/actions/analysis.actions";
import type { AnalysisKPIs } from "@/lib/actions/analysis.actions";

type Props = {
  initialCount: number;
  onResult: (content: string) => void;
  onError: (error: string) => void;
  onKPIsChange: (kpis: AnalysisKPIs) => void;
  onLoading: (loading: boolean) => void;
};

export function GenerateButton({
  initialCount,
  onResult,
  onError,
  onKPIsChange,
  onLoading,
}: Props) {
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  function handleCountChange(value: string) {
    const newCount = parseInt(value);
    setCount(newCount);
    // Actualizar KPIs inmediatamente al cambiar el selector
    startTransition(async () => {
      const kpis = await getAnalysisKPIs(newCount);
      onKPIsChange(kpis);
    });
  }

  function handleGenerate() {
    onLoading(true);
    startTransition(async () => {
      const result = await generateAnalysis(count);
      if (result.ok) {
        onResult(result.content);
      } else {
        onError(result.error);
      }
      onLoading(false);
    });
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Considerando:</span>
        <Select
          value={count.toString()}
          onValueChange={handleCountChange}
          disabled={isPending}
        >
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

      <Button onClick={handleGenerate} disabled={isPending} className="gap-2">
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
  );
}
```

### 6.5 `components/dashboard/analysis/analysis-panel.tsx`

```tsx
// components/dashboard/analysis/analysis-panel.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateButton } from "./generate-button";
import { KPICards } from "./kpi-cards";
import { Sparkles, AlertCircle, FileText } from "lucide-react";
import type { AnalysisKPIs } from "@/lib/actions/analysis.actions";

// Renderizador Markdown liviano — convierte a HTML básico sin dependencias externas
function renderMarkdown(md: string): string {
  return md
    .replace(
      /^#### (.+)$/gm,
      '<h4 class="font-semibold text-sm mt-4 mb-1">$1</h4>',
    )
    .replace(
      /^### (.+)$/gm,
      '<h3 class="font-semibold text-base mt-5 mb-2">$1</h3>',
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 class="font-bold text-lg mt-6 mb-2 border-b pb-1">$1</h2>',
    )
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-xl mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /`(.+?)`/g,
      '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>',
    )
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(
      /^(\d+)\. (.+)$/gm,
      '<li class="ml-4 list-decimal text-sm">$2</li>',
    )
    .replace(/\n\n/g, '</p><p class="mb-3 text-sm leading-relaxed">')
    .replace(
      /^(?!<[h|l|p])(.+)$/gm,
      '<p class="mb-3 text-sm leading-relaxed">$1</p>',
    );
}

type Props = {
  initialKPIs: AnalysisKPIs;
};

export function AnalysisPanel({ initialKPIs }: Props) {
  const [kpis, setKPIs] = useState<AnalysisKPIs>(initialKPIs);
  const [analysisContent, setAnalysisContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleResult(content: string) {
    setAnalysisContent(content);
    setError(null);
  }

  function handleError(err: string) {
    setError(err);
    setAnalysisContent(null);
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <KPICards kpis={kpis} />

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <GenerateButton
          initialCount={50}
          onResult={handleResult}
          onError={handleError}
          onKPIsChange={setKPIs}
          onLoading={setIsLoading}
        />
        {analysisContent && (
          <p className="text-xs text-muted-foreground">
            El análisis es temporal — no se guarda.
          </p>
        )}
      </div>

      {/* Result Panel */}
      <Card className="min-h-[200px]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Análisis Generado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Idle state */}
          {!isLoading && !analysisContent && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <Sparkles className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Presiona <strong>Generar análisis</strong> para obtener
                <br />
                una interpretación inteligente de los datos.
              </p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="relative">
                <Sparkles className="w-8 h-8 text-brand-primary animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground">
                Analizando oportunidades con IA...
              </p>
              <p className="text-xs text-muted-foreground/60">
                Esto puede tomar 5–15 segundos
              </p>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Analysis result */}
          {analysisContent && !isLoading && (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(analysisContent),
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 6.6 `app/(dashboard)/dashboard/analysis/page.tsx`

```tsx
// app/(dashboard)/dashboard/analysis/page.tsx
import { requireAuth } from "@/lib/auth-helpers";
import { getAnalysisKPIs } from "@/lib/actions/analysis.actions";
import { AnalysisPanel } from "@/components/dashboard/analysis/analysis-panel";
import { Brain } from "lucide-react";

// Sin cache — siempre leer datos frescos de DB
export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  await requireAuth();

  // Calcular KPIs iniciales en servidor (con las últimas 50 oportunidades)
  const initialKPIs = await getAnalysisKPIs(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6 text-brand-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Análisis Inteligente</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Interpretación LLM de las últimas oportunidades evaluadas por el
            motor
          </p>
        </div>
      </div>

      <AnalysisPanel initialKPIs={initialKPIs} />
    </div>
  );
}
```

### 6.7 Modificación `components/dashboard/sidebar.tsx`

Añadir el link de navegación a la sidebar existente. **Localizar el array `NAV_ITEMS` y añadir una entrada:**

```typescript
// Añadir al array NAV_ITEMS en components/dashboard/sidebar.tsx
// ANTES (existente):
const NAV_ITEMS = [
  { href: "/dashboard", label: "Monitor", icon: Activity },
  { href: "/dashboard/opportunities", label: "Historial", icon: BarChart3 },
  { href: "/dashboard/config", label: "Configuración", icon: Settings },
];

// DESPUÉS (añadir el item de Análisis):
import { Brain } from "lucide-react"; // añadir al import existente de lucide-react

const NAV_ITEMS = [
  { href: "/dashboard", label: "Monitor", icon: Activity },
  { href: "/dashboard/opportunities", label: "Historial", icon: BarChart3 },
  { href: "/dashboard/analysis", label: "Análisis IA", icon: Brain },
  { href: "/dashboard/config", label: "Configuración", icon: Settings },
];
```

---

## 7. Variable de Entorno Requerida

```bash
# ── NVIDIA NIM API ─────────────────────────────────────────────────────────
NVIDIA_API_KEY="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"
```

Añadir a `.env.local` y a `.env.local.example` (en el example, el valor debe ser vacío `""`).

---

## 8. Acceptance Criteria

### AC-A01: KPIs calculados sin LLM

**Dado** que hay oportunidades en DB,
**Cuando** se carga `/dashboard/analysis`,
**Entonces** los 3 KPIs (Ejecutables, ROI Máximo, Tasa de Invalidez) se muestran correctamente calculados desde DB, sin llamar al LLM.
**Verificación:** Inspección visual + typecheck.

### AC-A02: Generación exitosa

**Dado** `NVIDIA_API_KEY` configurada y oportunidades en DB,
**Cuando** el operador presiona "Generar análisis",
**Entonces** en < 30 segundos se muestra un texto Markdown con las 4 secciones requeridas (Resumen ejecutivo, Patrones detectados, Oportunidades destacadas, Recomendación operativa).
**Verificación:** Test manual. E2E con mock de NVIDIA API.

### AC-A03: Estado efímero

**Dado** un análisis generado visible en pantalla,
**Cuando** el operador navega a otra página y vuelve,
**Entonces** el análisis no está visible — la página muestra el estado idle.
**Verificación:** Test manual de navegación.

### AC-A04: Manejo de error de API

**Dado** que `NVIDIA_API_KEY` es inválida o la API no responde,
**Cuando** el operador presiona "Generar análisis",
**Entonces** se muestra un mensaje de error claro sin romper la UI.
**Verificación:** Probar con API key inválida.

### AC-A05: Cambio de selector actualiza KPIs

**Dado** el selector en 50,
**Cuando** el operador cambia a 10,
**Entonces** los 3 KPIs se recalculan instantáneamente con solo las 10 oportunidades más recientes, y cualquier análisis previo desaparece.
**Verificación:** Test manual.

### AC-A06: Sin escritura en DB

**Dado** que se genera un análisis,
**Cuando** se inspecciona la base de datos (Neon console),
**Entonces** no hay tablas ni registros nuevos relacionados al análisis.
**Verificación:** `SELECT * FROM information_schema.tables` antes y después.

### AC-A07: Protección de ruta

**Dado** un usuario no autenticado,
**Cuando** accede a `/dashboard/analysis`,
**Entonces** es redirigido a `/login`.
**Verificación:** Navegación sin sesión activa.

---

## 9. Plan de Ejecución por Fases

---

### FASE A-1 — Infraestructura de integración NVIDIA

**Objetivo:** Crear `lib/nvidia.ts` y verificar la conexión con la API antes de construir la UI.

**Tareas:**

**TA1.1 — Añadir `NVIDIA_API_KEY` a `.env.local`**

```bash
NVIDIA_API_KEY="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"
```

**TA1.2 — Crear `lib/nvidia.ts`**
Implementar exactamente el código de la sección 6.1. Puntos críticos:

- Importar `proxyRequest` desde `@/lib/proxy` — no usar `fetch()` directamente
- `timeoutMs: 30_000` — los LLMs pueden tardar
- `stream: false` — respuesta completa, no streaming
- Retornar `NvidiaAnalysisResult` con discriminante `ok`

**TA1.3 — Verificar conexión con script de prueba**

Crear `scripts/test-nvidia.ts` (borrar después):

```typescript
// scripts/test-nvidia.ts — verificación one-shot, borrar después de confirmar
import "dotenv/config";
import { generateArbitrageAnalysis } from "../lib/nvidia";

const result = await generateArbitrageAnalysis(
  "ANÁLISIS DE PRUEBA\n==================\nTotal: 5\nEjecutables: 1\nInválidas: 4\nROI Máximo: 1.5%",
);

if (result.ok) {
  console.log("✅ NVIDIA API OK");
  console.log("Tokens usados:", result.tokensUsed);
  console.log("Preview:", result.content.slice(0, 200));
} else {
  console.error("❌ Error:", result.error);
}
```

```bash
npx tsx scripts/test-nvidia.ts
```

**Verificación de salida FA-1:**

- [ ] `npx tsx scripts/test-nvidia.ts` → `✅ NVIDIA API OK` + preview de texto en español
- [ ] `npm run typecheck` → 0 errores
- [ ] `lib/nvidia.ts` no importa `fetch` directamente

**HANDOFF FA-1:**

```
FASE_COMPLETADA: A-1
NVIDIA_CLIENT: lib/nvidia.ts — generateArbitrageAnalysis() verificado con API real
API_URL: https://integrate.api.nvidia.com/v1/chat/completions
MODELO: meta/llama-3.3-70b-instruct
ENV_VAR: NVIDIA_API_KEY configurada en .env.local
SIGUIENTE: FA-2 — Server Action y lógica de datos
```

---

### FASE A-2 — Server Action y lógica de datos

**Objetivo:** Crear `lib/actions/analysis.actions.ts` con las dos Server Actions: `getAnalysisKPIs` y `generateAnalysis`.

**Tareas:**

**TA2.1 — Verificar que `getOpportunities` acepta `limit: 50`**

En `lib/db/queries/opportunities.ts`, confirmar que la función existente acepta el parámetro `limit`. Si no lo acepta, añadirlo:

```typescript
// Verificar firma actual — debe aceptar { limit?: number }
export async function getOpportunities(opts: {
  classification?: string;
  limit?: number;
  cursor?: string;
  since?: Date;
});
```

**TA2.2 — Crear `lib/actions/analysis.actions.ts`**
Implementar exactamente el código de la sección 6.2. Puntos críticos:

- `getAuthenticatedUserId()` al inicio de ambas actions — sin sesión, retornar datos vacíos o error
- `buildDataPayload()` produce texto estructurado, no JSON — más fácil de procesar para el LLM
- `safeCount = Math.min(Math.max(count, 10), 50)` — validar rango en servidor
- La normalización de rows Prisma → `OpportunityOutput` es necesaria porque `evaluatedAt` viene como `Date` de Prisma

**TA2.3 — Test manual de la Server Action**

En la consola del navegador (o con un script tsx), verificar:

```typescript
// Verificar que getAnalysisKPIs retorna valores coherentes con los datos en DB
const kpis = await getAnalysisKPIs(50);
console.log(kpis); // { executable: N, maxROI: X, invalidRate: Y, total: Z }
```

**Verificación de salida FA-2:**

- [ ] `getAnalysisKPIs(50)` retorna objeto con 4 campos numéricos
- [ ] `generateAnalysis(50)` retorna `{ ok: true, content: string }` con texto Markdown
- [ ] `generateAnalysis(50)` con `NVIDIA_API_KEY` inválida retorna `{ ok: false, error: string }`
- [ ] `npm run typecheck` → 0 errores

**HANDOFF FA-2:**

```
FASE_COMPLETADA: A-2
SERVER_ACTIONS: lib/actions/analysis.actions.ts
  - getAnalysisKPIs(count) → AnalysisKPIs
  - generateAnalysis(count) → AnalysisResult
DATA_FLOW: getOpportunities(limit) → buildDataPayload() → generateArbitrageAnalysis() → string
SIGUIENTE: FA-3 — Componentes UI
```

---

### FASE A-3 — Componentes UI

**Objetivo:** Crear los 3 componentes cliente y la página RSC.

**Tareas:**

**TA3.1 — Crear directorio de componentes**

```bash
mkdir -p components/dashboard/analysis
```

**TA3.2 — Crear `components/dashboard/analysis/kpi-cards.tsx`**
Implementar exactamente el código de la sección 6.3.

Notas:

- Importar `Card`, `CardContent` desde `@/components/ui/card`
- Importar `TrendingUp`, `Zap`, `XCircle` desde `lucide-react`
- El color de `ROI Máximo` es verde si > 0, rojo si < 0, neutro si = 0
- El color de `Tasa de Invalidez` es rojo si > 90%, amarillo si > 60%

**TA3.3 — Crear `components/dashboard/analysis/generate-button.tsx`**
Implementar exactamente el código de la sección 6.4.

Notas:

- Usar `useTransition` de React — integración nativa con Server Actions
- `onLoading(true)` antes del `startTransition`, `onLoading(false)` al final
- El selector llama a `getAnalysisKPIs` sin llegar a llamar al LLM — es barato

**TA3.4 — Instalar `react-markdown` o confirmar renderizado inline**

El componente `AnalysisPanel` usa un renderizador inline (`renderMarkdown`). Si se prefiere una solución más robusta, instalar:

```bash
npm install react-markdown
```

Y reemplazar en `analysis-panel.tsx`:

```tsx
import ReactMarkdown from "react-markdown";
// ...
// Reemplazar dangerouslySetInnerHTML por:
<ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert text-sm">
  {analysisContent}
</ReactMarkdown>;
```

**Decisión:** Si el proyecto ya tiene `react-markdown` en dependencias, usarlo. Si no, el renderizador inline de la sección 6.5 es suficiente para el formato que produce el LLM.

**TA3.5 — Crear `components/dashboard/analysis/analysis-panel.tsx`**
Implementar exactamente el código de la sección 6.5.

Notas:

- Es un Client Component — contiene todo el estado (`useState`) de la feature
- `initialKPIs` viene del RSC padre vía props
- Los 4 estados de la UI: idle, loading, error, result — todos manejados con `useState`
- El `dangerouslySetInnerHTML` es aceptable aquí porque el contenido viene del LLM bajo control del operador, no de input de usuario externo

**TA3.6 — Crear `app/(dashboard)/dashboard/analysis/page.tsx`**
Implementar exactamente el código de la sección 6.6.

Notas:

- `export const dynamic = 'force-dynamic'` — no cachear, siempre leer DB fresca
- `await requireAuth()` — protección de ruta
- `getAnalysisKPIs(50)` en servidor — los KPIs iniciales llegan hidratados al cliente

**TA3.7 — Actualizar `components/dashboard/sidebar.tsx`**
Añadir el link de `Análisis IA` con `Brain` icon exactamente como especifica la sección 6.7.

**Verificación de salida FA-3:**

- [ ] `GET /dashboard/analysis` con sesión → página carga con 3 KPI cards
- [ ] `GET /dashboard/analysis` sin sesión → redirect a `/login`
- [ ] Sidebar muestra "Análisis IA" entre Historial y Configuración
- [ ] Botón "Generar análisis" está presente y clickeable
- [ ] Selector muestra opciones 10/25/50
- [ ] `npm run typecheck` → 0 errores
- [ ] `npm run build` → build exitoso

**HANDOFF FA-3:**

```
FASE_COMPLETADA: A-3
PAGE: app/(dashboard)/dashboard/analysis/page.tsx
COMPONENTS:
  - components/dashboard/analysis/kpi-cards.tsx
  - components/dashboard/analysis/generate-button.tsx
  - components/dashboard/analysis/analysis-panel.tsx
SIDEBAR: actualizado con link "Análisis IA"
SIGUIENTE: FA-4 — Verificación end-to-end y ACs
```

---

### FASE A-4 — Verificación End-to-End

**Objetivo:** Verificar todos los AC del feature en condiciones reales.

**Tareas:**

**TA4.1 — Verificar AC-A01: KPIs sin LLM**

1. Navegar a `/dashboard/analysis`
2. Verificar que los 3 KPIs muestran valores — sin haber presionado "Generar análisis"
3. Los valores deben coincidir con los que muestra el Monitor principal

**TA4.2 — Verificar AC-A02: Generación exitosa**

1. Presionar "Generar análisis" con el selector en 50
2. Verificar spinner "Analizando..." durante la espera
3. Verificar que el resultado contiene las 4 secciones en Markdown
4. Verificar que el texto está en español y menciona cifras concretas

**TA4.3 — Verificar AC-A03: Estado efímero**

1. Generar un análisis
2. Navegar a `/dashboard/monitor`
3. Volver a `/dashboard/analysis`
4. Verificar que la página muestra el estado idle (sin análisis)

**TA4.4 — Verificar AC-A04: Error de API**

1. Temporalmente cambiar `NVIDIA_API_KEY` a un valor inválido en `.env.local`
2. Reiniciar `npm run dev`
3. Presionar "Generar análisis"
4. Verificar mensaje de error con ícono rojo y texto descriptivo
5. Restaurar la API key correcta

**TA4.5 — Verificar AC-A05: Cambio de selector**

1. Cambiar selector de 50 a 10
2. Verificar que los KPIs cambian inmediatamente
3. Si había un análisis previo, verificar que desapareció

**TA4.6 — Verificar AC-A06: Sin escritura en DB**

```bash
# En Neon console o con prisma studio
npx prisma studio
# Verificar que no hay tablas nuevas relacionadas a análisis
```

**TA4.7 — Verificar AC-A07: Protección de ruta**

1. Cerrar sesión (`/login`)
2. Intentar navegar directamente a `/dashboard/analysis`
3. Verificar redirect a `/login`

**TA4.8 — Typecheck y build final**

```bash
npm run typecheck  # 0 errores
npm run build      # build exitoso
npm test           # tests existentes siguen pasando
```

**Verificación de salida FA-4 (gate final):**

- [ ] AC-A01 ✅ KPIs visibles sin LLM
- [ ] AC-A02 ✅ Análisis generado con 4 secciones en < 30s
- [ ] AC-A03 ✅ Estado efímero confirmado
- [ ] AC-A04 ✅ Error manejado graciosamente
- [ ] AC-A05 ✅ Selector actualiza KPIs
- [ ] AC-A06 ✅ Sin escritura en DB
- [ ] AC-A07 ✅ Ruta protegida
- [ ] `npm run typecheck` → 0 errores
- [ ] `npm run build` → build exitoso
- [ ] `npm test` → tests previos siguen passing

**HANDOFF FINAL:**

```
FEATURE_COMPLETADO: Análisis Inteligente con NVIDIA NIM
RUTA: /dashboard/analysis
ARCHIVOS_NUEVOS:
  - lib/nvidia.ts
  - lib/actions/analysis.actions.ts
  - components/dashboard/analysis/kpi-cards.tsx
  - components/dashboard/analysis/generate-button.tsx
  - components/dashboard/analysis/analysis-panel.tsx
  - app/(dashboard)/dashboard/analysis/page.tsx
ARCHIVOS_MODIFICADOS:
  - components/dashboard/sidebar.tsx (añadido link "Análisis IA")
  - .env.local (añadida NVIDIA_API_KEY)
  - .env.local.example (añadida NVIDIA_API_KEY vacía)
ENV_VAR_NUEVA: NVIDIA_API_KEY
NO_DB_CHANGES: true — ninguna migration, ninguna tabla nueva
NO_SCHEMA_CHANGES: true
ESTADO: Production-ready
```

---

## 10. Decisiones de Diseño Registradas

**DD-01: Sin streaming en UI**
Se optó por respuesta completa (no streaming) porque las Server Actions no soportan nativamente ReadableStream de vuelta al cliente sin complejidad adicional. El tiempo de espera típico de 5–15 segundos es aceptable para un análisis bajo demanda.

**DD-02: Renderizador Markdown inline**
Se evitó instalar `react-markdown` para no añadir dependencia. El renderizador inline es suficiente para el formato de 4 secciones que produce el LLM. Si el formato se vuelve más complejo en futuras versiones, migrar a `react-markdown`.

**DD-03: Estado en React, no Zustand**
El análisis es por naturaleza efímero y local a la página. No tiene sentido sincronizarlo en el store global de Zustand. `useState` en `AnalysisPanel` es la solución correcta.

**DD-04: KPIs calculados en servidor (RSC)**
Los KPIs iniciales se calculan en el RSC para que lleguen al cliente ya hidratados, sin un loading state adicional. El `getAnalysisKPIs` del Server Action se usa solo para actualizaciones subsiguientes (cambio de selector).

**DD-05: proxy.ts para llamada a NVIDIA**
Consistente con el patrón del proyecto — todas las llamadas HTTP externas pasan por `lib/proxy.ts`. Esto garantiza logging uniforme, timeout configurable, y retry automático.

---

_Fin de SPEC_AIM_ANALYSIS v1.0.0_
_Feature: Análisis Inteligente | Sistema: AIM | Fases: A-1 → A-4_
