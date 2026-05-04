# SPEC_ARBITRAGE_MONITOR v1.1
**Sistema de Inteligencia Operativa para Arbitraje Financiero**
**Clasificación:** Distinguished Engineer — Production Grade
**Autor:** Arquitectura generada · Revisión pendiente
**Versión:** 1.1.0-rc1
**Fecha:** 2026-05-02
**Estado:** RFC abierto

---

## 0. Control de Cambios

| Versión | Fecha | Cambio | Autor |
|---|---|---|---|
| 0.1.0 | 2026-05-02 | Draft inicial — arquitectura base | — |
| 1.0.0-rc1 | 2026-05-02 | Elevación a spec completo: ADRs, Zod contracts, AC verificables | — |
| 1.1.0-rc1 | 2026-05-02 | Stack canónico integrado: Next.js 16.2, Prisma 7, Neon.tech, Auth.js v5, Tailwind 4, shadcn/ui, Zustand, RHF 7, Recharts, UploadThing. ADR-002/006/007/008/009 revisados o añadidos. proxy.ts documentado. Env vars actualizadas. | — |
| 1.2.0-rc1 | 2026-05-02 | ADR-006 revisado: eliminado middleware.ts, protección de rutas vía auth() por capa (RSC layout + Route Handler + Server Action). Matriz de protección por ruta añadida. helper requireAuthApi() introducido. | — |

---

## 1. Resumen Ejecutivo

Este documento especifica el diseño completo del **Arbitrage Intelligence Monitor (AIM)**, un sistema autónomo de tres capas: **ingestión de datos de mercado** → **evaluación probabilística de oportunidades** → **notificación inteligente con control de ruido**.

El sistema NO ejecuta operaciones. Es un sistema de **apoyo a la decisión** con garantías de consistencia de datos, trazabilidad auditoria completa y tolerancia explícita a incertidumbre de mercado.

### Stack Canónico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework fullstack | Next.js (App Router) | 16.2 |
| Lenguaje | TypeScript (strict mode) | 5.x |
| Proxy de API | `proxy.ts` (patrón interno) | — |
| Estilos | Tailwind CSS | 4.x |
| ORM | Prisma | 7.x |
| Base de datos | PostgreSQL · Neon.tech | serverless |
| Autenticación | Auth.js | v5 |
| Validación | Zod | 3.x |
| Componentes UI | shadcn/ui | latest |
| Estado cliente | Zustand | latest |
| Formularios | React Hook Form | 7.x |
| Email transaccional | Resend | latest |
| Gráficos / Analytics | Recharts | latest |
| Upload de archivos | UploadThing | latest |
| Hosting / CD | Vercel | production |

### Problema Central

Los sistemas de monitoreo de arbitraje típicamente fallan en producción por:

1. **Datos stale sin TTL explícito** — se evalúan precios vencidos como si fueran actuales.
2. **ROI bruto sin ajuste de slippage/liquidez** — genera falsas oportunidades ejecutables.
3. **Alertas sin deduplicación** — inundan al usuario, que termina ignorando el canal.
4. **Arquitectura de polling sin backpressure** — colapsa bajo rate limits de plataformas.

Este spec resuelve los cuatro fallos con decisiones de diseño explícitas y verificables.

---

## 2. Stakeholders y Alcance

| Rol | Responsabilidad | Contacto |
|---|---|---|
| Product Owner | Priorización de fases | — |
| Arquitecto Lead | Ownership de este documento | — |
| DevOps | Despliegue Vercel + Neon.tech | — |
| QA | Validación de acceptance criteria | — |

### Fuera de Alcance (v1.0)

- Ejecución automática de órdenes en exchanges.
- Arbitraje triangular multi-asset.
- Integración con brokers regulados.
- KYC / AML compliance.

---

## 3. Definiciones y Glosario

| Término | Definición |
|---|---|
| **Snapshot** | Lectura atómica de precio + volumen de una plataforma en un timestamp dado. |
| **Oportunidad** | Par (plataforma_compra, plataforma_venta) con ROI ajustado ≥ umbral de usuario. |
| **ROI Bruto** | `(sellPrice - buyPrice) / buyPrice * 100` — sin ajustes. |
| **ROI Ajustado** | ROI Bruto menos fees, slippage estimado, costo de red y penalización de latencia. |
| **TTL** | Time-to-live de un snapshot. Pasado el TTL el snapshot es inválido para evaluación. |
| **Fill Probability** | Probabilidad estimada de que una orden P2P se ejecute dada la liquidez del anunciante. |
| **Stale Price** | Precio cuyo timestamp supera el TTL configurado para su plataforma. |
| **EXECUTABLE** | Clasificación de oportunidad con ROI ajustado ≥ threshold AND fill_prob ≥ 0.7. |
| **MARGINAL** | ROI ajustado positivo pero fill_prob entre 0.5–0.7 OR ROI ajustado < threshold. |
| **INVALID** | Cualquier condición de rechazo: datos stale, liquidez insuficiente, ruta inconsistente. |
| **proxy.ts** | Módulo interno que centraliza todas las llamadas a APIs externas (exchanges, Resend, UploadThing), añadiendo logging, timeout, retry y normalización de errores antes de que lleguen a la aplicación. |
| **Server Action** | Función async marcada `'use server'` en Next.js 16.2 que corre en el servidor, invocada directamente desde componentes React sin crear un API Route explícito. Usada exclusivamente para mutaciones. |
| **RSC** | React Server Component — componente que renderiza en el servidor y no envía JS al cliente. Usado para lecturas del dashboard. |

---

## 4. Decisiones de Arquitectura (ADRs)

### ADR-001: Next.js 16.2 (App Router) como fullstack runtime

**Estado:** Aceptado
**Contexto:** Se evalúan Next.js App Router, Remix, y NestJS separado.
**Decisión:** Next.js 16.2 App Router con RSC para dashboard de lectura, API Routes para workers de ingestión y evaluación (invocados por cron/QStash), y Server Actions para mutaciones de configuración de usuario.
**Consecuencias:**
- (+) Deploy unificado en Vercel sin infraestructura separada para MVP.
- (+) RSC elimina round-trips innecesarios en el dashboard de lectura — los datos se resuelven en el servidor, el cliente recibe HTML hidratado.
- (+) Server Actions eliminan boilerplate de API Routes para formularios de configuración (React Hook Form → Server Action directo).
- (-) API Routes tienen cold start latency en Vercel (~200ms p95). Mitigación: Edge Runtime para `/api/opportunities` (lectura).
- (-) Cron mínimo de Vercel es 1 minuto en plan free. Mitigación: Upstash QStash para sub-minuto scheduling.
- (-) Next.js 16.2 introduce breaking changes en `fetch` caching. Ver ADR-009.

**Alternativas rechazadas:** NestJS — overhead de infraestructura injustificado para MVP. Remix — ecosistema de cron/jobs menos maduro.

---

### ADR-002: PostgreSQL (Neon.tech serverless) + Prisma 7

**Estado:** Aceptado · reemplaza ADR-002 v1.0 (Supabase)
**Contexto:** v1.0 especificaba Supabase. Stack canónico define Neon.tech. Se evalúan Neon.tech, Supabase, y DigitalOcean Managed PG.
**Decisión:** PostgreSQL serverless en Neon.tech con Prisma 7 ORM. Prisma 7 introduce `prisma/client/edge` compatible con Edge Runtime de Vercel y Neon serverless driver sin pool de conexiones tradicional.
**Consecuencias:**
- (+) `@neondatabase/serverless` driver permite queries desde Edge Runtime sin connection pool overhead.
- (+) Prisma 7 `omit` field en `findMany` elimina necesidad de `select` manual para excluir campos sensibles.
- (+) Neon branching permite crear ramas de DB para staging/preview deploys — alineado con Vercel preview deployments.
- (+) JSONB nativo para metadata de snapshots sin schema migration por cada nueva plataforma.
- (-) Neon free tier: 0.5GB storage, 191 compute hours/mes. Criterio de upgrade: snapshots/día > 30,000 OR storage > 400MB.
- (-) Prisma 7 cambió la API de migrations — `prisma migrate dev` requiere `--schema` explícito en monorepos.

**Patrón de cliente Prisma 7 para Edge:**
```typescript
// lib/db/prisma.ts
import { PrismaClient } from '@prisma/client/edge'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient().$extends(withAccelerate())

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Criterio de migración a Neon Pro:** cuando compute hours/mes > 150 OR latencia p95 > 100ms.

---

### ADR-003: Upstash QStash para scheduling sub-minuto

**Estado:** Aceptado · sin cambios desde v1.0
**Contexto:** Vercel Cron tiene granularidad de 1 minuto. Los precios spot requieren polling cada 10–20 segundos.
**Decisión:** Vercel Cron dispara cada minuto → enqueue en QStash → workers paralelos con delay escalonado.
**Consecuencias:**
- (+) Sin infraestructura adicional. QStash es serverless.
- (+) Retry automático con backoff configurable.
- (-) Latencia añadida de ~500ms por hop. Aceptable dado que no ejecutamos órdenes.
- (-) Costo: ~$0.40/100K mensajes ≈ $0.02/día a frecuencia nominal.

**Esquema de scheduling:**
```
T+0s  → Binance spot scrape
T+0s  → Bybit spot scrape
T+30s → Binance P2P scrape
T+60s → Bybit P2P scrape
T+60s → Airtm scrape
T+90s → Kontigo scrape
```

---

### ADR-004: Playwright headless para scraping P2P (Droplet externo)

**Estado:** Aceptado con reservas · sin cambios desde v1.0
**Contexto:** Binance P2P y Bybit P2P no tienen API pública estable.
**Decisión:** Playwright con Chromium headless en worker persistente en DigitalOcean Droplet ($6/mes). Expone endpoint HTTP interno consumido por `proxy.ts`.
**Consecuencias:**
- (+) Maneja JS-rendered content con stealth mode.
- (-) No deployable en Vercel. Proceso separado necesario.
- **Mitigación de bloqueo:** UA rotation cada 50 requests + delays aleatorios 2–8s + fallback a API interna.

**Criterio de deprecación:** si Binance/Bybit exponen API P2P pública → migrar a patrón API directa.

---

### ADR-005: Resend + React Email para alertas

**Estado:** Aceptado · sin cambios desde v1.0
**Contexto:** Stack canónico confirma Resend.
**Decisión:** Resend SDK para delivery. React Email para templates — mismo paradigma de componentes que el frontend. Fase 2 añade Telegram.
**Consecuencias:**
- (+) `resend.emails.send()` tipado end-to-end con TypeScript.
- (+) React Email templates son testeables con Vitest (render + snapshot).
- (-) Dependencia de servicio externo. Mitigación: fallback SMTP en Fase 2.

---

### ADR-006: Auth.js v5 para autenticación — protección por capa, sin middleware

**Estado:** Aceptado · revisado en v1.2
**Contexto:** El sistema requiere autenticación para proteger el dashboard y los endpoints de configuración. Se evalúan Auth.js v5, Clerk, y NextAuth v4. Se descartó el patrón `middleware.ts` por carecer de soporte oficial estable en Next.js App Router con `database` session strategy.
**Decisión:** Auth.js v5 con Prisma Adapter para Neon. **Protección de rutas implementada directamente en cada capa** (RSC layouts, Server Actions, Route Handlers) mediante llamada explícita a `auth()` — sin `middleware.ts`.

**Patrón de protección por capa:**

```typescript
// CAPA 1: RSC Layout — protege todo el grupo de rutas (dashboard)
// app/(dashboard)/layout.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')
  return <>{children}</>
}

// CAPA 2: Server Action — verifica sesión antes de cualquier mutación
// lib/actions/config.actions.ts
'use server'
import { auth } from '@/lib/auth'
export async function updateUserConfig(input: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }
  // ...
}

// CAPA 3: Route Handler — verifica sesión en endpoints sensibles
// app/api/evaluate/route.ts
import { auth } from '@/lib/auth'
export async function POST(request: Request) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })
  // ...
}
```

**Consecuencias:**
- (+) Patrón oficialmente recomendado por Next.js y Auth.js para App Router — sin dependencias experimentales.
- (+) Cada capa controla su propia autorización — sin acoplamiento a un archivo de configuración global.
- (+) Compatible con `database` session strategy sin restricciones de runtime.
- (+) RSC layout actúa como guard centralizado para todo el grupo `(dashboard)` — un solo `auth()` protege todas las subrutas.
- (+) Server Actions tienen verificación de sesión integrada — imposible mutar sin auth aunque se llame directamente.
- (-) Sin `middleware.ts`, no hay redirect automático pre-render para rutas individuales de API. Mitigación: Route Handlers verifican `auth()` al inicio y retornan 401 explícito.
- (-) Requiere llamada a `auth()` en cada entry point protegido. Mitigación: helper `requireAuth()` centraliza la lógica de redirect.

**Helper centralizado `requireAuth()`:**
```typescript
// lib/auth-helpers.ts
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  return session
}

export async function requireAuthApi(): Promise<Response | null> {
  const session = await auth()
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 })
  return null // null = auth OK, continuar
}
```

**Matriz de protección por ruta:**

| Ruta | Mecanismo de protección | Respuesta si no autenticado |
|---|---|---|
| `/dashboard/**` | `auth()` en `app/(dashboard)/layout.tsx` | `redirect('/login')` |
| `/api/evaluate` | `requireAuthApi()` en Route Handler | `401 Unauthorized` |
| `/api/opportunities` | Sin auth — datos no sensibles, Edge Runtime | `200` público |
| `/api/scrape/[platform]` | QStash HMAC signature | `401 Unauthorized` |
| `/api/cron/trigger` | `CRON_SECRET` Bearer token | `401 Unauthorized` |
| `/api/auth/**` | Auth.js handler — siempre público | N/A |
| `/api/health` | Público | `200` |
| `/api/uploadthing` | Auth verificada en `middleware()` del router UploadThing | `401` |

**Sin `middleware.ts` en el proyecto.** El archivo no debe existir.

**Rutas excluidas de auth (públicas):**
- `/api/scrape/[platform]` — protegidas por QStash HMAC.
- `/api/health` — healthcheck externo.
- `/api/opportunities` — lectura pública de datos agregados (sin datos sensibles de usuario).

---

### ADR-007: proxy.ts — capa de abstracción para APIs externas

**Estado:** Aceptado · nuevo en v1.1
**Contexto:** El sistema llama a múltiples APIs externas (Binance, Bybit, Airtm, Playwright Worker, Resend, UploadThing). Sin una capa de abstracción, el manejo de errores, timeouts y logging queda disperso en cada scraper.
**Decisión:** Módulo `lib/proxy.ts` que encapsula TODA llamada a API externa. Ningún scraper ni servicio llama a `fetch()` directamente — siempre pasan por `proxy.ts`.

**Contrato:**
```typescript
// lib/proxy.ts

type ProxyRequestOptions = {
  url: string
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
  timeoutMs?: number        // default: 8000ms
  retries?: number          // default: 2
  retryDelayMs?: number     // default: 1000ms
  context: string           // label para logs: 'binance_spot_scrape'
}

type ProxyResponse<T> =
  | { ok: true; data: T; latencyMs: number }
  | { ok: false; error: string; statusCode?: number; latencyMs: number }

export async function proxyRequest<T>(
  opts: ProxyRequestOptions,
): Promise<ProxyResponse<T>> {
  const start = Date.now()
  let attempt = 0

  while (attempt <= opts.retries ?? 2) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        opts.timeoutMs ?? 8000,
      )

      const res = await fetch(opts.url, {
        method: opts.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...opts.headers,
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const latencyMs = Date.now() - start

      if (!res.ok) {
        const error = `HTTP ${res.status} from ${opts.context}`
        console.error(`[proxy] ${error}`)
        return { ok: false, error, statusCode: res.status, latencyMs }
      }

      const data = (await res.json()) as T
      console.info(`[proxy] ${opts.context} OK ${latencyMs}ms`)
      return { ok: true, data, latencyMs }

    } catch (err) {
      attempt++
      if (attempt > (opts.retries ?? 2)) {
        const latencyMs = Date.now() - start
        const error = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[proxy] ${opts.context} FAILED after ${attempt} attempts: ${error}`)
        return { ok: false, error, latencyMs }
      }
      await new Promise(r => setTimeout(r, opts.retryDelayMs ?? 1000))
    }
  }

  // Nunca se alcanza — TypeScript lo requiere
  return { ok: false, error: 'Unreachable', latencyMs: 0 }
}
```

**Consecuencias:**
- (+) Un solo lugar para añadir observabilidad (OpenTelemetry, Datadog) en Fase 3.
- (+) `latencyMs` siempre disponible — el Normalizer lo propaga al `MarketSnapshot` para fill probability scoring.
- (+) Retry con backoff centralizado — scrapers no implementan lógica de retry propia.
- (-) Overhead mínimo de abstracción. Aceptable.

---

### ADR-008: Zustand para estado cliente del dashboard

**Estado:** Aceptado · nuevo en v1.1
**Contexto:** El dashboard necesita estado compartido entre: filtros de clasificación, configuración de umbrales activa, y notificaciones en tiempo real. Se evalúan Zustand, Jotai, y Context API.
**Decisión:** Zustand con slices separados. No se usa para datos de servidor — eso va via RSC + SWR.
**Consecuencias:**
- (+) Sin boilerplate. Un store por feature slice.
- (+) Compatible con React 18 concurrent mode y Server Components (el store solo vive en Client Components).
- (-) Zustand no persiste entre navegaciones por defecto. Para preferencias de UI que deben persistir: `zustand/middleware` `persist` con `localStorage`.

**Slices definidos:**
```typescript
// lib/store/dashboard.store.ts

type DashboardStore = {
  // Filtros activos
  activeClassification: 'ALL' | 'EXECUTABLE' | 'MARGINAL'
  setClassification: (c: DashboardStore['activeClassification']) => void

  // Configuración de umbrales (cargada desde DB, editable localmente)
  localConfig: Partial<UserConfig>
  setLocalConfig: (patch: Partial<UserConfig>) => void
  isDirty: boolean

  // Notificaciones UI
  notifications: Array<{ id: string; message: string; type: 'success' | 'error' }>
  addNotification: (n: Omit<DashboardStore['notifications'][0], 'id'>) => void
  dismissNotification: (id: string) => void
}
```

---

### ADR-009: Tailwind CSS 4.x y shadcn/ui

**Estado:** Aceptado · nuevo en v1.1
**Contexto:** Stack canónico define Tailwind 4.x. Tailwind 4 introduce cambios breaking respecto a v3 (nueva engine, config via CSS en lugar de `tailwind.config.ts`, `@layer` behavior cambiado).
**Decisión:** Tailwind CSS 4.x con shadcn/ui para componentes base. shadcn/ui genera componentes locales (no es una librería npm) — totalmente compatible con Tailwind 4 dado que los componentes son editables.
**Consecuencias:**
- (+) Tailwind 4 es significativamente más rápido en build time (Rust-based engine).
- (+) shadcn/ui con `npx shadcn@latest add` genera componentes en `/components/ui/` — no dependency lock.
- (+) Recharts se integra dentro de componentes shadcn `<ChartContainer>` para theming unificado con CSS variables.
- (-) Tailwind 4 elimina `tailwind.config.ts` — la configuración de colores y temas se hace en `globals.css` con `@theme`. Requiere migración de cualquier config v3 existente.
- (-) Algunos plugins de Tailwind v3 no son compatibles con v4. Verificar antes de añadir plugins de terceros.

**Estructura de tema en `globals.css`:**
```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-brand-primary: oklch(55% 0.18 250);
  --color-brand-secondary: oklch(72% 0.14 200);
  --color-destructive: oklch(55% 0.22 25);
  --color-success: oklch(60% 0.18 145);
  --color-warning: oklch(75% 0.16 75);

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
}
```

---

### ADR-010: React Hook Form 7 + Zod para formularios

**Estado:** Aceptado · nuevo en v1.1
**Contexto:** El dashboard tiene un formulario de configuración de umbrales (`UserConfig`) que requiere validación en cliente y servidor.
**Decisión:** React Hook Form 7 con `@hookform/resolvers/zod` para validación en cliente, usando los mismos schemas Zod del servidor. Server Action como `action` del formulario — RHF llama a la Server Action directamente.
**Consecuencias:**
- (+) Schema Zod compartido entre validación cliente (RHF) y servidor (Server Action) — single source of truth.
- (+) RHF 7 `useFormState` se integra con Server Actions para manejo de errores de servidor en el formulario.
- (-) RHF solo corre en Client Components (`'use client'`). El formulario de configuración es el único Client Component en el dashboard de escritura.

**Patrón de integración:**
```typescript
// components/config/threshold-form.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserConfigFormSchema } from '@/lib/schemas/user-config.schema'
import { updateUserConfig } from '@/lib/actions/config.actions'

export function ThresholdForm({ initialConfig }: { initialConfig: UserConfig }) {
  const form = useForm<UserConfigFormInput>({
    resolver: zodResolver(UserConfigFormSchema),
    defaultValues: initialConfig,
  })

  return (
    <Form {...form}>
      <form action={async (formData) => {
        const values = form.getValues()
        const result = await updateUserConfig(values)
        if (!result.success) form.setError('root', { message: result.error })
      }}>
        {/* campos */}
      </form>
    </Form>
  )
}
```

---

### ADR-011: Recharts para visualización de datos

**Estado:** Aceptado · nuevo en v1.1
**Contexto:** El dashboard requiere visualización de ROI histórico, distribución de oportunidades por plataforma y tendencia de fill probability.
**Decisión:** Recharts integrado con shadcn/ui `<ChartContainer>` para herencia automática del tema Tailwind 4.
**Consecuencias:**
- (+) `<ChartContainer config={...}>` de shadcn maneja responsive sizing y CSS variables de color sin configuración extra.
- (+) Recharts es puramente cliente — los datos se pasan como props desde RSC o se cargan vía SWR.
- (-) Recharts no es un Server Component — requiere `'use client'`. El wrapper RSC pasa los datos como props serializables.

**Patrón de datos:**
```typescript
// app/(dashboard)/page.tsx — RSC
import { getOpportunityStats } from '@/lib/db/queries/opportunities'
import { ROIChart } from '@/components/dashboard/roi-chart'

export default async function DashboardPage() {
  // Datos resueltos en servidor, pasados como props serializables al componente Recharts
  const stats = await getOpportunityStats({ days: 7 })

  return <ROIChart data={stats.roiTimeSeries} />
}
```

---

### ADR-012: UploadThing para exportación de reportes

**Estado:** Aceptado · nuevo en v1.1
**Contexto:** El sistema debe permitir exportar historial de oportunidades como CSV/JSON para análisis externo.
**Decisión:** UploadThing para generación y descarga de exports. El Server Action genera el archivo en memoria, lo sube a UploadThing y devuelve una URL firmada de descarga.
**Consecuencias:**
- (+) No requiere almacenamiento propio. UploadThing maneja S3/CDN.
- (+) URLs firmadas con TTL configurable — los exports expiran automáticamente.
- (-) Overhead de red: el archivo se sube a UploadThing y el usuario lo descarga desde ahí. Para archivos < 5MB (esperado) es negligible.
- (-) UploadThing free tier: 2GB storage, 10GB bandwidth/mes. Suficiente para MVP.

**Uso en Fase 1:** Solo exportación de historial. UploadThing no se usa para uploads de usuario en v1.0.

---

## 5. Arquitectura del Sistema

### 5.1 Vista de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE INGESTIÓN                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Binance API  │  │  Bybit API   │  │ Playwright Worker │  │
│  │   (spot)     │  │   (spot)     │  │  (P2P · Droplet) │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         └─────────────────┴──────────────────┘             │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │  proxy.ts   │  ← timeout, retry, log  │
│                    └──────┬──────┘                          │
│                    ┌──────▼──────┐                          │
│                    │ Normalizer  │                          │
│                    └──────┬──────┘                          │
└───────────────────────────┼─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│               CAPA DE PERSISTENCIA                          │
│                                                             │
│         PostgreSQL · Neon.tech (serverless)                 │
│         Prisma 7 · @prisma/client/edge                      │
│                                                             │
│  markets_snapshots  │  opportunities  │  execution_logs    │
│  platform_status    │  user_configs   │  alerts            │
│  User / Session / Account  (Auth.js v5 Prisma Adapter)     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CAPA DE EVALUACIÓN                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Arbitrage Engine (stateless, puras)         │   │
│  │  validateFreshness → calcROI → applyFees →          │   │
│  │  slippageModel → networkCost → liquidity →          │   │
│  │  fillProbability → latencyPenalty → classify        │   │
│  └──────────────────────────┬──────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
┌────────▼────────┐  ┌───────▼───────┐   ┌────────▼────────┐
│  Alert Engine   │  │   Dashboard   │   │  Audit Logger   │
│  Resend + RHF   │  │ RSC + Recharts│   │  (append-only)  │
│  (Fase2: TG)    │  │ Zustand store │   │                 │
└─────────────────┘  └───────────────┘   └─────────────────┘
```

### 5.2 Patrón de Rendering por Ruta

| Ruta | Runtime | Estrategia | Razón |
|---|---|---|---|
| `/dashboard` | Node.js | RSC + SSR | Lee DB en servidor, pasa props a Client Components |
| `/dashboard/opportunities` | Node.js | RSC + SSR paginado | Historial paginado desde Neon |
| `/dashboard/config` | Node.js | RSC + Client Form | RSC carga config inicial; RHF en Client Component |
| `/api/opportunities` | **Edge** | Edge Runtime | Lectura frecuente — mínima cold start latency |
| `/api/evaluate` | Node.js | Serverless Function | Cómputo intensivo, necesita Prisma full client |
| `/api/scrape/[platform]` | Node.js | Serverless Function | Invocado por QStash — necesita full Node.js |
| `/api/cron/trigger` | Node.js | Serverless Function | Invocado por Vercel Cron |
| `/api/auth/[...nextauth]` | Node.js | Auth.js v5 handler | Requiere Node.js por `database` session strategy |

---

## 6. Contratos de Datos (Zod 3.x)

### 6.1 MarketSnapshot

```typescript
// lib/schemas/snapshot.schema.ts
import { z } from 'zod'

export const PlatformEnum = z.enum([
  'binance_spot',
  'binance_p2p',
  'bybit_spot',
  'bybit_p2p',
  'airtm',
  'kontigo',
])

export const AssetEnum = z.enum(['USDT', 'USDC', 'BTC', 'ETH'])

export const MarketSnapshotSchema = z.object({
  id: z.string().cuid(),
  platform: PlatformEnum,
  asset: AssetEnum,
  baseCurrency: z.string().length(3),
  price: z.number().positive().finite(),
  priceAsk: z.number().positive().finite().optional(),
  priceBid: z.number().positive().finite().optional(),
  volume24h: z.number().nonnegative().optional(),
  availableLiquidity: z.number().nonnegative(),
  fee: z.number().min(0).max(0.1),
  latencyMs: z.number().nonneg().int(),
  scrapedAt: z.string().datetime(),
  isStale: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
})

export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>
export type RawSnapshotInput = z.infer<
  typeof MarketSnapshotSchema.omit({ id: true, isStale: true })
>
```

### 6.2 OpportunityInput / Output

```typescript
// lib/schemas/opportunity.schema.ts
import { z } from 'zod'
import { MarketSnapshotSchema } from './snapshot.schema'
import { UserConfigSchema } from './user-config.schema'

export const OpportunityInputSchema = z.object({
  buySnapshot: MarketSnapshotSchema,
  sellSnapshot: MarketSnapshotSchema,
  capitalAmount: z.number().positive(),
  networkCostUSD: z.number().nonneg().default(0),
  userConfig: UserConfigSchema,
})

export const OpportunityOutputSchema = z.object({
  id: z.string().cuid(),
  route: z.string(),
  buyPlatform: z.string(),
  sellPlatform: z.string(),
  asset: z.string(),
  buyPrice: z.number().positive(),
  sellPrice: z.number().positive(),

  roiGross: z.number(),
  feesImpact: z.number(),
  slippageImpact: z.number(),
  networkImpact: z.number(),
  roiAdjusted: z.number(),

  fillProbability: z.number().min(0).max(1),
  liquidityRatio: z.number().min(0),
  latencyRiskMs: z.number().nonneg(),

  classification: z.enum(['EXECUTABLE', 'MARGINAL', 'INVALID']),
  rejectionReasons: z.array(z.string()).optional(),

  evaluatedAt: z.string().datetime(),
  snapshotAge: z.object({
    buyMs: z.number(),
    sellMs: z.number(),
  }),
})

export type OpportunityInput = z.infer<typeof OpportunityInputSchema>
export type OpportunityOutput = z.infer<typeof OpportunityOutputSchema>
```

### 6.3 UserConfig

```typescript
// lib/schemas/user-config.schema.ts
import { z } from 'zod'
import { PlatformEnum, AssetEnum } from './snapshot.schema'

export const UserConfigSchema = z.object({
  id: z.string().cuid(),
  userId: z.string(),
  minROI: z.number().min(0).max(100).default(1.5),
  capitalAmount: z.number().positive().default(500),
  maxSlippage: z.number().min(0).max(0.1).default(0.005),
  minFillProbability: z.number().min(0).max(1).default(0.7),
  alertEmail: z.string().email().optional(),
  alertTelegram: z.string().optional(),
  alertDedupeWindowMin: z.number().int().positive().default(30),
  enabledPlatforms: z.array(PlatformEnum).min(1),
  monitoredAssets: z.array(AssetEnum).min(1),
  updatedAt: z.string().datetime(),
})

// Schema para formulario (sin campos de servidor)
export const UserConfigFormSchema = UserConfigSchema.omit({
  id: true,
  userId: true,
  updatedAt: true,
})

export type UserConfig = z.infer<typeof UserConfigSchema>
export type UserConfigFormInput = z.infer<typeof UserConfigFormSchema>
```

### 6.4 Server Action: updateUserConfig

```typescript
// lib/actions/config.actions.ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { UserConfigFormSchema } from '@/lib/schemas/user-config.schema'

type ActionResult = { success: true } | { success: false; error: string }

export async function updateUserConfig(
  input: unknown,
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  const parsed = UserConfigFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await prisma.userConfig.upsert({
    where: { userId: session.user.id },
    update: { ...parsed.data, updatedAt: new Date() },
    create: { ...parsed.data, userId: session.user.id },
  })

  return { success: true }
}
```

---

## 7. Motor de Arbitraje — Especificación Funcional

### 7.1 Pipeline de Evaluación

```typescript
// lib/arbitrage-engine/pipeline.ts

type EvaluationPipeline = (input: OpportunityInput) => OpportunityOutput

const evaluatePipeline: EvaluationPipeline = pipe(
  validateSnapshotFreshness,
  calculateGrossROI,
  applyFeeImpact,
  applySlippageModel,
  applyNetworkCost,
  evaluateLiquidity,
  scoreFillProbability,
  applyLatencyPenalty,
  classify,
)
```

### 7.2 TTL por Plataforma

```typescript
// lib/arbitrage-engine/steps/validate-freshness.ts

const TTL_MS: Record<Platform, number> = {
  binance_spot: 30_000,
  bybit_spot:   30_000,
  binance_p2p:  120_000,
  bybit_p2p:    120_000,
  airtm:        180_000,
  kontigo:      180_000,
}

function validateSnapshotFreshness(ctx: EvalContext): EvalContext {
  const now = Date.now()
  const buyAge = now - new Date(ctx.input.buySnapshot.scrapedAt).getTime()
  const sellAge = now - new Date(ctx.input.sellSnapshot.scrapedAt).getTime()

  if (buyAge > TTL_MS[ctx.input.buySnapshot.platform] ||
      sellAge > TTL_MS[ctx.input.sellSnapshot.platform]) {
    return reject(ctx, `STALE_DATA: buy=${buyAge}ms sell=${sellAge}ms`)
  }

  return { ...ctx, output: { ...ctx.output, snapshotAge: { buyMs: buyAge, sellMs: sellAge } } }
}
```

### 7.3 Modelo de Slippage No Lineal

```typescript
// lib/arbitrage-engine/steps/slippage-model.ts

function applySlippageModel(ctx: EvalContext): EvalContext {
  const { capitalAmount, buySnapshot, sellSnapshot } = ctx.input
  const minLiquidity = Math.min(
    buySnapshot.availableLiquidity,
    sellSnapshot.availableLiquidity,
  )

  const utilizationRatio = capitalAmount / minLiquidity
  const baseSlippage = calculateSpreadSlippage(buySnapshot, sellSnapshot)

  // Lineal hasta 30% utilización, exponencial después
  const liquidityPenalty = utilizationRatio <= 0.3
    ? utilizationRatio * 0.002
    : 0.0006 + Math.pow(utilizationRatio - 0.3, 1.5) * 0.05

  return applyImpact(ctx, 'slippageImpact', baseSlippage + liquidityPenalty)
}
```

### 7.4 Fill Probability

```typescript
// lib/arbitrage-engine/steps/fill-probability.ts

function scoreFillProbability(ctx: EvalContext): EvalContext {
  if (!ctx.input.sellSnapshot.platform.includes('p2p')) {
    return { ...ctx, output: { ...ctx.output, fillProbability: 1.0 } }
  }

  const { availableLiquidity, volume24h, latencyMs } = ctx.input.sellSnapshot
  const { capitalAmount } = ctx.input

  const liquidityScore = Math.min(availableLiquidity / capitalAmount, 1.0)
  const volumeScore = volume24h
    ? Math.min(volume24h / (capitalAmount * 5), 1.0)
    : 0.5
  const latencyScore = latencyMs < 2000
    ? 1.0
    : Math.max(0, 1 - (latencyMs - 2000) / 10000)

  const fillProbability =
    liquidityScore * 0.5 + volumeScore * 0.3 + latencyScore * 0.2

  return { ...ctx, output: { ...ctx.output, fillProbability } }
}
```

### 7.5 Clasificación Final

```typescript
// lib/arbitrage-engine/steps/classify.ts

function classify(ctx: EvalContext): EvalContext {
  const { roiAdjusted, fillProbability, liquidityRatio } = ctx.output
  const { minROI, minFillProbability } = ctx.input.userConfig
  const reasons: string[] = []

  if (roiAdjusted < 0)        reasons.push(`ROI_NEGATIVE: ${roiAdjusted.toFixed(4)}%`)
  if (roiAdjusted < minROI)   reasons.push(`ROI_BELOW_THRESHOLD: ${roiAdjusted.toFixed(2)}% < ${minROI}%`)
  if (fillProbability < 0.5)  reasons.push(`LOW_FILL_PROBABILITY: ${fillProbability.toFixed(2)}`)
  if (liquidityRatio < 1.0)   reasons.push(`INSUFFICIENT_LIQUIDITY: ratio=${liquidityRatio.toFixed(2)}`)

  if (reasons.length > 0) {
    return { ...ctx, output: { ...ctx.output, classification: 'INVALID', rejectionReasons: reasons } }
  }

  const classification =
    roiAdjusted >= minROI && fillProbability >= minFillProbability
      ? 'EXECUTABLE'
      : 'MARGINAL'

  return { ...ctx, output: { ...ctx.output, classification } }
}
```

---

## 8. Modelo de Datos (Prisma 7 Schema)

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]  // requerido para Neon serverless adapter
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // para migrations (Neon requiere conexión directa, no pooler)
}

// ─── Auth.js v5 Prisma Adapter ─────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  config        UserConfig?
  createdAt     DateTime  @default(now())
}

model Account {
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([provider, providerAccountId])
}

model Session {
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@id([identifier, token])
}

// ─── Dominio de Arbitraje ───────────────────────────────────────────────────

model MarketSnapshot {
  id                 String   @id @default(cuid())
  platform           String
  asset              String
  baseCurrency       String
  price              Float
  priceAsk           Float?
  priceBid           Float?
  volume24h          Float?
  availableLiquidity Float    @default(0)
  fee                Float
  latencyMs          Int
  scrapedAt          DateTime
  metadata           Json?
  createdAt          DateTime @default(now())

  @@index([platform, asset, scrapedAt])
  @@index([scrapedAt])
}

model Opportunity {
  id                String   @id @default(cuid())
  route             String
  buyPlatform       String
  sellPlatform      String
  asset             String
  buyPrice          Float
  sellPrice         Float
  capitalAmount     Float
  roiGross          Float
  feesImpact        Float
  slippageImpact    Float
  networkImpact     Float
  roiAdjusted       Float
  fillProbability   Float
  liquidityRatio    Float
  latencyRiskMs     Int
  snapshotAgeBuyMs  Int
  snapshotAgeSellMs Int
  classification    String
  rejectionReasons  String[] @default([])
  evaluatedAt       DateTime
  createdAt         DateTime @default(now())
  alerts            Alert[]

  @@index([classification, evaluatedAt])
  @@index([route, evaluatedAt])
}

model Alert {
  id              String      @id @default(cuid())
  opportunityId   String
  opportunity     Opportunity @relation(fields: [opportunityId], references: [id])
  channel         String
  recipient       String
  sentAt          DateTime    @default(now())
  status          String

  @@index([recipient, sentAt])
}

model PlatformStatus {
  id                String    @id @default(cuid())
  platform          String    @unique
  isHealthy         Boolean   @default(true)
  lastSuccessAt     DateTime?
  lastErrorAt       DateTime?
  errorMessage      String?
  consecutiveErrors Int       @default(0)
  updatedAt         DateTime  @updatedAt
}

model UserConfig {
  id                   String   @id @default(cuid())
  userId               String   @unique
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  minROI               Float    @default(1.5)
  capitalAmount        Float    @default(500)
  maxSlippage          Float    @default(0.005)
  minFillProbability   Float    @default(0.7)
  alertEmail           String?
  alertTelegram        String?
  alertDedupeWindowMin Int      @default(30)
  enabledPlatforms     String[]
  monitoredAssets      String[]
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

---

## 9. API Routes — Contratos HTTP

### 9.1 POST /api/cron/trigger

Invocado por Vercel Cron. Protegido con `CRON_SECRET` + Auth.js middleware.

**Headers:** `Authorization: Bearer {CRON_SECRET}`
**Response 200:** `{ enqueuedJobs: number, scheduledAt: string }`
**Response 401:** Header inválido.

---

### 9.2 POST /api/scrape/[platform]

Invocado por QStash. Verificación HMAC con `@upstash/qstash/nextjs` `verifySignatureAppRouter`.

**Body:**
```typescript
{ platform: Platform; asset: Asset; requestId: string }
```
**Response 200:** `{ snapshotId: string; price: number; latencyMs: number; scrapedAt: string }`
**Response 422:** Datos malformados (Zod parse failure).
**Response 503:** Plataforma down.

---

### 9.3 POST /api/evaluate

Disparado post-scrape o manualmente desde dashboard (requiere sesión Auth.js).

**Response 200:**
```typescript
{
  evaluatedPairs: number
  opportunities: { executable: number; marginal: number; invalid: number }
  alertsSent: number
  durationMs: number
}
```

---

### 9.4 GET /api/opportunities (Edge Runtime)

**Query:** `?classification=EXECUTABLE&limit=20&cursor=<cuid>&since=<ISO>`
**Response 200:**
```typescript
{
  data: OpportunityOutput[]
  meta: { total: number; hasMore: boolean; nextCursor: string | null }
}
```

---

## 10. Estructura del Proyecto

```
/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx                    # Magic link login (Auth.js v5)
│   ├── (dashboard)/
│   │   ├── layout.tsx                      # Sidebar + Nav (RSC)
│   │   ├── page.tsx                        # Dashboard principal (RSC + Recharts)
│   │   ├── opportunities/
│   │   │   └── page.tsx                    # Historial paginado (RSC)
│   │   └── config/
│   │       └── page.tsx                    # Configuración (RSC carga + RHF Client)
│   └── api/
│       ├── auth/
│       │   └── [...nextauth]/route.ts      # Auth.js v5 handler
│       ├── cron/
│       │   └── trigger/route.ts
│       ├── scrape/
│       │   └── [platform]/route.ts
│       ├── evaluate/route.ts
│       └── opportunities/route.ts          # Edge Runtime
│
├── lib/
│   ├── proxy.ts                            # ADR-007: capa de abstracción HTTP
│   ├── auth.ts                             # Auth.js v5 config + Prisma Adapter
│   │
│   ├── arbitrage-engine/
│   │   ├── pipeline.ts
│   │   └── steps/
│   │       ├── validate-freshness.ts
│   │       ├── calculate-roi.ts
│   │       ├── apply-fees.ts
│   │       ├── slippage-model.ts
│   │       ├── network-cost.ts
│   │       ├── liquidity-eval.ts
│   │       ├── fill-probability.ts
│   │       ├── latency-penalty.ts
│   │       └── classify.ts
│   │
│   ├── scrapers/
│   │   ├── base-scraper.ts                 # Interfaz — usa proxy.ts internamente
│   │   ├── binance-spot.ts
│   │   ├── binance-p2p.ts                  # Llama al Playwright Worker via proxy.ts
│   │   ├── bybit-spot.ts
│   │   ├── bybit-p2p.ts
│   │   ├── airtm.ts
│   │   └── kontigo.ts
│   │
│   ├── alerts/
│   │   ├── email.ts                        # Resend + React Email
│   │   ├── telegram.ts                     # Fase 2
│   │   └── dedup.ts
│   │
│   ├── db/
│   │   ├── prisma.ts                       # Singleton Prisma 7 + Neon adapter
│   │   └── queries/
│   │       ├── opportunities.ts
│   │       ├── snapshots.ts
│   │       └── platform-status.ts
│   │
│   ├── actions/
│   │   └── config.actions.ts               # Server Actions (RHF + Zod)
│   │
│   ├── store/
│   │   └── dashboard.store.ts              # Zustand slices (ADR-008)
│   │
│   └── schemas/
│       ├── snapshot.schema.ts
│       ├── opportunity.schema.ts
│       └── user-config.schema.ts
│
├── components/
│   ├── ui/                                 # shadcn/ui generados (no editar manualmente)
│   ├── dashboard/
│   │   ├── opportunity-card.tsx
│   │   ├── roi-breakdown.tsx
│   │   ├── roi-chart.tsx                   # Recharts + ChartContainer
│   │   ├── platform-status.tsx
│   │   └── classification-badge.tsx
│   └── config/
│       └── threshold-form.tsx              # RHF Client Component
│
├── emails/
│   └── opportunity-alert.tsx               # React Email template
│
│   # ⚠️ NO existe middleware.ts — protección de rutas vía auth() por capa (ADR-006)
│
├── playwright-worker/                      # Proceso separado (Droplet)
│   ├── server.ts
│   ├── p2p-scraper.ts
│   └── Dockerfile
│
├── prisma/
│   └── schema.prisma
│
├── app/globals.css                         # Tailwind 4 @theme config (ADR-009)
│
└── __tests__/
    ├── unit/
    │   ├── pipeline.test.ts
    │   └── slippage.test.ts
    └── integration/
        └── evaluate-pipeline.test.ts
```

---

## 11. Sistema de Alertas — Especificación Completa

### 11.1 Condición de Disparo

```typescript
// lib/alerts/should-alert.ts

async function shouldSendAlert(
  opportunity: OpportunityOutput,
  config: UserConfig,
  db: PrismaClient,
): Promise<{ send: boolean; reason?: string }> {
  if (opportunity.classification !== 'EXECUTABLE') {
    return { send: false, reason: 'NOT_EXECUTABLE' }
  }

  if (opportunity.roiAdjusted < config.minROI) {
    return { send: false, reason: 'BELOW_USER_THRESHOLD' }
  }

  const dedupeWindow = new Date(Date.now() - config.alertDedupeWindowMin * 60_000)
  const recentAlert = await db.alert.findFirst({
    where: {
      opportunity: { route: opportunity.route },
      sentAt: { gte: dedupeWindow },
      status: 'sent',
    },
  })

  if (recentAlert) {
    return { send: false, reason: `DEDUPED: last=${recentAlert.sentAt.toISOString()}` }
  }

  return { send: true }
}
```

### 11.2 Template React Email

```tsx
// emails/opportunity-alert.tsx
import {
  Html, Head, Preview, Body, Container,
  Heading, Section, Row, Column, Text, Hr,
} from '@react-email/components'
import type { OpportunityOutput } from '@/lib/schemas/opportunity.schema'

export function OpportunityAlertEmail({
  opportunity,
}: {
  opportunity: OpportunityOutput
}) {
  return (
    <Html>
      <Head />
      <Preview>
        {opportunity.route} → ROI {opportunity.roiAdjusted.toFixed(2)}%
      </Preview>
      <Body>
        <Container>
          <Heading>Oportunidad Detectada</Heading>
          <Section>
            <Row><Column>Ruta</Column><Column>{opportunity.route}</Column></Row>
            <Row><Column>ROI Ajustado</Column><Column>{opportunity.roiAdjusted.toFixed(2)}%</Column></Row>
            <Row><Column>Fill Probability</Column><Column>{(opportunity.fillProbability * 100).toFixed(0)}%</Column></Row>
          </Section>
          <Section>
            <Text>Desglose ROI:</Text>
            <Text>Bruto: {opportunity.roiGross.toFixed(2)}%</Text>
            <Text>− Fees: {opportunity.feesImpact.toFixed(3)}%</Text>
            <Text>− Slippage: {opportunity.slippageImpact.toFixed(3)}%</Text>
            <Text>− Red: {opportunity.networkImpact.toFixed(3)}%</Text>
            <Hr />
            <Text>Ajustado: {opportunity.roiAdjusted.toFixed(2)}%</Text>
          </Section>
          <Text style={{ color: '#6b7280', fontSize: 12 }}>
            Evaluado: {new Date(opportunity.evaluatedAt).toLocaleString()}.
            Antigüedad snapshots — buy: {opportunity.snapshotAge.buyMs}ms,
            sell: {opportunity.snapshotAge.sellMs}ms.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

---

## 12. Acceptance Criteria Verificables

### AC-01: Frescura de Datos
**Dado** un snapshot de Binance Spot con `scrapedAt` > 30s atrás,
**Cuando** el motor lo procesa,
**Entonces** `classification: 'INVALID'` y `rejectionReasons` incluye `'STALE_DATA'`.
**Verificación:** `__tests__/unit/pipeline.test.ts` → `'rejects stale binance_spot snapshot'`

---

### AC-02: ROI Breakdown Auditabilidad
**Dado** una oportunidad `EXECUTABLE`,
**Cuando** se consulta via `/api/opportunities`,
**Entonces** `roiAdjusted = roiGross - feesImpact - slippageImpact - networkImpact` con error < 0.0001%.
**Verificación:** Integration test + invariante assert en `classify.ts`.

---

### AC-03: Deduplicación de Alertas
**Dado** alerta enviada para ruta `binance_spot→bybit_p2p` hace 15min con ventana de 30min,
**Cuando** se detecta otra oportunidad en la misma ruta,
**Entonces** NO se envía email y `alerts.status = 'deduped'`.
**Verificación:** Test unitario en `lib/alerts/dedup.ts` con mock Prisma.

---

### AC-04: Slippage No Lineal
**Dado** `capitalAmount=$1000`, `availableLiquidity=$1200` (utilización 83%),
**Cuando** se calcula slippage,
**Entonces** `slippageImpact` > slippage de misma ruta con `availableLiquidity=$10,000` (utilización 10%).
**Verificación:** `__tests__/unit/slippage.test.ts`

---

### AC-05: Platform Status Tracking
**Dado** el scraper de Airtm falla 3 veces consecutivas,
**Cuando** se consulta el dashboard,
**Entonces** Airtm aparece `isHealthy: false` y el motor excluye sus snapshots.
**Verificación:** Integration test + indicador visual en dashboard.

---

### AC-06: Latencia de Evaluación
**Dado** ciclo completo con 6 plataformas × 2 assets (≤ 66 pares),
**Cuando** se ejecuta `/api/evaluate`,
**Entonces** responde en < 2000ms p95.
**Verificación:** k6 load test en staging. Threshold en CI.

---

### AC-07: Auth.js — Rutas Protegidas
**Dado** un request no autenticado,
**Cuando** accede a `/dashboard` o `/api/evaluate`,
**Entonces** es redirigido a `/login` (dashboard) o recibe `401` (API).
**Verificación:** Playwright E2E test `auth.spec.ts`.

---

### AC-08: Server Action — Validación Zod en Servidor
**Dado** un payload inválido (e.g. `minROI: -5`) enviado a `updateUserConfig`,
**Cuando** la Server Action lo procesa,
**Entonces** retorna `{ success: false, error: 'Number must be greater than or equal to 0' }` sin DB write.
**Verificación:** Test unitario en `lib/actions/config.actions.test.ts`.

---

## 13. Riesgos, Mitigaciones y Decisiones Pendientes

| Riesgo | Probabilidad | Impacto | Mitigación | Estado |
|---|---|---|---|---|
| Binance P2P bloquea Playwright | Alta | Alto | UA rotation + delays + fallback API | Mitigado parcialmente |
| Datos P2P engañosos (outlier prices) | Media | Alto | Descartar precios > 2σ de la media de la ventana | **Pendiente — Fase 2** |
| Neon serverless cold start afecta TTL | Media | Medio | Connection pooler + `directUrl` para migrations | Mitigado |
| Auth.js v5 RC — breaking changes | Media | Medio | Pinear versión exacta en `package.json`, no usar `^` | **Pendiente verificar** |
| Tailwind 4 plugin incompatibilidades | Baja | Bajo | Verificar plugins antes de añadir. No usar plugins v3. | Aceptado |
| Fill Probability no calibrado para VES | Alta | Medio | Logging predicted vs actual para calibración en Fase 2 | **Pendiente** |
| UploadThing free tier bandwidth (10GB/mes) | Baja | Bajo | Comprimir CSV antes de upload. Monitor en Fase 2. | Aceptado |

### Decisiones Pendientes (RFC Abierto)

1. **DP-001:** ¿Incluir Binance Futures en Fase 1 o Fase 2? Añade complejidad de funding rates.
2. **DP-002:** ¿Multi-usuario desde Fase 1? Auth.js ya lo habilita — es decisión de producto, no técnica.
3. **DP-003:** ¿Webhook como canal de alerta desde Fase 1? Requiere UI en config form.
4. **DP-004:** ¿Zustand `persist` para preferencias de filtro? Bajo impacto, fácil de añadir post-MVP.

---

## 14. Roadmap de Implementación

### Fase 1 — MVP Funcional (Semanas 1–4)

**OKR:** Sistema end-to-end operativo con datos reales, auth, y alertas verificadas.

| Semana | Entregable | AC |
|---|---|---|
| 1 | Setup Next.js 16.2 + Tailwind 4 + shadcn/ui + Auth.js v5 + Neon + Prisma 7. Scrapers Binance/Bybit Spot. | AC-07 |
| 2 | Motor de evaluación completo con tests. proxy.ts. Schemas Zod. | AC-01, AC-02, AC-04 |
| 3 | API Routes, Vercel Cron + QStash. Dashboard RSC + Recharts básico. | AC-05, AC-06 |
| 4 | Sistema de alertas Resend + React Email. Config form RHF. Deduplicación. | AC-03, AC-08 |

**Criterio de salida Fase 1:** 8 AC passing en CI. 1 alerta real enviada con oportunidad EXECUTABLE verificada.

---

### Fase 2 — Robustez y P2P (Semanas 5–8)

| Semana | Entregable |
|---|---|
| 5–6 | Playwright Worker en Droplet. Scrapers P2P Binance + Bybit. |
| 7 | Outlier detection en precios P2P. Calibración fill_probability. |
| 8 | Telegram alerts. Webhook support. Export CSV via UploadThing. |

**Criterio de salida:** < 5% false positive rate en oportunidades EXECUTABLE medido en 2 semanas.

---

### Fase 3 — Multi-ruta y Simulación (Semanas 9–14)

| Entregable | Descripción |
|---|---|
| Multi-ruta arbitraje | Rutas A→B→C con cómputo de ROI compuesto |
| Simulación histórica | Backtesting sobre snapshots archivados |
| Dashboard analytics | P&L simulado, tasa de fill histórica (Recharts) |
| Alertas inteligentes | Reducir ruido via scoring ML básico |

---

### Fase 4 — Ejecución Asistida (Semanas 15+)

> ⚠️ Requiere análisis legal antes de implementar.

| Entregable | Descripción |
|---|---|
| One-click execution helper | Pre-llena formularios, NO automatiza |
| Audit trail inmutable | Sin DELETE en tablas de auditoría |
| Risk limits enforcement | Hard stops por pérdida diaria máxima |

---

## 15. Consideraciones de Seguridad

- `CRON_SECRET`: Bearer token para `/api/cron/trigger`. Rotar trimestralmente.
- `QSTASH_CURRENT_SIGNING_KEY`: Verificación HMAC en todos los endpoints QStash con `verifySignatureAppRouter`.
- `AUTH_SECRET`: Secreto de Auth.js v5. Mínimo 32 bytes. Generar con `openssl rand -base64 32`.
- Secrets manejados exclusivamente via Vercel Environment Variables. Nunca en código o logs.
- Rate limiting en `/api/opportunities` con `@upstash/ratelimit` (10 req/s por IP, sliding window).
- Protección de rutas vía `auth()` directo en cada capa: RSC layout para `/dashboard/**`, `requireAuthApi()` en Route Handlers sensibles, verificación en Server Actions. **Sin `middleware.ts`** — patrón oficialmente soportado en Next.js App Router (ADR-006).
- Rutas de scrape protegidas por QStash HMAC independientemente de Auth.js.
- Logs de evaluación son append-only. Sin DELETE en tablas de auditoría (`Opportunity`, `Alert`).
- P2P: NO almacenar credenciales de usuario de plataforma. Solo precios públicos.
- Prisma 7 `omit` fields en queries públicas para excluir campos sensibles de User.

---

## 16. Variables de Entorno Requeridas

```bash
# ── Base de datos (Neon.tech) ──────────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
# DATABASE_URL usa el connection pooler de Neon (pgbouncer) para runtime
# DIRECT_URL usa conexión directa — requerido por Prisma para migrations

# ── Auth.js v5 ─────────────────────────────────────────────────────────────
AUTH_SECRET="..."                    # openssl rand -base64 32
AUTH_TRUST_HOST=true                 # requerido en Vercel

# ── Vercel Cron ────────────────────────────────────────────────────────────
CRON_SECRET="..."

# ── Upstash QStash ─────────────────────────────────────────────────────────
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
QSTASH_CURRENT_SIGNING_KEY="..."
QSTASH_NEXT_SIGNING_KEY="..."
QSTASH_URL="https://qstash.upstash.io"

# ── Resend ─────────────────────────────────────────────────────────────────
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="alerts@yourdomain.com"

# ── UploadThing ────────────────────────────────────────────────────────────
UPLOADTHING_SECRET="sk_live_..."
UPLOADTHING_APP_ID="..."

# ── Playwright Worker (Droplet) ────────────────────────────────────────────
PLAYWRIGHT_WORKER_URL="https://..."
PLAYWRIGHT_WORKER_SECRET="..."

# ── Feature Flags ──────────────────────────────────────────────────────────
ENABLE_P2P_SCRAPING="false"          # Activar en Fase 2
ENABLE_TELEGRAM_ALERTS="false"       # Activar en Fase 2

# ── Entorno ────────────────────────────────────────────────────────────────
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://yourapp.vercel.app"
```

---

## 17. Notas de Compatibilidad de Stack

### Next.js 16.2 Breaking Changes relevantes

- `fetch()` ya no cachea por defecto en Route Handlers — añadir `{ cache: 'force-cache' }` explícito donde se necesite.
- `cookies()` y `headers()` son ahora async — `await cookies()`, `await headers()`.
- `params` en `page.tsx` y `layout.tsx` son ahora `Promise<{ ... }>` — `const { id } = await params`.

### Prisma 7 Breaking Changes relevantes

- `prisma generate` ahora requiere `--schema` si el schema no está en la raíz del proyecto.
- El tipo de retorno de `findUnique` sin `include` ya no incluye relaciones — no hay cambio de comportamiento silencioso.
- `@prisma/client/edge` es el import correcto para Edge Runtime y Neon serverless driver.

### Tailwind CSS 4.x Breaking Changes relevantes

- Eliminado `tailwind.config.ts` — configuración via `@theme` en `globals.css`.
- `@layer utilities` sigue funcionando pero `@layer base` tiene nuevo comportamiento de specificity.
- Clase `ring` cambia su tamaño por defecto — revisar componentes shadcn generados.

---

*Fin de SPEC_ARBITRAGE_MONITOR v1.1.0-rc1*
*Próxima revisión: inicio de Fase 2 o resolución de DP-001/002/003/004*
*Stack canónico fijado: Next.js 16.2 · TS 5.x · Tailwind 4.x · Prisma 7 · Neon · Auth.js v5 · Zod 3.x · shadcn/ui · Zustand · RHF 7 · Resend · Recharts · UploadThing · Vercel*
