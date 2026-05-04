# AIM — AGENT EXECUTION PLAN v1.1

**Arbitrage Intelligence Monitor · Plan de Ejecución por Agente de Código**
**Spec base:** SPEC_ARBITRAGE_MONITOR v1.2.0-rc1
**Versión:** 1.1.0
**Fecha:** 2026-05-02
**Cambio v1.1:** Eliminado `middleware.ts`. Protección de rutas migrada al patrón oficial Next.js App Router: `auth()` por capa en RSC layout, `requireAuthApi()` en Route Handlers, `getAuthenticatedUserId()` en Server Actions. CI verifica ausencia de `middleware.ts`. Test AC-08 ampliado a 3 casos.
Estado: Obsoleto, reemplazado por AIM_AGENT_EXECUTION_PLAN_v1.2.md para incluir degradación a contraseña única.

---

## INSTRUCCIONES PARA EL AGENTE

Este documento es el **plan de ejecución secuencial** para construir el sistema AIM.
Cada fase es **atómica**: tiene entradas, tareas, archivos a producir, y una verificación de salida explícita.

**Reglas de operación:**

1. **Ejecutar una fase a la vez.** No avanzar a la siguiente hasta que la verificación de salida de la fase actual pase.
2. **Leer el bloque `CONTEXTO_HEREDADO` antes de empezar cada fase.** Contiene el estado exacto que dejó la fase anterior.
3. **Escribir el bloque `HANDOFF` al terminar cada fase.** El agente de la siguiente fase lo leerá.
4. **No inventar.** Si un archivo o dependencia no existe, crearlo según el spec. Si una instrucción es ambigua, priorizar el spec v1.1.
5. **TypeScript strict.** Cero `any`, cero `@ts-ignore`. Todo tipado explícito.
6. **Sin placeholders.** Código production-grade o nada.

---

## ÍNDICE DE FASES

| #   | Fase                              | Descripción                                                  | AC cubiertos        |
| --- | --------------------------------- | ------------------------------------------------------------ | ------------------- |
| 0   | Bootstrap del proyecto            | Scaffolding, deps, tooling, env                              | —                   |
| 1   | Capa de datos — Schema y cliente  | Prisma 7, Neon.tech, Auth.js Adapter                         | —                   |
| 2   | Autenticación                     | Auth.js v5, magic link, protección por capa (sin middleware) | AC-07               |
| 3   | Schemas Zod + proxy.ts            | Contratos de datos, capa HTTP                                | —                   |
| 4   | Motor de arbitraje — Core         | Pipeline de evaluación, funciones puras                      | AC-01, AC-02, AC-04 |
| 5   | Scrapers — Spot APIs              | Binance Spot + Bybit Spot via proxy.ts                       | AC-05 (parcial)     |
| 6   | Ingestión — API Routes + QStash   | /api/scrape/[platform], cron trigger                         | AC-05, AC-06        |
| 7   | Motor de evaluación — API Route   | /api/evaluate, persistencia, platform status                 | AC-02, AC-05        |
| 8   | Sistema de alertas                | Resend + React Email + deduplicación                         | AC-03               |
| 9   | Dashboard — Estructura y layout   | App Router layout, auth guard, sidebar                       | AC-07               |
| 10  | Dashboard — Oportunidades         | RSC de lectura, opportunity cards, filtros Zustand           | —                   |
| 11  | Dashboard — Config y formulario   | RHF + Zod + Server Action updateUserConfig                   | AC-08               |
| 12  | Dashboard — Recharts analytics    | ROI chart, distribución por plataforma                       | —                   |
| 13  | Exportación CSV — UploadThing     | Server Action export + download URL                          | —                   |
| 14  | Tests y CI                        | Vitest unit + integration, GitHub Actions                    | AC-01…AC-08         |
| 15  | Deploy — Vercel + Neon producción | vercel.json, env vars, vercel cron                           | —                   |

---

---

# FASE 0 — Bootstrap del Proyecto

## Objetivo

Crear el proyecto Next.js 16.2 con todas las dependencias del stack canónico instaladas, TypeScript strict configurado, Tailwind 4 inicializado, y estructura de carpetas vacía pero completa lista para que las fases siguientes escriban en ella.

## CONTEXTO_HEREDADO

```
PROYECTO_NUEVO: true
DIRECTORIO: ./aim  (o el directorio actual si el agente ya está en el repo)
NADA_PREVIO: true
```

## Dependencias de Entrada

- Ninguna fase previa.
- Variables de entorno disponibles en `.env.local` (el agente debe crear `.env.local.example` pero NO el `.env.local` real con secrets).

## Tareas

### T0.1 — Crear proyecto Next.js 16.2

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --no-git
```

> Si el proyecto ya existe, saltar este paso y verificar que `next` en `package.json` sea `^16.2.0`.

### T0.2 — Instalar dependencias del stack canónico

```bash
# ORM + DB
npm install prisma@^7 @prisma/client@^7 @prisma/extension-accelerate
npm install @neondatabase/serverless

# Auth
npm install next-auth@beta @auth/prisma-adapter

# Validación
npm install zod@^3

# UI
npx shadcn@latest init
# Cuando pregunte: TypeScript=yes, style=default, baseColor=slate, cssVariables=yes, tailwind4=yes

# Componentes shadcn mínimos para el proyecto
npx shadcn@latest add button card badge table input label select separator sheet sidebar toast

# Estado cliente
npm install zustand

# Formularios
npm install react-hook-form@^7 @hookform/resolvers

# Email
npm install resend @react-email/components react-email

# Charts
npm install recharts

# Upload
npm install uploadthing @uploadthing/react

# Scheduling
npm install @upstash/qstash @upstash/ratelimit @upstash/redis

# Dev tools
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom
npm install -D @types/node
```

### T0.3 — Configurar TypeScript strict

Editar `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "module": "esnext",
    "moduleDetection": "force",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "playwright-worker"]
}
```

### T0.4 — Configurar Tailwind 4

Reemplazar `app/globals.css` completo:

```css
@import "tailwindcss";

@theme {
  --color-brand-primary: oklch(55% 0.18 250);
  --color-brand-secondary: oklch(72% 0.14 200);
  --color-destructive: oklch(55% 0.22 25);
  --color-success: oklch(60% 0.18 145);
  --color-warning: oklch(75% 0.16 75);
  --color-muted: oklch(96% 0.005 250);
  --color-muted-foreground: oklch(45% 0.02 250);

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

Eliminar `tailwind.config.ts` si existe (no se usa en Tailwind 4).

### T0.5 — Configurar Vitest

Crear `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: ["node_modules", ".next", "playwright-worker"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Crear `vitest.setup.ts`:

```typescript
import "@testing-library/jest-dom";
```

### T0.6 — Crear estructura de carpetas vacía

Crear los siguientes directorios y archivos `.gitkeep` donde corresponda:

```
lib/
  arbitrage-engine/
    steps/
  scrapers/
  alerts/
  db/
    queries/
  actions/
  store/
  schemas/
components/
  ui/           ← ya poblado por shadcn
  dashboard/
  config/
emails/
playwright-worker/
prisma/
__tests__/
  unit/
  integration/
app/
  (auth)/
    login/
  (dashboard)/
    opportunities/
    config/
  api/
    auth/
      [...nextauth]/
    cron/
      trigger/
    scrape/
      [platform]/
    evaluate/
    opportunities/
    health/
```

### T0.7 — Crear `.env.local.example`

```bash
# ── Base de datos (Neon.tech) ──────────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# ── Auth.js v5 ─────────────────────────────────────────────────────────────
AUTH_SECRET=""
AUTH_TRUST_HOST="true"

# ── Vercel Cron ────────────────────────────────────────────────────────────
CRON_SECRET=""

# ── Upstash QStash ─────────────────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
QSTASH_CURRENT_SIGNING_KEY=""
QSTASH_NEXT_SIGNING_KEY=""
QSTASH_URL="https://qstash.upstash.io"

# ── Resend ─────────────────────────────────────────────────────────────────
RESEND_API_KEY=""
RESEND_FROM_EMAIL="alerts@yourdomain.com"

# ── UploadThing ────────────────────────────────────────────────────────────
UPLOADTHING_SECRET=""
UPLOADTHING_APP_ID=""

# ── Playwright Worker (Droplet) ────────────────────────────────────────────
PLAYWRIGHT_WORKER_URL=""
PLAYWRIGHT_WORKER_SECRET=""

# ── Feature Flags ──────────────────────────────────────────────────────────
ENABLE_P2P_SCRAPING="false"
ENABLE_TELEGRAM_ALERTS="false"

# ── App ────────────────────────────────────────────────────────────────────
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### T0.8 — Actualizar `package.json` scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "typecheck": "tsc --noEmit"
  }
}
```

### T0.9 — Limpiar archivos boilerplate de create-next-app

- Eliminar `app/page.tsx` (se reescribirá en Fase 9).
- Eliminar `public/vercel.svg`, `public/next.svg`.
- Vaciar `app/layout.tsx` a un esqueleto mínimo:

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIM — Arbitrage Intelligence Monitor",
  description: "Sistema de monitoreo de oportunidades de arbitraje",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
```

> Instalar Geist si no está: `npm install geist`

## Verificación de Salida (gate)

El agente NO avanza a Fase 1 hasta que:

- [ ] `npm run typecheck` → 0 errores
- [ ] `npm run build` → build exitoso (puede haber páginas vacías, está bien)
- [ ] `node_modules` contiene: `prisma`, `next-auth`, `zod`, `zustand`, `react-hook-form`, `resend`, `recharts`, `uploadthing`, `@upstash/qstash`
- [ ] `app/globals.css` contiene `@theme {`
- [ ] `tsconfig.json` contiene `"strict": true`
- [ ] `.env.local.example` existe con todas las variables

## HANDOFF → Fase 1

```
FASE_COMPLETADA: 0
PROYECTO_ROOT: ./
NEXT_VERSION: 16.2.x
TAILWIND_VERSION: 4.x (config en globals.css, sin tailwind.config.ts)
PRISMA_VERSION: 7.x (no inicializado aún)
SHADCN_INIT: true
CARPETAS_CREADAS: todas según T0.6
ENV_EXAMPLE: .env.local.example creado
TYPECHECK: passing
BUILD: passing
SIGUIENTE_TAREA: Fase 1 — crear prisma/schema.prisma completo y configurar cliente Neon
```

---

---

# FASE 1 — Capa de Datos: Schema y Cliente

## Objetivo

Crear el schema Prisma 7 completo (tablas de Auth.js + dominio de arbitraje), configurar el cliente singleton con Neon serverless adapter, y ejecutar la migración inicial.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 0
PROYECTO_ROOT: ./
PRISMA_VERSION: 7.x (instalado, no inicializado)
DATABASE_URL: en .env.local (pooler Neon)
DIRECT_URL: en .env.local (conexión directa Neon)
```

## Tareas

### T1.1 — Inicializar Prisma

```bash
npx prisma init --datasource-provider postgresql
```

### T1.2 — Escribir `prisma/schema.prisma` completo

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
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
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

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
  id            String      @id @default(cuid())
  opportunityId String
  opportunity   Opportunity @relation(fields: [opportunityId], references: [id])
  channel       String
  recipient     String
  sentAt        DateTime    @default(now())
  status        String

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

### T1.3 — Crear cliente Prisma singleton con Neon adapter

```typescript
// lib/db/prisma.ts
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  }).$extends(withAccelerate());
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

### T1.4 — Crear queries base

```typescript
// lib/db/queries/snapshots.ts
import { prisma } from "@/lib/db/prisma";

export async function getRecentSnapshots(
  platform: string,
  asset: string,
  withinMs: number,
) {
  const since = new Date(Date.now() - withinMs);
  return prisma.marketSnapshot.findMany({
    where: { platform, asset, scrapedAt: { gte: since } },
    orderBy: { scrapedAt: "desc" },
    take: 1,
  });
}

export async function insertSnapshot(data: {
  platform: string;
  asset: string;
  baseCurrency: string;
  price: number;
  priceAsk?: number;
  priceBid?: number;
  volume24h?: number;
  availableLiquidity: number;
  fee: number;
  latencyMs: number;
  scrapedAt: Date;
  metadata?: Record<string, unknown>;
}) {
  return prisma.marketSnapshot.create({ data });
}
```

```typescript
// lib/db/queries/opportunities.ts
import { prisma } from "@/lib/db/prisma";

export async function insertOpportunity(data: {
  route: string;
  buyPlatform: string;
  sellPlatform: string;
  asset: string;
  buyPrice: number;
  sellPrice: number;
  capitalAmount: number;
  roiGross: number;
  feesImpact: number;
  slippageImpact: number;
  networkImpact: number;
  roiAdjusted: number;
  fillProbability: number;
  liquidityRatio: number;
  latencyRiskMs: number;
  snapshotAgeBuyMs: number;
  snapshotAgeSellMs: number;
  classification: string;
  rejectionReasons: string[];
  evaluatedAt: Date;
}) {
  return prisma.opportunity.create({ data });
}

export async function getOpportunities(opts: {
  classification?: string;
  limit?: number;
  cursor?: string;
  since?: Date;
}) {
  const { classification, limit = 20, cursor, since } = opts;

  return prisma.opportunity.findMany({
    where: {
      ...(classification && classification !== "ALL" ? { classification } : {}),
      ...(since ? { evaluatedAt: { gte: since } } : {}),
    },
    orderBy: { evaluatedAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

export async function getOpportunityStats(opts: { days: number }) {
  const since = new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000);
  return prisma.opportunity.findMany({
    where: { evaluatedAt: { gte: since }, classification: "EXECUTABLE" },
    select: {
      evaluatedAt: true,
      roiAdjusted: true,
      route: true,
      fillProbability: true,
    },
    orderBy: { evaluatedAt: "asc" },
  });
}
```

```typescript
// lib/db/queries/platform-status.ts
import { prisma } from "@/lib/db/prisma";

export async function markPlatformHealthy(platform: string) {
  return prisma.platformStatus.upsert({
    where: { platform },
    update: {
      isHealthy: true,
      lastSuccessAt: new Date(),
      consecutiveErrors: 0,
      errorMessage: null,
    },
    create: {
      platform,
      isHealthy: true,
      lastSuccessAt: new Date(),
      consecutiveErrors: 0,
    },
  });
}

export async function markPlatformError(platform: string, error: string) {
  const current = await prisma.platformStatus.findUnique({
    where: { platform },
  });
  const consecutiveErrors = (current?.consecutiveErrors ?? 0) + 1;

  return prisma.platformStatus.upsert({
    where: { platform },
    update: {
      isHealthy: consecutiveErrors < 3,
      lastErrorAt: new Date(),
      errorMessage: error,
      consecutiveErrors,
    },
    create: {
      platform,
      isHealthy: false,
      lastErrorAt: new Date(),
      errorMessage: error,
      consecutiveErrors: 1,
    },
  });
}

export async function getAllPlatformStatuses() {
  return prisma.platformStatus.findMany({ orderBy: { platform: "asc" } });
}
```

### T1.5 — Ejecutar migración inicial

```bash
npx prisma generate
npx prisma migrate dev --name init
```

> Si `DIRECT_URL` no está disponible todavía, usar `npx prisma db push` como alternativa temporal.

## Verificación de Salida (gate)

- [ ] `npx prisma validate` → sin errores
- [ ] `npx prisma generate` → client generado sin errores
- [ ] `lib/db/prisma.ts` exporta `prisma` correctamente
- [ ] `lib/db/queries/` tiene los 3 archivos con tipos correctos
- [ ] `npm run typecheck` → 0 errores

## HANDOFF → Fase 2

```
FASE_COMPLETADA: 1
SCHEMA_PRISMA: prisma/schema.prisma — completo con Auth.js + dominio
PRISMA_CLIENT: lib/db/prisma.ts — singleton con withAccelerate
DB_QUERIES: lib/db/queries/{snapshots,opportunities,platform-status}.ts
MIGRATION: 0001_init aplicada (o db push si no hay DIRECT_URL)
MODELOS_DISPONIBLES: User, Account, Session, VerificationToken, MarketSnapshot, Opportunity, Alert, PlatformStatus, UserConfig
SIGUIENTE_TAREA: Fase 2 — Auth.js v5 config, magic link provider, protección de rutas por capa (sin middleware.ts)
```

---

---

# FASE 2 — Autenticación

## Objetivo

Configurar Auth.js v5 con Prisma Adapter, proveedor magic link via Resend, **protección de rutas por capa** (RSC layout + Route Handlers + Server Actions) y página de login. **Sin `middleware.ts`** — patrón oficialmente soportado en Next.js App Router.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 1
PRISMA_CLIENT: lib/db/prisma.ts
MODELOS_AUTH: User, Account, Session, VerificationToken — en schema
AUTH_VARS_REQUERIDAS: AUTH_SECRET, AUTH_TRUST_HOST, RESEND_API_KEY, RESEND_FROM_EMAIL
PATRON_AUTH: auth() directo en cada capa — NO middleware.ts
```

## Tareas

### T2.1 — Configurar Auth.js v5

```typescript
// lib/auth.ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/db/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Resend({
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@example.com",
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=true",
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
```

### T2.2 — Extender tipos de sesión

```typescript
// types/next-auth.d.ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
```

### T2.3 — API Route handler de Auth.js

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

### T2.4 — Helpers de autenticación por capa

El patrón de protección **no usa `middleware.ts`**. En su lugar, cada capa del sistema llama a `auth()` directamente y decide cómo responder al usuario no autenticado.

```typescript
// lib/auth-helpers.ts

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Para RSC (pages y layouts) — redirige a /login si no hay sesión.
 * Usar en app/(dashboard)/layout.tsx y cualquier page.tsx protegida.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

/**
 * Para Route Handlers (API Routes) — retorna Response 401 si no hay sesión.
 * Usar al inicio de cada POST/GET handler sensible.
 * Si retorna Response, el handler debe retornarla inmediatamente.
 * Si retorna null, la sesión es válida y se puede continuar.
 *
 * Ejemplo de uso:
 *   const unauthorized = await requireAuthApi()
 *   if (unauthorized) return unauthorized
 */
export async function requireAuthApi(): Promise<Response | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

/**
 * Para Server Actions — retorna error estructurado si no hay sesión.
 * Usar al inicio de toda Server Action que mute datos.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Lectura simple de sesión sin redirect — para componentes que renderizan
 * contenido diferente según si hay sesión o no.
 */
export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}
```

### T2.5 — Guard de autenticación en el Layout del dashboard

Este es el punto de protección centralizado para todo el grupo `(dashboard)`. Un único `auth()` en el layout protege automáticamente todas las subrutas hijas.

```typescript
// app/(dashboard)/layout.tsx
// NOTA: Este archivo se crea aquí como stub. La Fase 9 lo completará con sidebar y header.
// El guard de auth debe existir desde esta fase para que las fases posteriores
// no puedan acceder sin autenticación aunque el layout sea incompleto.

import { requireAuth } from '@/lib/auth-helpers'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // auth() llamado directamente aquí — sin middleware.ts
  // Si no hay sesión → redirect('/login') automático
  await requireAuth()

  return (
    <div>
      {/* sidebar y header se añaden en Fase 9 */}
      {children}
    </div>
  )
}
```

> **Importante:** Este layout stub será reemplazado completamente en Fase 9. El `await requireAuth()` **debe mantenerse** en la versión final.

### T2.6 — Página de login

```tsx
// app/(auth)/login/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string; callbackUrl?: string }>;
}) {
  // Si ya está autenticado → redirigir al dashboard
  const session = await auth();
  if (session) redirect("/dashboard");

  const { verify, callbackUrl } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">AIM</h1>
          <p className="text-sm text-muted-foreground">
            Arbitrage Intelligence Monitor
          </p>
        </div>

        {verify ? (
          <div className="rounded-lg border bg-card p-6 text-center space-y-2">
            <p className="font-medium">Revisa tu correo</p>
            <p className="text-sm text-muted-foreground">
              Enviamos un enlace de acceso a tu dirección de email.
            </p>
          </div>
        ) : (
          <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} />
        )}
      </div>
    </main>
  );
}
```

### T2.7 — Componente LoginForm (Client Component)

```tsx
// components/auth/login-form.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signIn("resend", {
        email,
        callbackUrl,
        redirect: true,
      });

      if (result?.error)
        setError("No se pudo enviar el enlace. Inténtalo de nuevo.");
    } catch {
      setError("Error inesperado. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Enviando..." : "Enviar enlace de acceso"}
      </Button>
    </form>
  );
}
```

### T2.8 — Página raíz: redirect al dashboard o login

```typescript
// app/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const session = await auth();
  redirect(session ? "/dashboard" : "/login");
}
```

### T2.9 — Verificar que NO existe middleware.ts

```bash
# Este archivo NO debe existir en el proyecto
ls middleware.ts 2>/dev/null && echo "ERROR: middleware.ts existe — debe eliminarse" || echo "OK: middleware.ts no existe"
```

Si el archivo existe (creado por alguna etapa anterior), eliminarlo:

```bash
rm -f middleware.ts
```

## Matriz de protección de rutas — referencia rápida

| Ruta                     | Archivo responsable                  | Mecanismo                  | Respuesta sin auth                          |
| ------------------------ | ------------------------------------ | -------------------------- | ------------------------------------------- |
| `/dashboard/**`          | `app/(dashboard)/layout.tsx`         | `await requireAuth()`      | `redirect('/login')`                        |
| `/api/evaluate`          | `app/api/evaluate/route.ts`          | `await requireAuthApi()`   | `401 JSON`                                  |
| `/api/cron/trigger`      | `app/api/cron/trigger/route.ts`      | `CRON_SECRET` Bearer       | `401 JSON`                                  |
| `/api/scrape/[platform]` | `app/api/scrape/[platform]/route.ts` | QStash HMAC                | `401 JSON`                                  |
| `/api/opportunities`     | `app/api/opportunities/route.ts`     | Público (Edge)             | `200`                                       |
| `/api/health`            | `app/api/health/route.ts`            | Público                    | `200`                                       |
| `/api/auth/**`           | Auth.js handler                      | Siempre público            | N/A                                         |
| Server Actions           | Cada `lib/actions/*.ts`              | `getAuthenticatedUserId()` | `{ success: false, error: 'Unauthorized' }` |

## Verificación de Salida (gate)

- [ ] `GET /api/auth/providers` → responde con `resend` provider
- [ ] `GET /dashboard` sin sesión → redirige a `/login` (gracias al layout)
- [ ] `GET /login` con sesión activa → redirige a `/dashboard`
- [ ] `ls middleware.ts` → archivo NO existe
- [ ] `npm run typecheck` → 0 errores
- [ ] `types/next-auth.d.ts` extiende `session.user.id: string`
- [ ] `requireAuth()`, `requireAuthApi()`, `getAuthenticatedUserId()` exportados desde `lib/auth-helpers.ts`

## HANDOFF → Fase 3

```
FASE_COMPLETADA: 2
AUTH_CONFIG: lib/auth.ts — NextAuth con PrismaAdapter + Resend provider
AUTH_HELPERS: lib/auth-helpers.ts — requireAuth(), requireAuthApi(), getAuthenticatedUserId(), getSessionUser()
DASHBOARD_LAYOUT_STUB: app/(dashboard)/layout.tsx — await requireAuth() presente, stub para Fase 9
LOGIN_PAGE: app/(auth)/login/page.tsx
ROOT_PAGE: app/page.tsx — redirect a /dashboard o /login
SESSION_STRATEGY: database (no JWT)
MIDDLEWARE_TS: NO EXISTE — protección por capa en cada entry point
AUTH_VARS_REQUERIDAS: AUTH_SECRET, AUTH_TRUST_HOST, RESEND_API_KEY
SIGUIENTE_TAREA: Fase 3 — Schemas Zod y proxy.ts
```

---

---

# FASE 3 — Schemas Zod + proxy.ts

## Objetivo

Crear todos los schemas Zod de validación (contratos de datos del sistema) y el módulo `proxy.ts` que encapsula todas las llamadas HTTP externas. Estos son los cimientos que usan todas las fases siguientes.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 2
PRISMA_MODELS: MarketSnapshot, Opportunity, Alert, PlatformStatus, UserConfig
AUTH: configurado
SIGUIENTE: implementar contratos Zod + proxy HTTP
```

## Tareas

### T3.1 — Schema de snapshots

```typescript
// lib/schemas/snapshot.schema.ts
import { z } from "zod";

export const PlatformEnum = z.enum([
  "binance_spot",
  "binance_p2p",
  "bybit_spot",
  "bybit_p2p",
  "airtm",
  "kontigo",
]);

export const AssetEnum = z.enum(["USDT", "USDC", "BTC", "ETH"]);

export type Platform = z.infer<typeof PlatformEnum>;
export type Asset = z.infer<typeof AssetEnum>;

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
});

export const RawSnapshotInputSchema = MarketSnapshotSchema.omit({
  id: true,
  isStale: true,
});

export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>;
export type RawSnapshotInput = z.infer<typeof RawSnapshotInputSchema>;
```

### T3.2 — Schema de oportunidades

```typescript
// lib/schemas/opportunity.schema.ts
import { z } from "zod";
import { MarketSnapshotSchema } from "./snapshot.schema";
import { UserConfigSchema } from "./user-config.schema";

export const ClassificationEnum = z.enum(["EXECUTABLE", "MARGINAL", "INVALID"]);
export type Classification = z.infer<typeof ClassificationEnum>;

export const OpportunityInputSchema = z.object({
  buySnapshot: MarketSnapshotSchema,
  sellSnapshot: MarketSnapshotSchema,
  capitalAmount: z.number().positive(),
  networkCostUSD: z.number().nonneg().default(0),
  userConfig: UserConfigSchema,
});

export const OpportunityOutputSchema = z.object({
  id: z.string().cuid(),
  route: z.string(),
  buyPlatform: z.string(),
  sellPlatform: z.string(),
  asset: z.string(),
  buyPrice: z.number().positive(),
  sellPrice: z.number().positive(),
  capitalAmount: z.number().positive(),
  roiGross: z.number(),
  feesImpact: z.number(),
  slippageImpact: z.number(),
  networkImpact: z.number(),
  roiAdjusted: z.number(),
  fillProbability: z.number().min(0).max(1),
  liquidityRatio: z.number().min(0),
  latencyRiskMs: z.number().nonneg(),
  classification: ClassificationEnum,
  rejectionReasons: z.array(z.string()).optional(),
  evaluatedAt: z.string().datetime(),
  snapshotAge: z.object({
    buyMs: z.number(),
    sellMs: z.number(),
  }),
});

export type OpportunityInput = z.infer<typeof OpportunityInputSchema>;
export type OpportunityOutput = z.infer<typeof OpportunityOutputSchema>;
```

### T3.3 — Schema de configuración de usuario

```typescript
// lib/schemas/user-config.schema.ts
import { z } from "zod";
import { PlatformEnum, AssetEnum } from "./snapshot.schema";

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
});

export const UserConfigFormSchema = UserConfigSchema.omit({
  id: true,
  userId: true,
  updatedAt: true,
});

export type UserConfig = z.infer<typeof UserConfigSchema>;
export type UserConfigFormInput = z.infer<typeof UserConfigFormSchema>;
```

### T3.4 — Schema de API de scrape

```typescript
// lib/schemas/scrape-api.schema.ts
import { z } from "zod";
import { PlatformEnum, AssetEnum } from "./snapshot.schema";

export const ScrapeRequestSchema = z.object({
  platform: PlatformEnum,
  asset: AssetEnum,
  requestId: z.string().min(1),
});

export const ScrapeResponseSchema = z.object({
  snapshotId: z.string().cuid(),
  price: z.number().positive(),
  latencyMs: z.number().int().nonneg(),
  scrapedAt: z.string().datetime(),
});

export type ScrapeRequest = z.infer<typeof ScrapeRequestSchema>;
export type ScrapeResponse = z.infer<typeof ScrapeResponseSchema>;
```

### T3.5 — proxy.ts completo

```typescript
// lib/proxy.ts

type ProxyRequestOptions = {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  context: string;
};

type ProxySuccess<T> = { ok: true; data: T; latencyMs: number };
type ProxyFailure = {
  ok: false;
  error: string;
  statusCode?: number;
  latencyMs: number;
};
export type ProxyResponse<T> = ProxySuccess<T> | ProxyFailure;

export async function proxyRequest<T>(
  opts: ProxyRequestOptions,
): Promise<ProxyResponse<T>> {
  const start = Date.now();
  const maxRetries = opts.retries ?? 2;
  const retryDelay = opts.retryDelayMs ?? 1000;
  const timeout = opts.timeoutMs ?? 8000;

  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, retryDelay * attempt));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(opts.url, {
        method: opts.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...opts.headers,
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        console.error(
          `[proxy] ${opts.context} attempt=${attempt} error=${lastError}`,
        );

        // No reintentar en errores del cliente (4xx)
        if (res.status >= 400 && res.status < 500) {
          return {
            ok: false,
            error: lastError,
            statusCode: res.status,
            latencyMs,
          };
        }

        continue;
      }

      const data = (await res.json()) as T;
      console.info(
        `[proxy] ${opts.context} OK latency=${latencyMs}ms attempt=${attempt}`,
      );
      return { ok: true, data, latencyMs };
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err.message : "Unknown error";
      console.error(
        `[proxy] ${opts.context} attempt=${attempt} exception=${lastError}`,
      );
    }
  }

  const latencyMs = Date.now() - start;
  return {
    ok: false,
    error: `After ${maxRetries + 1} attempts: ${lastError}`,
    latencyMs,
  };
}
```

### T3.6 — Barrel exports de schemas

```typescript
// lib/schemas/index.ts
export * from "./snapshot.schema";
export * from "./opportunity.schema";
export * from "./user-config.schema";
export * from "./scrape-api.schema";
```

## Verificación de Salida (gate)

- [ ] `npm run typecheck` → 0 errores
- [ ] `PlatformEnum.options` contiene las 6 plataformas
- [ ] `OpportunityOutputSchema` incluye todos los campos del spec
- [ ] `proxyRequest` exportada correctamente desde `lib/proxy.ts`
- [ ] No hay `any` en ningún schema

## HANDOFF → Fase 4

```
FASE_COMPLETADA: 3
SCHEMAS_ZOD: lib/schemas/{snapshot,opportunity,user-config,scrape-api}.schema.ts + index.ts
PROXY: lib/proxy.ts — proxyRequest<T> con retry, timeout, logging
TIPOS_EXPORTADOS: Platform, Asset, Classification, MarketSnapshot, OpportunityInput, OpportunityOutput, UserConfig, UserConfigFormInput
SIGUIENTE_TAREA: Fase 4 — Motor de arbitraje (pipeline de funciones puras)
```

---

---

# FASE 4 — Motor de Arbitraje (Core)

## Objetivo

Implementar el pipeline de evaluación completo: 9 funciones puras encadenadas, sin IO, completamente testeables. Esta es la lógica central del sistema.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 3
SCHEMAS: lib/schemas/index.ts — todos los tipos disponibles
TIPOS_CLAVE:
  - MarketSnapshot (con platform, price, fee, availableLiquidity, latencyMs)
  - OpportunityInput (buySnapshot, sellSnapshot, capitalAmount, networkCostUSD, userConfig)
  - OpportunityOutput (roi breakdown completo, classification, rejectionReasons)
  - UserConfig (minROI, capitalAmount, minFillProbability)
TTL_POR_PLATAFORMA:
  binance_spot/bybit_spot: 30s
  binance_p2p/bybit_p2p: 120s
  airtm/kontigo: 180s
PIPELINE_PASOS: validateFreshness, calcROI, applyFees, slippage, networkCost, liquidity, fillProb, latencyPenalty, classify
```

## Tareas

### T4.1 — Tipos internos del pipeline

```typescript
// lib/arbitrage-engine/types.ts
import type { OpportunityInput, OpportunityOutput } from "@/lib/schemas";

// Estado mutable que fluye por el pipeline
export type EvalContext = {
  input: OpportunityInput;
  output: Partial<OpportunityOutput>;
  rejected: boolean;
  rejectionReasons: string[];
};

export type PipelineStep = (ctx: EvalContext) => EvalContext;

export function createContext(input: OpportunityInput): EvalContext {
  return { input, output: {}, rejected: false, rejectionReasons: [] };
}

export function reject(ctx: EvalContext, reason: string): EvalContext {
  return {
    ...ctx,
    rejected: true,
    rejectionReasons: [...ctx.rejectionReasons, reason],
  };
}

export function applyImpact(
  ctx: EvalContext,
  field: "feesImpact" | "slippageImpact" | "networkImpact",
  value: number,
): EvalContext {
  return { ...ctx, output: { ...ctx.output, [field]: value } };
}

export function pipe(...fns: PipelineStep[]): PipelineStep {
  return (ctx: EvalContext) =>
    fns.reduce((c, fn) => (c.rejected ? c : fn(c)), ctx);
}
```

### T4.2 — Paso 1: validateSnapshotFreshness

```typescript
// lib/arbitrage-engine/steps/validate-freshness.ts
import type { Platform } from "@/lib/schemas";
import { reject, type EvalContext } from "../types";

export const TTL_MS: Record<Platform, number> = {
  binance_spot: 30_000,
  bybit_spot: 30_000,
  binance_p2p: 120_000,
  bybit_p2p: 120_000,
  airtm: 180_000,
  kontigo: 180_000,
};

export function validateSnapshotFreshness(ctx: EvalContext): EvalContext {
  const now = Date.now();
  const buyAge = now - new Date(ctx.input.buySnapshot.scrapedAt).getTime();
  const sellAge = now - new Date(ctx.input.sellSnapshot.scrapedAt).getTime();
  const buyTTL = TTL_MS[ctx.input.buySnapshot.platform];
  const sellTTL = TTL_MS[ctx.input.sellSnapshot.platform];

  if (buyAge > buyTTL || sellAge > sellTTL) {
    return reject(
      ctx,
      `STALE_DATA: buy=${buyAge}ms (ttl=${buyTTL}ms) sell=${sellAge}ms (ttl=${sellTTL}ms)`,
    );
  }

  return {
    ...ctx,
    output: {
      ...ctx.output,
      snapshotAge: { buyMs: buyAge, sellMs: sellAge },
    },
  };
}
```

### T4.3 — Paso 2: calculateGrossROI

```typescript
// lib/arbitrage-engine/steps/calculate-roi.ts
import type { EvalContext } from "../types";

export function calculateGrossROI(ctx: EvalContext): EvalContext {
  const { buySnapshot, sellSnapshot } = ctx.input;
  const roiGross =
    ((sellSnapshot.price - buySnapshot.price) / buySnapshot.price) * 100;

  return { ...ctx, output: { ...ctx.output, roiGross } };
}
```

### T4.4 — Paso 3: applyFeeImpact

```typescript
// lib/arbitrage-engine/steps/apply-fees.ts
import type { EvalContext } from "../types";
import { applyImpact } from "../types";

export function applyFeeImpact(ctx: EvalContext): EvalContext {
  const { buySnapshot, sellSnapshot } = ctx.input;
  // Fees de compra y venta como % del capital
  const feesImpact = (buySnapshot.fee + sellSnapshot.fee) * 100;
  return applyImpact(ctx, "feesImpact", feesImpact);
}
```

### T4.5 — Paso 4: applySlippageModel

```typescript
// lib/arbitrage-engine/steps/slippage-model.ts
import type { EvalContext } from "../types";
import { applyImpact } from "../types";

function calculateSpreadSlippage(ctx: EvalContext): number {
  const { buySnapshot, sellSnapshot } = ctx.input;
  const buySpread =
    buySnapshot.priceAsk && buySnapshot.priceBid
      ? (buySnapshot.priceAsk - buySnapshot.priceBid) / buySnapshot.price
      : 0.001; // spread estimado por defecto: 0.1%
  const sellSpread =
    sellSnapshot.priceAsk && sellSnapshot.priceBid
      ? (sellSnapshot.priceAsk - sellSnapshot.priceBid) / sellSnapshot.price
      : 0.001;
  return (buySpread + sellSpread) * 100; // convertir a %
}

export function applySlippageModel(ctx: EvalContext): EvalContext {
  const { capitalAmount, buySnapshot, sellSnapshot } = ctx.input;
  const minLiquidity = Math.min(
    buySnapshot.availableLiquidity,
    sellSnapshot.availableLiquidity,
  );

  // Evitar división por cero
  const utilizationRatio = minLiquidity > 0 ? capitalAmount / minLiquidity : 10;

  const baseSlippage = calculateSpreadSlippage(ctx);

  // Lineal hasta 30% utilización, exponencial después
  const liquidityPenalty =
    utilizationRatio <= 0.3
      ? utilizationRatio * 0.002 * 100
      : (0.0006 + Math.pow(utilizationRatio - 0.3, 1.5) * 0.05) * 100;

  const slippageImpact = baseSlippage + liquidityPenalty;

  return {
    ...applyImpact(ctx, "slippageImpact", slippageImpact),
    output: {
      ...ctx.output,
      slippageImpact,
      liquidityRatio: minLiquidity > 0 ? minLiquidity / capitalAmount : 0,
    },
  };
}
```

### T4.6 — Paso 5: applyNetworkCost

```typescript
// lib/arbitrage-engine/steps/network-cost.ts
import type { EvalContext } from "../types";
import { applyImpact } from "../types";

export function applyNetworkCost(ctx: EvalContext): EvalContext {
  const { networkCostUSD, capitalAmount } = ctx.input;
  const networkImpact = (networkCostUSD / capitalAmount) * 100;
  return applyImpact(ctx, "networkImpact", networkImpact);
}
```

### T4.7 — Paso 6: evaluateLiquidity

```typescript
// lib/arbitrage-engine/steps/liquidity-eval.ts
import type { EvalContext } from "../types";
import { reject } from "../types";

export function evaluateLiquidity(ctx: EvalContext): EvalContext {
  const { capitalAmount, buySnapshot, sellSnapshot } = ctx.input;
  const minLiquidity = Math.min(
    buySnapshot.availableLiquidity,
    sellSnapshot.availableLiquidity,
  );

  if (minLiquidity < capitalAmount) {
    return reject(
      ctx,
      `INSUFFICIENT_LIQUIDITY: available=${minLiquidity} required=${capitalAmount}`,
    );
  }

  return ctx;
}
```

### T4.8 — Paso 7: scoreFillProbability

```typescript
// lib/arbitrage-engine/steps/fill-probability.ts
import type { EvalContext } from "../types";

export function scoreFillProbability(ctx: EvalContext): EvalContext {
  const { sellSnapshot, capitalAmount } = ctx.input;

  // Spot exchanges: fill garantizado
  if (!sellSnapshot.platform.includes("p2p")) {
    return { ...ctx, output: { ...ctx.output, fillProbability: 1.0 } };
  }

  const { availableLiquidity, volume24h, latencyMs } = sellSnapshot;

  const liquidityScore = Math.min(availableLiquidity / capitalAmount, 1.0);
  const volumeScore =
    volume24h != null ? Math.min(volume24h / (capitalAmount * 5), 1.0) : 0.5;
  const latencyScore =
    latencyMs < 2000 ? 1.0 : Math.max(0, 1 - (latencyMs - 2000) / 10_000);

  const fillProbability =
    liquidityScore * 0.5 + volumeScore * 0.3 + latencyScore * 0.2;

  return { ...ctx, output: { ...ctx.output, fillProbability } };
}
```

### T4.9 — Paso 8: applyLatencyPenalty

```typescript
// lib/arbitrage-engine/steps/latency-penalty.ts
import type { EvalContext } from "../types";

export function applyLatencyPenalty(ctx: EvalContext): EvalContext {
  const { buySnapshot, sellSnapshot } = ctx.input;
  const latencyRiskMs = Math.max(buySnapshot.latencyMs, sellSnapshot.latencyMs);
  return { ...ctx, output: { ...ctx.output, latencyRiskMs } };
}
```

### T4.10 — Paso 9: classify

```typescript
// lib/arbitrage-engine/steps/classify.ts
import { createId } from "@paralleldrive/cuid2";
import type { EvalContext } from "../types";
import { reject } from "../types";

export function classify(ctx: EvalContext): EvalContext {
  const { minROI, minFillProbability } = ctx.input.userConfig;
  const roiGross = ctx.output.roiGross ?? 0;
  const feesImpact = ctx.output.feesImpact ?? 0;
  const slippageImpact = ctx.output.slippageImpact ?? 0;
  const networkImpact = ctx.output.networkImpact ?? 0;
  const roiAdjusted = roiGross - feesImpact - slippageImpact - networkImpact;
  const fillProbability = ctx.output.fillProbability ?? 1.0;
  const liquidityRatio = ctx.output.liquidityRatio ?? 0;

  // Invariante: roiAdjusted debe ser la resta exacta de sus componentes
  // Si difiere > 0.0001%, hay un bug en el pipeline
  const checksum = roiGross - feesImpact - slippageImpact - networkImpact;
  if (Math.abs(checksum - roiAdjusted) > 0.0001) {
    throw new Error(`ROI invariant violated: ${checksum} !== ${roiAdjusted}`);
  }

  let updatedCtx = ctx;

  if (roiAdjusted < 0) {
    updatedCtx = reject(updatedCtx, `ROI_NEGATIVE: ${roiAdjusted.toFixed(4)}%`);
  } else if (roiAdjusted < minROI) {
    updatedCtx = reject(
      updatedCtx,
      `ROI_BELOW_THRESHOLD: ${roiAdjusted.toFixed(2)}% < ${minROI}%`,
    );
  }
  if (fillProbability < 0.5) {
    updatedCtx = reject(
      updatedCtx,
      `LOW_FILL_PROBABILITY: ${fillProbability.toFixed(2)}`,
    );
  }
  if (
    liquidityRatio < 1.0 &&
    !updatedCtx.rejectionReasons.some((r) => r.startsWith("INSUFFICIENT"))
  ) {
    updatedCtx = reject(
      updatedCtx,
      `LIQUIDITY_RATIO_LOW: ${liquidityRatio.toFixed(2)}`,
    );
  }

  const classification = updatedCtx.rejected
    ? "INVALID"
    : roiAdjusted >= minROI && fillProbability >= minFillProbability
      ? "EXECUTABLE"
      : "MARGINAL";

  return {
    ...updatedCtx,
    output: {
      ...updatedCtx.output,
      id: createId(),
      route: `${ctx.input.buySnapshot.platform}→${ctx.input.sellSnapshot.platform}`,
      buyPlatform: ctx.input.buySnapshot.platform,
      sellPlatform: ctx.input.sellSnapshot.platform,
      asset: ctx.input.buySnapshot.asset,
      buyPrice: ctx.input.buySnapshot.price,
      sellPrice: ctx.input.sellSnapshot.price,
      capitalAmount: ctx.input.capitalAmount,
      roiGross,
      feesImpact,
      slippageImpact,
      networkImpact,
      roiAdjusted,
      fillProbability,
      liquidityRatio,
      classification,
      rejectionReasons: updatedCtx.rejectionReasons,
      evaluatedAt: new Date().toISOString(),
    },
  };
}
```

> Instalar `@paralleldrive/cuid2`: `npm install @paralleldrive/cuid2`

### T4.11 — Pipeline orquestador

```typescript
// lib/arbitrage-engine/pipeline.ts
import { createContext, pipe, type EvalContext } from "./types";
import type { OpportunityInput, OpportunityOutput } from "@/lib/schemas";
import { OpportunityOutputSchema } from "@/lib/schemas";
import { validateSnapshotFreshness } from "./steps/validate-freshness";
import { calculateGrossROI } from "./steps/calculate-roi";
import { applyFeeImpact } from "./steps/apply-fees";
import { applySlippageModel } from "./steps/slippage-model";
import { applyNetworkCost } from "./steps/network-cost";
import { evaluateLiquidity } from "./steps/liquidity-eval";
import { scoreFillProbability } from "./steps/fill-probability";
import { applyLatencyPenalty } from "./steps/latency-penalty";
import { classify } from "./steps/classify";

const evaluationPipeline = pipe(
  validateSnapshotFreshness,
  calculateGrossROI,
  applyFeeImpact,
  applySlippageModel,
  applyNetworkCost,
  evaluateLiquidity,
  scoreFillProbability,
  applyLatencyPenalty,
  classify,
);

export function evaluateOpportunity(
  input: OpportunityInput,
): OpportunityOutput {
  const ctx = createContext(input);
  const result = evaluationPipeline(ctx);

  // Validar output con Zod antes de retornar
  const parsed = OpportunityOutputSchema.safeParse(result.output);
  if (!parsed.success) {
    throw new Error(`Pipeline output invalid: ${parsed.error.message}`);
  }

  return parsed.data;
}

// Evaluar todos los pares posibles de un conjunto de snapshots
export function evaluateAllPairs(
  snapshots: import("@/lib/schemas").MarketSnapshot[],
  userConfig: import("@/lib/schemas").UserConfig,
  capitalAmount: number,
  networkCostUSD = 0,
): OpportunityOutput[] {
  const results: OpportunityOutput[] = [];

  for (let i = 0; i < snapshots.length; i++) {
    for (let j = 0; j < snapshots.length; j++) {
      if (i === j) continue;
      const buy = snapshots[i];
      const sell = snapshots[j];
      if (!buy || !sell) continue;
      // Solo evaluar pares del mismo asset
      if (buy.asset !== sell.asset) continue;

      try {
        const output = evaluateOpportunity({
          buySnapshot: buy,
          sellSnapshot: sell,
          capitalAmount,
          networkCostUSD,
          userConfig,
        });
        results.push(output);
      } catch (err) {
        console.error(
          `[engine] pair ${buy.platform}→${sell.platform} error:`,
          err,
        );
      }
    }
  }

  return results;
}
```

### T4.12 — Tests unitarios del motor

```typescript
// __tests__/unit/pipeline.test.ts
import { describe, it, expect } from "vitest";
import { evaluateOpportunity } from "@/lib/arbitrage-engine/pipeline";
import type { OpportunityInput } from "@/lib/schemas";

function makeSnapshot(
  overrides: Partial<import("@/lib/schemas").MarketSnapshot> = {},
): import("@/lib/schemas").MarketSnapshot {
  return {
    id: "cltest000000000000000000",
    platform: "binance_spot",
    asset: "USDT",
    baseCurrency: "USD",
    price: 1.0,
    availableLiquidity: 10_000,
    fee: 0.001,
    latencyMs: 500,
    scrapedAt: new Date().toISOString(),
    isStale: false,
    ...overrides,
  };
}

function makeConfig(): import("@/lib/schemas").UserConfig {
  return {
    id: "clconfig0000000000000000",
    userId: "cluser00000000000000000",
    minROI: 1.5,
    capitalAmount: 1000,
    maxSlippage: 0.005,
    minFillProbability: 0.7,
    enabledPlatforms: ["binance_spot", "bybit_spot"],
    monitoredAssets: ["USDT"],
    alertDedupeWindowMin: 30,
    updatedAt: new Date().toISOString(),
  };
}

// AC-01: Snapshot stale debe ser INVALID
describe("AC-01: Frescura de datos", () => {
  it("rejects stale binance_spot snapshot", () => {
    const staleTime = new Date(Date.now() - 35_000).toISOString(); // 35s ago > 30s TTL

    const input: OpportunityInput = {
      buySnapshot: makeSnapshot({ scrapedAt: staleTime }),
      sellSnapshot: makeSnapshot({ platform: "bybit_spot", price: 1.03 }),
      capitalAmount: 1000,
      networkCostUSD: 0,
      userConfig: makeConfig(),
    };

    const result = evaluateOpportunity(input);
    expect(result.classification).toBe("INVALID");
    expect(result.rejectionReasons).toBeDefined();
    expect(result.rejectionReasons?.some((r) => r.includes("STALE_DATA"))).toBe(
      true,
    );
  });

  it("accepts fresh snapshot within TTL", () => {
    const input: OpportunityInput = {
      buySnapshot: makeSnapshot({ price: 1.0 }),
      sellSnapshot: makeSnapshot({ platform: "bybit_spot", price: 1.05 }),
      capitalAmount: 1000,
      networkCostUSD: 0,
      userConfig: makeConfig(),
    };

    const result = evaluateOpportunity(input);
    expect(result.classification).not.toBe("INVALID"); // puede ser EXECUTABLE o MARGINAL
  });
});

// AC-02: ROI breakdown debe ser auditablemente correcto
describe("AC-02: ROI breakdown auditabilidad", () => {
  it("roiAdjusted equals roiGross minus all impacts", () => {
    const input: OpportunityInput = {
      buySnapshot: makeSnapshot({ price: 1.0, fee: 0.001 }),
      sellSnapshot: makeSnapshot({
        platform: "bybit_spot",
        price: 1.05,
        fee: 0.001,
      }),
      capitalAmount: 1000,
      networkCostUSD: 1, // $1 de costo de red
      userConfig: makeConfig(),
    };

    const result = evaluateOpportunity(input);
    const computed =
      result.roiGross -
      result.feesImpact -
      result.slippageImpact -
      result.networkImpact;
    expect(Math.abs(computed - result.roiAdjusted)).toBeLessThan(0.0001);
  });
});

// AC-04: Slippage no lineal
describe("AC-04: Slippage no lineal", () => {
  it("higher utilization ratio produces higher slippage", () => {
    const config = makeConfig();

    const lowUtilInput: OpportunityInput = {
      buySnapshot: makeSnapshot({ availableLiquidity: 10_000 }),
      sellSnapshot: makeSnapshot({
        platform: "bybit_spot",
        price: 1.05,
        availableLiquidity: 10_000,
      }),
      capitalAmount: 1000, // 10% utilización
      networkCostUSD: 0,
      userConfig: config,
    };

    const highUtilInput: OpportunityInput = {
      buySnapshot: makeSnapshot({ availableLiquidity: 1_200 }),
      sellSnapshot: makeSnapshot({
        platform: "bybit_spot",
        price: 1.05,
        availableLiquidity: 1_200,
      }),
      capitalAmount: 1000, // 83% utilización
      networkCostUSD: 0,
      userConfig: config,
    };

    const lowUtil = evaluateOpportunity(lowUtilInput);
    const highUtil = evaluateOpportunity(highUtilInput);

    expect(highUtil.slippageImpact).toBeGreaterThan(lowUtil.slippageImpact);
  });
});
```

```typescript
// __tests__/unit/slippage.test.ts
import { describe, it, expect } from "vitest";
import { applySlippageModel } from "@/lib/arbitrage-engine/steps/slippage-model";
import { createContext } from "@/lib/arbitrage-engine/types";
import type { OpportunityInput } from "@/lib/schemas";

// Tests granulares del modelo de slippage
describe("Slippage model", () => {
  it("low utilization stays below 0.5%", () => {
    const ctx = createContext({
      buySnapshot: {
        id: "cl1",
        platform: "binance_spot",
        asset: "USDT",
        baseCurrency: "USD",
        price: 1.0,
        availableLiquidity: 50_000,
        fee: 0.001,
        latencyMs: 100,
        scrapedAt: new Date().toISOString(),
        isStale: false,
      },
      sellSnapshot: {
        id: "cl2",
        platform: "bybit_spot",
        asset: "USDT",
        baseCurrency: "USD",
        price: 1.03,
        availableLiquidity: 50_000,
        fee: 0.001,
        latencyMs: 100,
        scrapedAt: new Date().toISOString(),
        isStale: false,
      },
      capitalAmount: 1000, // 2% utilización
      networkCostUSD: 0,
      userConfig: {
        id: "cfg",
        userId: "usr",
        minROI: 1.5,
        capitalAmount: 1000,
        maxSlippage: 0.005,
        minFillProbability: 0.7,
        alertDedupeWindowMin: 30,
        enabledPlatforms: ["binance_spot", "bybit_spot"],
        monitoredAssets: ["USDT"],
        updatedAt: new Date().toISOString(),
      },
    } satisfies OpportunityInput);

    const result = applySlippageModel(ctx);
    expect(result.output.slippageImpact).toBeLessThan(0.5);
  });
});
```

## Verificación de Salida (gate)

- [ ] `npm test` → todos los tests de `__tests__/unit/pipeline.test.ts` passing
- [ ] AC-01 test: snapshot stale → `INVALID` con `STALE_DATA` en rejectionReasons
- [ ] AC-02 test: `|roiAdjusted - (roiGross - sum(impacts))| < 0.0001`
- [ ] AC-04 test: alta utilización → mayor slippageImpact
- [ ] `npm run typecheck` → 0 errores
- [ ] No hay `any` en ningún archivo del engine

## HANDOFF → Fase 5

```
FASE_COMPLETADA: 4
ENGINE_PIPELINE: lib/arbitrage-engine/pipeline.ts — evaluateOpportunity() + evaluateAllPairs()
ENGINE_STEPS: lib/arbitrage-engine/steps/*.ts — 9 pasos implementados
ENGINE_TYPES: lib/arbitrage-engine/types.ts — EvalContext, PipelineStep, pipe(), reject(), applyImpact()
TESTS_PASSING: AC-01, AC-02, AC-04
TTL_REFERENCE: TTL_MS exportado desde validate-freshness.ts
SIGUIENTE_TAREA: Fase 5 — Scrapers de Binance Spot y Bybit Spot usando proxy.ts
```

---

---

# FASE 5 — Scrapers: Binance Spot + Bybit Spot

## Objetivo

Implementar los scrapers de precios spot para Binance y Bybit usando `proxy.ts`. Incluye la interfaz base de scraper y el normalizer que convierte la respuesta cruda al schema `RawSnapshotInput`.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 4
PROXY: lib/proxy.ts — proxyRequest<T>
SCHEMAS: RawSnapshotInput, Platform, Asset
DB_QUERIES: insertSnapshot, markPlatformHealthy, markPlatformError
ENGINE: evaluateOpportunity disponible
```

## Tareas

### T5.1 — Interfaz base de scraper

```typescript
// lib/scrapers/base-scraper.ts
import type { RawSnapshotInput, Platform, Asset } from "@/lib/schemas";

export interface ScraperResult {
  snapshot: RawSnapshotInput;
  raw: unknown; // respuesta original de la API, para metadata
}

export interface Scraper {
  platform: Platform;
  supportedAssets: Asset[];
  scrape(asset: Asset): Promise<ScraperResult>;
}
```

### T5.2 — Scraper Binance Spot

```typescript
// lib/scrapers/binance-spot.ts
import { proxyRequest } from "@/lib/proxy";
import type { Scraper, ScraperResult } from "./base-scraper";
import type { Asset } from "@/lib/schemas";

// Binance ticker endpoint — público, sin auth
const BINANCE_BASE = "https://api.binance.com";

type BinanceTicker = {
  symbol: string;
  price: string;
  bidPrice: string;
  askPrice: string;
  volume: string;
};

type BinanceOrderBook = {
  bids: [string, string][];
  asks: [string, string][];
};

const ASSET_SYMBOL_MAP: Record<Asset, string> = {
  USDT: "USDTUSDC", // USDT/USDC pair para precio en USD
  USDC: "USDCUSDT",
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
};

export const binanceSpotScraper: Scraper = {
  platform: "binance_spot",
  supportedAssets: ["USDT", "USDC", "BTC", "ETH"],

  async scrape(asset: Asset): Promise<ScraperResult> {
    const symbol = ASSET_SYMBOL_MAP[asset];

    const tickerRes = await proxyRequest<BinanceTicker>({
      url: `${BINANCE_BASE}/api/v3/ticker/bookTicker?symbol=${symbol}`,
      context: `binance_spot_${asset}`,
      timeoutMs: 5000,
      retries: 2,
    });

    if (!tickerRes.ok) {
      throw new Error(`Binance Spot scrape failed: ${tickerRes.error}`);
    }

    const ticker = tickerRes.data;
    const bidPrice = parseFloat(ticker.bidPrice);
    const askPrice = parseFloat(ticker.askPrice);
    const midPrice = (bidPrice + askPrice) / 2;

    const snapshot: import("@/lib/schemas").RawSnapshotInput = {
      platform: "binance_spot",
      asset,
      baseCurrency: "USD",
      price: midPrice,
      priceBid: bidPrice,
      priceAsk: askPrice,
      availableLiquidity: 999_999, // Spot exchange — liquidez prácticamente ilimitada
      fee: 0.001, // 0.1% taker fee estándar Binance
      latencyMs: tickerRes.latencyMs,
      scrapedAt: new Date().toISOString(),
      metadata: { symbol, raw: ticker },
    };

    return { snapshot, raw: ticker };
  },
};
```

### T5.3 — Scraper Bybit Spot

```typescript
// lib/scrapers/bybit-spot.ts
import { proxyRequest } from "@/lib/proxy";
import type { Scraper, ScraperResult } from "./base-scraper";
import type { Asset } from "@/lib/schemas";

const BYBIT_BASE = "https://api.bybit.com";

type BybitTickerResponse = {
  retCode: number;
  result: {
    list: Array<{
      symbol: string;
      bid1Price: string;
      ask1Price: string;
      lastPrice: string;
      volume24h: string;
    }>;
  };
};

const ASSET_SYMBOL_MAP: Record<Asset, string> = {
  USDT: "USDTUSDC",
  USDC: "USDCUSDT",
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
};

export const bybitSpotScraper: Scraper = {
  platform: "bybit_spot",
  supportedAssets: ["USDT", "USDC", "BTC", "ETH"],

  async scrape(asset: Asset): Promise<ScraperResult> {
    const symbol = ASSET_SYMBOL_MAP[asset];

    const res = await proxyRequest<BybitTickerResponse>({
      url: `${BYBIT_BASE}/v5/market/tickers?category=spot&symbol=${symbol}`,
      context: `bybit_spot_${asset}`,
      timeoutMs: 5000,
      retries: 2,
    });

    if (!res.ok) throw new Error(`Bybit Spot scrape failed: ${res.error}`);
    if (res.data.retCode !== 0)
      throw new Error(`Bybit API error: retCode=${res.data.retCode}`);

    const ticker = res.data.result.list[0];
    if (!ticker) throw new Error("Bybit: empty ticker response");

    const bidPrice = parseFloat(ticker.bid1Price);
    const askPrice = parseFloat(ticker.ask1Price);
    const midPrice = (bidPrice + askPrice) / 2;
    const volume24h = parseFloat(ticker.volume24h);

    const snapshot: import("@/lib/schemas").RawSnapshotInput = {
      platform: "bybit_spot",
      asset,
      baseCurrency: "USD",
      price: midPrice,
      priceBid: bidPrice,
      priceAsk: askPrice,
      volume24h,
      availableLiquidity: 999_999,
      fee: 0.001, // 0.1% taker fee estándar Bybit
      latencyMs: res.latencyMs,
      scrapedAt: new Date().toISOString(),
      metadata: { symbol, raw: ticker },
    };

    return { snapshot, raw: ticker };
  },
};
```

### T5.4 — Registry de scrapers

```typescript
// lib/scrapers/index.ts
import { binanceSpotScraper } from "./binance-spot";
import { bybitSpotScraper } from "./bybit-spot";
import type { Scraper } from "./base-scraper";
import type { Platform } from "@/lib/schemas";

export const SCRAPERS: Partial<Record<Platform, Scraper>> = {
  binance_spot: binanceSpotScraper,
  bybit_spot: bybitSpotScraper,
  // binance_p2p, bybit_p2p, airtm, kontigo → Fase 2
};

export function getScraper(platform: Platform): Scraper | undefined {
  return SCRAPERS[platform];
}

export * from "./base-scraper";
```

### T5.5 — Función de scrape + persistencia (orquestadora)

```typescript
// lib/scrapers/run-scrape.ts
import { getScraper } from "./index";
import { insertSnapshot } from "@/lib/db/queries/snapshots";
import {
  markPlatformHealthy,
  markPlatformError,
} from "@/lib/db/queries/platform-status";
import type { Platform, Asset } from "@/lib/schemas";

export type RunScrapeResult =
  | { success: true; snapshotId: string; latencyMs: number }
  | { success: false; error: string };

export async function runScrape(
  platform: Platform,
  asset: Asset,
): Promise<RunScrapeResult> {
  const scraper = getScraper(platform);

  if (!scraper) {
    return {
      success: false,
      error: `No scraper registered for platform: ${platform}`,
    };
  }

  if (!scraper.supportedAssets.includes(asset)) {
    return {
      success: false,
      error: `Platform ${platform} does not support asset ${asset}`,
    };
  }

  try {
    const { snapshot } = await scraper.scrape(asset);

    const record = await insertSnapshot({
      ...snapshot,
      scrapedAt: new Date(snapshot.scrapedAt),
      metadata: snapshot.metadata as Record<string, unknown> | undefined,
    });

    await markPlatformHealthy(platform);

    return {
      success: true,
      snapshotId: record.id,
      latencyMs: snapshot.latencyMs,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    await markPlatformError(platform, error);
    return { success: false, error };
  }
}
```

## Verificación de Salida (gate)

- [ ] `npm run typecheck` → 0 errores
- [ ] `binanceSpotScraper.scrape('USDT')` retorna `ScraperResult` con campos requeridos
- [ ] `bybitSpotScraper.scrape('USDT')` retorna `ScraperResult` con campos requeridos
- [ ] `runScrape('binance_spot', 'USDT')` llama a `insertSnapshot` y `markPlatformHealthy`
- [ ] Si Binance API falla → `runScrape` retorna `{ success: false }` y llama a `markPlatformError`
- [ ] No hay llamadas directas a `fetch` — todo pasa por `proxyRequest`

## HANDOFF → Fase 6

```
FASE_COMPLETADA: 5
SCRAPERS: lib/scrapers/{binance-spot,bybit-spot}.ts
SCRAPER_REGISTRY: lib/scrapers/index.ts — SCRAPERS map + getScraper()
RUN_SCRAPE: lib/scrapers/run-scrape.ts — runScrape(platform, asset) → persiste + actualiza PlatformStatus
PLATAFORMAS_ACTIVAS: binance_spot, bybit_spot
PLATAFORMAS_PENDIENTES: binance_p2p, bybit_p2p, airtm, kontigo (Fase 2 del producto)
SIGUIENTE_TAREA: Fase 6 — API Routes /api/scrape/[platform] + /api/cron/trigger + QStash
```

---

---

# FASE 6 — Ingestión: API Routes + QStash + Cron

## Objetivo

Crear el endpoint de scrape invocado por QStash, el trigger de cron de Vercel, y el endpoint de healthcheck. Establecer el ciclo de ingestión automática.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 5
RUN_SCRAPE: lib/scrapers/run-scrape.ts — runScrape(platform, asset)
SCHEMAS: ScrapeRequestSchema, ScrapeResponseSchema
QSTASH_VARS: QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY, QSTASH_URL
CRON_SECRET: env var para autenticar cron trigger con Bearer token
AUTH_PATRON: sin middleware.ts — /api/cron/trigger usa su propia verificación CRON_SECRET
           — /api/scrape/[platform] usa QStash HMAC
```

## Tareas

### T6.1 — Helper de verificación QStash

```typescript
// lib/qstash.ts
import { Receiver } from "@upstash/qstash";

let receiver: Receiver | null = null;

function getReceiver(): Receiver {
  if (!receiver) {
    receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
    });
  }
  return receiver;
}

export async function verifyQStashSignature(
  request: Request,
): Promise<boolean> {
  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;

  try {
    const body = await request.text();
    await getReceiver().verify({ signature, body });
    return true;
  } catch {
    return false;
  }
}
```

### T6.2 — API Route: POST /api/scrape/[platform]

```typescript
// app/api/scrape/[platform]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyQStashSignature } from "@/lib/qstash";
import { runScrape } from "@/lib/scrapers/run-scrape";
import { ScrapeRequestSchema } from "@/lib/schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  // Verificar firma QStash
  const clonedReq = request.clone();
  const isValid = await verifyQStashSignature(clonedReq);
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { platform } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ScrapeRequestSchema.safeParse({ ...body, platform });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { asset, requestId } = parsed.data;

  console.info(
    `[scrape] platform=${platform} asset=${asset} requestId=${requestId}`,
  );

  const result = await runScrape(parsed.data.platform, asset);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json({
    snapshotId: result.snapshotId,
    price: 0, // el precio está en DB, no lo exponemos aquí
    latencyMs: result.latencyMs,
    scrapedAt: new Date().toISOString(),
  });
}
```

### T6.3 — Helper de enqueue QStash

```typescript
// lib/qstash-publisher.ts
import { Client } from "@upstash/qstash";

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    client = new Client({ token: process.env.QSTASH_URL! });
  }
  return client;
}

type EnqueueScrapeJob = {
  platform: string;
  asset: string;
  requestId: string;
  delaySeconds?: number;
};

export async function enqueueScrapeJob(job: EnqueueScrapeJob): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${appUrl}/api/scrape/${job.platform}`;

  await getClient().publishJSON({
    url,
    body: { asset: job.asset, requestId: job.requestId },
    delay: job.delaySeconds ?? 0,
  });
}
```

### T6.4 — API Route: POST /api/cron/trigger

```typescript
// app/api/cron/trigger/route.ts
import { NextRequest, NextResponse } from "next/server";
import { enqueueScrapeJob } from "@/lib/qstash-publisher";
import { createId } from "@paralleldrive/cuid2";

// Bypass Auth.js middleware para machine-to-machine
export const runtime = "nodejs";

const SCRAPE_SCHEDULE: Array<{
  platform: string;
  assets: string[];
  delaySeconds: number;
}> = [
  {
    platform: "binance_spot",
    assets: ["USDT", "USDC", "BTC", "ETH"],
    delaySeconds: 0,
  },
  {
    platform: "bybit_spot",
    assets: ["USDT", "USDC", "BTC", "ETH"],
    delaySeconds: 0,
  },
  // Fase 2:
  // { platform: 'binance_p2p', assets: ['USDT'], delaySeconds: 30 },
  // { platform: 'bybit_p2p',   assets: ['USDT'], delaySeconds: 60 },
  // { platform: 'airtm',       assets: ['USDT'], delaySeconds: 60 },
  // { platform: 'kontigo',     assets: ['USDT'], delaySeconds: 90 },
];

export async function POST(request: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batchId = createId();
  let enqueuedJobs = 0;

  for (const schedule of SCRAPE_SCHEDULE) {
    for (const asset of schedule.assets) {
      await enqueueScrapeJob({
        platform: schedule.platform,
        asset,
        requestId: `${batchId}_${schedule.platform}_${asset}`,
        delaySeconds: schedule.delaySeconds,
      });
      enqueuedJobs++;
    }
  }

  console.info(
    `[cron] trigger batchId=${batchId} enqueuedJobs=${enqueuedJobs}`,
  );

  return NextResponse.json({
    enqueuedJobs,
    scheduledAt: new Date().toISOString(),
    batchId,
  });
}
```

### T6.5 — Nota sobre protección de /api/cron/trigger

Este endpoint **no usa Auth.js ni middleware**. Su protección es exclusivamente mediante el header `Authorization: Bearer {CRON_SECRET}`. Esto es correcto por diseño:

- Vercel Cron invoca el endpoint desde su infraestructura, no desde una sesión de usuario.
- El endpoint verifica el secret al inicio del handler (ya implementado en T6.4).
- No es necesario ningún ajuste en `middleware.ts` porque **ese archivo no existe en el proyecto**.

La matriz de protección completa para los endpoints de esta fase:

| Endpoint                      | Protección                                                       |
| ----------------------------- | ---------------------------------------------------------------- |
| `POST /api/cron/trigger`      | `Authorization: Bearer CRON_SECRET` — verificado en el handler   |
| `POST /api/scrape/[platform]` | QStash HMAC signature — verificado con `verifyQStashSignature()` |
| `GET /api/health`             | Público, sin autenticación                                       |

### T6.6 — Configurar Vercel Cron

Crear `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/trigger",
      "schedule": "* * * * *"
    }
  ]
}
```

### T6.7 — API Route: GET /api/health

```typescript
// app/api/health/route.ts
import { NextResponse } from "next/server";
import { getAllPlatformStatuses } from "@/lib/db/queries/platform-status";

export async function GET() {
  try {
    const statuses = await getAllPlatformStatuses();
    const allHealthy = statuses.every((s) => s.isHealthy);

    return NextResponse.json(
      {
        status: allHealthy ? "ok" : "degraded",
        platforms: statuses,
        timestamp: new Date().toISOString(),
      },
      { status: allHealthy ? 200 : 207 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 },
    );
  }
}
```

## Verificación de Salida (gate)

- [ ] `POST /api/cron/trigger` con header `Authorization: Bearer {CRON_SECRET}` → 200 con `enqueuedJobs: 8` (2 platforms × 4 assets)
- [ ] `POST /api/cron/trigger` sin header → 401
- [ ] `POST /api/scrape/binance_spot` sin QStash signature → 401
- [ ] `GET /api/health` → 200 con `platforms` array
- [ ] `vercel.json` existe con cron schedule `"* * * * *"`
- [ ] `npm run typecheck` → 0 errores

## HANDOFF → Fase 7

```
FASE_COMPLETADA: 6
CRON_ROUTE: app/api/cron/trigger/route.ts — auth via CRON_SECRET Bearer, sin dependencia de Auth.js
SCRAPE_ROUTE: app/api/scrape/[platform]/route.ts — verificación QStash HMAC
HEALTH_ROUTE: app/api/health/route.ts — público
QSTASH_HELPERS: lib/qstash.ts (verifier) + lib/qstash-publisher.ts (client)
VERCEL_CRON: vercel.json configurado — cada minuto
NOTA_AUTH: ningún endpoint de esta fase usa middleware.ts ni Auth.js — protección propia por endpoint
SIGUIENTE_TAREA: Fase 7 — /api/evaluate: correr engine + persistir oportunidades + disparar alertas
```

---

---

# FASE 7 — Motor de Evaluación: API Route

## Objetivo

Crear el endpoint `/api/evaluate` que lee los snapshots recientes, corre el engine sobre todos los pares posibles, persiste las oportunidades en DB, y llama al sistema de alertas para las EXECUTABLE.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 6
ENGINE: evaluateAllPairs(snapshots, userConfig, capitalAmount) → OpportunityOutput[]
DB_QUERIES: getRecentSnapshots, insertOpportunity, getAllPlatformStatuses
TTL_MS: exportado desde lib/arbitrage-engine/steps/validate-freshness.ts
AUTH: requireAuth() disponible en lib/auth-helpers.ts
```

## Tareas

### T7.1 — Query para obtener todos los snapshots recientes

```typescript
// lib/db/queries/snapshots.ts — añadir función
import { TTL_MS } from "@/lib/arbitrage-engine/steps/validate-freshness";
import type { Platform } from "@/lib/schemas";

export async function getAllFreshSnapshots() {
  // El TTL máximo es 180s (kontigo/airtm). Pedimos snapshots de los últimos 200s
  // El engine filtrará por TTL específico de cada plataforma
  const since = new Date(Date.now() - 200_000);

  const records = await prisma.marketSnapshot.findMany({
    where: { scrapedAt: { gte: since } },
    orderBy: { scrapedAt: "desc" },
    // Tomar solo el snapshot más reciente por (platform, asset)
    distinct: ["platform", "asset"],
  });

  return records;
}
```

### T7.2 — Query para obtener la configuración del usuario del sistema

```typescript
// lib/db/queries/user-config.ts
import { prisma } from "@/lib/db/prisma";
import type { UserConfig } from "@/lib/schemas";

export async function getUserConfig(
  userId: string,
): Promise<UserConfig | null> {
  const config = await prisma.userConfig.findUnique({
    where: { userId },
  });

  if (!config) return null;

  return {
    id: config.id,
    userId: config.userId,
    minROI: config.minROI,
    capitalAmount: config.capitalAmount,
    maxSlippage: config.maxSlippage,
    minFillProbability: config.minFillProbability,
    alertEmail: config.alertEmail ?? undefined,
    alertTelegram: config.alertTelegram ?? undefined,
    alertDedupeWindowMin: config.alertDedupeWindowMin,
    enabledPlatforms: config.enabledPlatforms as UserConfig["enabledPlatforms"],
    monitoredAssets: config.monitoredAssets as UserConfig["monitoredAssets"],
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function getOrCreateDefaultUserConfig(
  userId: string,
): Promise<UserConfig> {
  const existing = await getUserConfig(userId);
  if (existing) return existing;

  const created = await prisma.userConfig.create({
    data: {
      userId,
      enabledPlatforms: ["binance_spot", "bybit_spot"],
      monitoredAssets: ["USDT"],
    },
  });

  return {
    id: created.id,
    userId: created.userId,
    minROI: created.minROI,
    capitalAmount: created.capitalAmount,
    maxSlippage: created.maxSlippage,
    minFillProbability: created.minFillProbability,
    alertEmail: created.alertEmail ?? undefined,
    alertTelegram: created.alertTelegram ?? undefined,
    alertDedupeWindowMin: created.alertDedupeWindowMin,
    enabledPlatforms:
      created.enabledPlatforms as UserConfig["enabledPlatforms"],
    monitoredAssets: created.monitoredAssets as UserConfig["monitoredAssets"],
    updatedAt: created.updatedAt.toISOString(),
  };
}
```

### T7.3 — Función de normalización DB → MarketSnapshot

```typescript
// lib/db/normalize.ts
import type { MarketSnapshot } from "@/lib/schemas";
import type { MarketSnapshot as PrismaSnapshot } from "@prisma/client";

export function dbSnapshotToSchema(record: PrismaSnapshot): MarketSnapshot {
  return {
    id: record.id,
    platform: record.platform as MarketSnapshot["platform"],
    asset: record.asset as MarketSnapshot["asset"],
    baseCurrency: record.baseCurrency,
    price: record.price,
    priceAsk: record.priceAsk ?? undefined,
    priceBid: record.priceBid ?? undefined,
    volume24h: record.volume24h ?? undefined,
    availableLiquidity: record.availableLiquidity,
    fee: record.fee,
    latencyMs: record.latencyMs,
    scrapedAt: record.scrapedAt.toISOString(),
    isStale: false, // fresh por construcción (viene de getAllFreshSnapshots)
    metadata: record.metadata as Record<string, unknown> | undefined,
  };
}
```

### T7.4 — API Route: POST /api/evaluate

```typescript
// app/api/evaluate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuthApi } from "@/lib/auth-helpers";
import { getAllFreshSnapshots } from "@/lib/db/queries/snapshots";
import { getOrCreateDefaultUserConfig } from "@/lib/db/queries/user-config";
import { insertOpportunity } from "@/lib/db/queries/opportunities";
import { dbSnapshotToSchema } from "@/lib/db/normalize";
import { evaluateAllPairs } from "@/lib/arbitrage-engine/pipeline";
import { processAlerts } from "@/lib/alerts/email";

export async function POST(request: NextRequest) {
  const start = Date.now();

  // Protección de ruta: sin middleware.ts — verificación directa en el handler.
  // Dos caminos válidos para llamar a este endpoint:
  //   1. Sesión Auth.js (usuario desde dashboard)
  //   2. CRON_SECRET Bearer (invocación automática post-scrape)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isCronCall = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronCall) {
    // Si no es llamada de cron, verificar sesión Auth.js
    const unauthorized = await requireAuthApi();
    if (unauthorized) return unauthorized;
  }

  // 1. Obtener snapshots frescos
  const dbSnapshots = await getAllFreshSnapshots();
  const snapshots = dbSnapshots.map(dbSnapshotToSchema);

  if (snapshots.length < 2) {
    return NextResponse.json({
      evaluatedPairs: 0,
      opportunities: { executable: 0, marginal: 0, invalid: 0 },
      alertsSent: 0,
      durationMs: Date.now() - start,
      message: "Insufficient snapshots for evaluation",
    });
  }

  // 2. Obtener configuración del usuario (usar el primer user del sistema para MVP single-user)
  // En Fase 3 (multi-usuario) esto iterará por usuario
  const firstUser = await (
    await import("@/lib/db/prisma")
  ).prisma.user.findFirst();
  if (!firstUser) {
    return NextResponse.json({ error: "No users in system" }, { status: 500 });
  }

  const userConfig = await getOrCreateDefaultUserConfig(firstUser.id);

  // 3. Correr el engine
  const opportunities = evaluateAllPairs(
    snapshots,
    userConfig,
    userConfig.capitalAmount,
  );

  // 4. Persistir oportunidades
  const persistPromises = opportunities.map((opp) =>
    insertOpportunity({
      route: opp.route,
      buyPlatform: opp.buyPlatform,
      sellPlatform: opp.sellPlatform,
      asset: opp.asset,
      buyPrice: opp.buyPrice,
      sellPrice: opp.sellPrice,
      capitalAmount: opp.capitalAmount,
      roiGross: opp.roiGross,
      feesImpact: opp.feesImpact,
      slippageImpact: opp.slippageImpact,
      networkImpact: opp.networkImpact,
      roiAdjusted: opp.roiAdjusted,
      fillProbability: opp.fillProbability,
      liquidityRatio: opp.liquidityRatio,
      latencyRiskMs: opp.latencyRiskMs,
      snapshotAgeBuyMs: opp.snapshotAge.buyMs,
      snapshotAgeSellMs: opp.snapshotAge.sellMs,
      classification: opp.classification,
      rejectionReasons: opp.rejectionReasons ?? [],
      evaluatedAt: new Date(opp.evaluatedAt),
    }),
  );

  const persistedOpportunities = await Promise.allSettled(persistPromises);
  const persistedIds = persistedOpportunities
    .filter(
      (
        r,
      ): r is PromiseFulfilledResult<
        Awaited<ReturnType<typeof insertOpportunity>>
      > => r.status === "fulfilled",
    )
    .map((r) => r.value.id);

  // 5. Disparar alertas para EXECUTABLE
  const executableOpps = opportunities.filter(
    (o) => o.classification === "EXECUTABLE",
  );
  let alertsSent = 0;

  if (executableOpps.length > 0) {
    alertsSent = await processAlerts(executableOpps, userConfig);
  }

  const counts = {
    executable: opportunities.filter((o) => o.classification === "EXECUTABLE")
      .length,
    marginal: opportunities.filter((o) => o.classification === "MARGINAL")
      .length,
    invalid: opportunities.filter((o) => o.classification === "INVALID").length,
  };

  console.info(
    `[evaluate] pairs=${opportunities.length} exec=${counts.executable} alertsSent=${alertsSent} duration=${Date.now() - start}ms`,
  );

  return NextResponse.json({
    evaluatedPairs: opportunities.length,
    opportunities: counts,
    alertsSent,
    persistedIds,
    durationMs: Date.now() - start,
  });
}
```

### T7.5 — API Route: GET /api/opportunities (Edge Runtime)

```typescript
// app/api/opportunities/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getOpportunities } from "@/lib/db/queries/opportunities";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const classification = searchParams.get("classification") ?? "ALL";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const cursor = searchParams.get("cursor") ?? undefined;
  const since = searchParams.get("since")
    ? new Date(searchParams.get("since")!)
    : undefined;

  const rows = await getOpportunities({
    classification: classification === "ALL" ? undefined : classification,
    limit,
    cursor,
    since,
  });

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

  return NextResponse.json({
    data,
    meta: { total: data.length, hasMore, nextCursor },
  });
}
```

## Verificación de Salida (gate)

- [ ] `POST /api/evaluate` con sesión activa → 200 con `{ evaluatedPairs, opportunities, durationMs }`
- [ ] `durationMs` < 2000ms con 8 snapshots (AC-06 en condiciones normales)
- [ ] Oportunidades persistidas aparecen en `GET /api/opportunities`
- [ ] `npm run typecheck` → 0 errores

## HANDOFF → Fase 8

```
FASE_COMPLETADA: 7
EVALUATE_ROUTE: app/api/evaluate/route.ts — lee snapshots, corre engine, persiste, dispara alertas
OPPORTUNITIES_ROUTE: app/api/opportunities/route.ts — Edge Runtime, paginado con cursor
DB_QUERIES_NUEVAS: getAllFreshSnapshots, getUserConfig, getOrCreateDefaultUserConfig
NORMALIZE: lib/db/normalize.ts — dbSnapshotToSchema()
ALERT_STUB: processAlerts() llamado pero aún no implementado (Fase 8)
SIGUIENTE_TAREA: Fase 8 — Sistema de alertas: Resend + React Email + deduplicación
```

---

---

# FASE 8 — Sistema de Alertas

## Objetivo

Implementar el sistema de alertas completo: `shouldSendAlert` con deduplicación, template React Email, envío via Resend, y la función `processAlerts` que el evaluate route ya llama.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 7
EVALUATE_ROUTE: llama processAlerts(executableOpps, userConfig) — debe existir en lib/alerts/email.ts
TIPOS: OpportunityOutput, UserConfig
RESEND_VARS: RESEND_API_KEY, RESEND_FROM_EMAIL
DB: tabla alerts con fields: opportunityId, channel, recipient, sentAt, status
OPORTUNIDAD_PERSISTIDA: las opps ya están en DB cuando se llama processAlerts (sus IDs están en persistedIds)
```

## Tareas

### T8.1 — Lógica de deduplicación

```typescript
// lib/alerts/dedup.ts
import { prisma } from "@/lib/db/prisma";

export async function isAlertDuplicate(
  route: string,
  recipient: string,
  dedupeWindowMin: number,
): Promise<boolean> {
  const since = new Date(Date.now() - dedupeWindowMin * 60_000);

  const existing = await prisma.alert.findFirst({
    where: {
      recipient,
      status: "sent",
      sentAt: { gte: since },
      opportunity: { route },
    },
  });

  return existing !== null;
}

export async function recordAlert(
  opportunityId: string,
  channel: string,
  recipient: string,
  status: "sent" | "failed" | "deduped",
): Promise<void> {
  await prisma.alert.create({
    data: { opportunityId, channel, recipient, status },
  });
}
```

### T8.2 — Template React Email

```tsx
// emails/opportunity-alert.tsx
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Section,
  Row,
  Column,
  Text,
  Hr,
  Button,
} from "@react-email/components";
import type { OpportunityOutput } from "@/lib/schemas";

type Props = {
  opportunity: OpportunityOutput;
  appUrl: string;
};

export function OpportunityAlertEmail({ opportunity, appUrl }: Props) {
  const classColor =
    opportunity.classification === "EXECUTABLE" ? "#16a34a" : "#d97706";

  return (
    <Html>
      <Head />
      <Preview>
        ⚡ {opportunity.route} → ROI {opportunity.roiAdjusted.toFixed(2)}%
      </Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}
        >
          <Heading style={{ fontSize: 20, color: "#111827" }}>
            Oportunidad Detectada
          </Heading>

          <Section
            style={{
              backgroundColor: "#fff",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              padding: "16px 20px",
              marginBottom: 16,
            }}
          >
            <Row>
              <Column style={{ color: "#6b7280", fontSize: 13 }}>Ruta</Column>
              <Column style={{ fontWeight: 600, textAlign: "right" }}>
                {opportunity.route}
              </Column>
            </Row>
            <Hr style={{ borderColor: "#f3f4f6", margin: "10px 0" }} />
            <Row>
              <Column style={{ color: "#6b7280", fontSize: 13 }}>
                Clasificación
              </Column>
              <Column
                style={{
                  color: classColor,
                  fontWeight: 700,
                  textAlign: "right",
                }}
              >
                {opportunity.classification}
              </Column>
            </Row>
            <Hr style={{ borderColor: "#f3f4f6", margin: "10px 0" }} />
            <Row>
              <Column style={{ color: "#6b7280", fontSize: 13 }}>
                ROI Ajustado
              </Column>
              <Column
                style={{
                  color: "#16a34a",
                  fontWeight: 700,
                  textAlign: "right",
                  fontSize: 18,
                }}
              >
                {opportunity.roiAdjusted.toFixed(2)}%
              </Column>
            </Row>
            <Hr style={{ borderColor: "#f3f4f6", margin: "10px 0" }} />
            <Row>
              <Column style={{ color: "#6b7280", fontSize: 13 }}>
                Fill Probability
              </Column>
              <Column style={{ textAlign: "right" }}>
                {(opportunity.fillProbability * 100).toFixed(0)}%
              </Column>
            </Row>
          </Section>

          <Section
            style={{
              backgroundColor: "#f9fafb",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              padding: "14px 20px",
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              Desglose ROI:
            </Text>
            <Text style={{ fontSize: 13, margin: "2px 0" }}>
              Bruto: <strong>{opportunity.roiGross.toFixed(3)}%</strong>
            </Text>
            <Text style={{ fontSize: 13, margin: "2px 0", color: "#dc2626" }}>
              − Fees: {opportunity.feesImpact.toFixed(3)}%
            </Text>
            <Text style={{ fontSize: 13, margin: "2px 0", color: "#dc2626" }}>
              − Slippage: {opportunity.slippageImpact.toFixed(3)}%
            </Text>
            <Text style={{ fontSize: 13, margin: "2px 0", color: "#dc2626" }}>
              − Red: {opportunity.networkImpact.toFixed(3)}%
            </Text>
            <Hr style={{ borderColor: "#e5e7eb", margin: "8px 0" }} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#16a34a",
                margin: 0,
              }}
            >
              = Ajustado: {opportunity.roiAdjusted.toFixed(2)}%
            </Text>
          </Section>

          <Button
            href={`${appUrl}/dashboard`}
            style={{
              backgroundColor: "#2563eb",
              color: "#fff",
              borderRadius: 6,
              padding: "10px 20px",
              fontSize: 14,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Ver en Dashboard →
          </Button>

          <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 24 }}>
            Evaluado:{" "}
            {new Date(opportunity.evaluatedAt).toLocaleString("es-VE")}.
            Antigüedad — buy: {opportunity.snapshotAge.buyMs}ms, sell:{" "}
            {opportunity.snapshotAge.sellMs}ms. Este email fue generado
            automáticamente por AIM.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

### T8.3 — Función processAlerts (Resend)

```typescript
// lib/alerts/email.ts
import { Resend } from "resend";
import { render } from "@react-email/render";
import { OpportunityAlertEmail } from "@/emails/opportunity-alert";
import { isAlertDuplicate, recordAlert } from "./dedup";
import { prisma } from "@/lib/db/prisma";
import type { OpportunityOutput, UserConfig } from "@/lib/schemas";

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY!);
  return resend;
}

export async function processAlerts(
  opportunities: OpportunityOutput[],
  config: UserConfig,
): Promise<number> {
  const recipient = config.alertEmail;
  if (!recipient) return 0;

  let sent = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  for (const opp of opportunities) {
    if (opp.classification !== "EXECUTABLE") continue;
    if (opp.roiAdjusted < config.minROI) continue;

    const isDupe = await isAlertDuplicate(
      opp.route,
      recipient,
      config.alertDedupeWindowMin,
    );

    // Buscar el ID persistido en DB para la alerta
    const persistedOpp = await prisma.opportunity.findFirst({
      where: {
        route: opp.route,
        evaluatedAt: { gte: new Date(Date.now() - 5000) },
      },
      orderBy: { evaluatedAt: "desc" },
    });

    if (isDupe) {
      if (persistedOpp) {
        await recordAlert(persistedOpp.id, "email", recipient, "deduped");
      }
      continue;
    }

    try {
      const html = await render(
        OpportunityAlertEmail({ opportunity: opp, appUrl }),
      );

      const result = await getResend().emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "alerts@example.com",
        to: recipient,
        subject: `⚡ AIM: ${opp.route} → ROI ${opp.roiAdjusted.toFixed(2)}%`,
        html,
      });

      if (result.error) {
        console.error(`[alerts] Resend error for ${opp.route}:`, result.error);
        if (persistedOpp)
          await recordAlert(persistedOpp.id, "email", recipient, "failed");
      } else {
        if (persistedOpp)
          await recordAlert(persistedOpp.id, "email", recipient, "sent");
        sent++;
        console.info(
          `[alerts] sent for route=${opp.route} roi=${opp.roiAdjusted.toFixed(2)}%`,
        );
      }
    } catch (err) {
      console.error(`[alerts] exception for ${opp.route}:`, err);
      if (persistedOpp)
        await recordAlert(persistedOpp.id, "email", recipient, "failed");
    }
  }

  return sent;
}
```

### T8.4 — Test de deduplicación (AC-03)

```typescript
// __tests__/unit/dedup.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { isAlertDuplicate } from "@/lib/alerts/dedup";

// Mock del cliente Prisma
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    alert: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("AC-03: Deduplicación de alertas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when recent alert exists within window", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.alert.findFirst).mockResolvedValueOnce({
      id: "cl1",
      opportunityId: "cl2",
      channel: "email",
      recipient: "test@test.com",
      sentAt: new Date(Date.now() - 15 * 60_000), // 15 min ago
      status: "sent",
    });

    const result = await isAlertDuplicate(
      "binance_spot→bybit_p2p",
      "test@test.com",
      30, // 30 min window
    );

    expect(result).toBe(true);
  });

  it("returns false when no recent alert exists", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.alert.findFirst).mockResolvedValueOnce(null);

    const result = await isAlertDuplicate(
      "binance_spot→bybit_p2p",
      "test@test.com",
      30,
    );

    expect(result).toBe(false);
  });
});
```

## Verificación de Salida (gate)

- [ ] `npm test -- dedup` → 2 tests passing (AC-03)
- [ ] `processAlerts([...EXECUTABLEs], config)` retorna número de emails enviados
- [ ] Email template renderiza sin errores (`render()` no lanza)
- [ ] Oportunidad MARGINAL en `opportunities` → NO dispara alerta
- [ ] `npm run typecheck` → 0 errores

## HANDOFF → Fase 9

```
FASE_COMPLETADA: 8
ALERTS_EMAIL: lib/alerts/email.ts — processAlerts() con Resend + deduplicación
ALERTS_DEDUP: lib/alerts/dedup.ts — isAlertDuplicate() + recordAlert()
EMAIL_TEMPLATE: emails/opportunity-alert.tsx — React Email
TESTS_PASSING: AC-03
CICLO_COMPLETO: Cron → Scrape → Evaluate → Alerts funciona end-to-end
SIGUIENTE_TAREA: Fase 9 — Dashboard layout, sidebar, auth guard, estructura visual
```

---

---

# FASE 9 — Dashboard: Layout y Estructura

## Objetivo

Completar el layout del dashboard con sidebar, navegación, y header. El guard de autenticación ya fue instalado en Fase 2 (`await requireAuth()` en el layout stub). Esta fase **reemplaza el stub** con la versión completa — manteniendo el guard.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 8
AUTH_HELPERS: requireAuth() — hace redirect('/login') si no hay sesión
DASHBOARD_LAYOUT_STUB: app/(dashboard)/layout.tsx — contiene await requireAuth(), stub sin UI
SHADCN_COMPONENTS: button, card, badge, table, sidebar, sheet, separator — instalados
TAILWIND_4: theme en globals.css con brand colors
PATRON_AUTH: sin middleware.ts — el layout.tsx es el guard centralizado del grupo (dashboard)
```

## Tareas

### T9.1 — Layout del dashboard completo (reemplaza stub de Fase 2)

```tsx
// app/(dashboard)/layout.tsx
// REEMPLAZA el stub creado en Fase 2.
// CRÍTICO: await requireAuth() debe mantenerse — es el guard centralizado del grupo.
// Sin middleware.ts, este layout.tsx es la única barrera de protección
// para todas las rutas bajo (dashboard)/.

import { requireAuth } from "@/lib/auth-helpers";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard centralizado — sin middleware.ts, esta línea es la protección del grupo completo.
  // Si se elimina accidentalmente, todas las rutas del dashboard quedan expuestas.
  const session = await requireAuth();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <DashboardSidebar />
      <div className="flex flex-1 flex-col">
        <DashboardHeader user={session.user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

### T9.2 — Sidebar de navegación

```tsx
// components/dashboard/sidebar.tsx
import Link from "next/link";
import { BarChart3, Settings, Activity, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Monitor", icon: Activity },
  { href: "/dashboard/opportunities", label: "Historial", icon: BarChart3 },
  { href: "/dashboard/config", label: "Configuración", icon: Settings },
];

export function DashboardSidebar() {
  return (
    <aside className="w-56 shrink-0 border-r bg-card flex flex-col">
      <div className="flex items-center gap-2 px-4 py-5 border-b">
        <Shield className="w-5 h-5 text-brand-primary" />
        <span className="font-semibold text-sm tracking-tight">AIM</span>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              "transition-colors",
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t">
        <p className="text-xs text-muted-foreground px-3">
          Arbitrage Intelligence Monitor
        </p>
      </div>
    </aside>
  );
}
```

### T9.3 — Header con info de usuario y sign out

```tsx
// components/dashboard/header.tsx
"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import type { Session } from "next-auth";

type Props = {
  user: Session["user"];
};

export function DashboardHeader({ user }: Props) {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6">
      <div /> {/* Spacer */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user.email}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Salir
        </Button>
      </div>
    </header>
  );
}
```

### T9.4 — Página raíz del dashboard (placeholder para Fase 10)

```tsx
// app/(dashboard)/page.tsx
import { requireAuth } from "@/lib/auth-helpers";

export default async function DashboardPage() {
  await requireAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Monitor</h1>
      <p className="text-muted-foreground text-sm">
        El dashboard se completará en la siguiente fase.
      </p>
    </div>
  );
}
```

### T9.5 — Instalar lucide-react si no está

```bash
npm install lucide-react
```

## Verificación de Salida (gate)

- [ ] `GET /dashboard` con sesión → renderiza layout con sidebar + header
- [ ] `GET /dashboard` sin sesión → redirige a `/login` (vía `requireAuth()` en layout)
- [ ] `ls middleware.ts` → archivo NO existe (confirmar ausencia)
- [ ] Sidebar muestra 3 links: Monitor, Historial, Configuración
- [ ] Header muestra email del usuario y botón "Salir"
- [ ] `npm run typecheck` → 0 errores

## HANDOFF → Fase 10

```
FASE_COMPLETADA: 9
LAYOUT: app/(dashboard)/layout.tsx — RSC con requireAuth() guard centralizado (reemplazó stub de Fase 2)
SIDEBAR: components/dashboard/sidebar.tsx — nav links
HEADER: components/dashboard/header.tsx — user info + signOut (Client)
DASHBOARD_PAGE: app/(dashboard)/page.tsx — placeholder listo para Fase 10
MIDDLEWARE_TS: confirmar ausencia — NO existe en el proyecto
SIGUIENTE_TAREA: Fase 10 — Página de oportunidades: RSC + cards + filtros Zustand
```

---

---

# FASE 10 — Dashboard: Oportunidades + Zustand

## Objetivo

Implementar el dashboard principal y la página de historial de oportunidades. RSC para carga inicial, Zustand para filtros cliente, ClassificationBadge y OpportunityCard como componentes reutilizables.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 9
LAYOUT: dashboard layout con sidebar funcional
DB_QUERIES: getOpportunities(opts), getOpportunityStats(opts)
ZUSTAND: instalado, lib/store/dashboard.store.ts aún vacío
SHADCN: card, badge, table disponibles
```

## Tareas

### T10.1 — Zustand store del dashboard

```typescript
// lib/store/dashboard.store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserConfigFormInput } from "@/lib/schemas";

type Classification = "ALL" | "EXECUTABLE" | "MARGINAL" | "INVALID";

type Notification = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
};

type DashboardStore = {
  activeClassification: Classification;
  setClassification: (c: Classification) => void;

  localConfig: Partial<UserConfigFormInput>;
  setLocalConfig: (patch: Partial<UserConfigFormInput>) => void;
  isDirty: boolean;
  markClean: () => void;

  notifications: Notification[];
  addNotification: (n: Omit<Notification, "id">) => void;
  dismissNotification: (id: string) => void;
};

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      activeClassification: "ALL",
      setClassification: (c) => set({ activeClassification: c }),

      localConfig: {},
      setLocalConfig: (patch) =>
        set((s) => ({
          localConfig: { ...s.localConfig, ...patch },
          isDirty: true,
        })),
      isDirty: false,
      markClean: () => set({ isDirty: false }),

      notifications: [],
      addNotification: (n) =>
        set((s) => ({
          notifications: [
            ...s.notifications,
            { ...n, id: Math.random().toString(36).slice(2) },
          ],
        })),
      dismissNotification: (id) =>
        set((s) => ({
          notifications: s.notifications.filter((n) => n.id !== id),
        })),
    }),
    {
      name: "aim-dashboard",
      partialize: (s) => ({ activeClassification: s.activeClassification }),
    },
  ),
);
```

### T10.2 — ClassificationBadge

```tsx
// components/dashboard/classification-badge.tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Classification } from "@/lib/schemas";

const STYLES: Record<Classification, string> = {
  EXECUTABLE: "bg-success/15 text-success border-success/30",
  MARGINAL: "bg-warning/15 text-warning border-warning/30",
  INVALID: "bg-muted text-muted-foreground border-muted",
};

const LABELS: Record<Classification, string> = {
  EXECUTABLE: "✓ Ejecutable",
  MARGINAL: "~ Marginal",
  INVALID: "✗ Inválido",
};

export function ClassificationBadge({
  classification,
}: {
  classification: Classification;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", STYLES[classification])}
    >
      {LABELS[classification]}
    </Badge>
  );
}
```

### T10.3 — OpportunityCard

```tsx
// components/dashboard/opportunity-card.tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ClassificationBadge } from "./classification-badge";
import type { OpportunityOutput } from "@/lib/schemas";

export function OpportunityCard({
  opportunity,
}: {
  opportunity: OpportunityOutput;
}) {
  const age = Date.now() - new Date(opportunity.evaluatedAt).getTime();
  const ageLabel =
    age < 60_000
      ? `hace ${Math.round(age / 1000)}s`
      : `hace ${Math.round(age / 60_000)}min`;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div>
          <p className="font-mono text-sm font-semibold">{opportunity.route}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{ageLabel}</p>
        </div>
        <ClassificationBadge
          classification={
            opportunity.classification as import("@/lib/schemas").Classification
          }
        />
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* ROI */}
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">ROI Ajustado</span>
          <span
            className={`text-lg font-bold ${
              opportunity.roiAdjusted >= 0 ? "text-success" : "text-destructive"
            }`}
          >
            {opportunity.roiAdjusted.toFixed(2)}%
          </span>
        </div>

        {/* ROI Breakdown */}
        <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
          <div className="flex justify-between">
            <span>Bruto</span>
            <span>{opportunity.roiGross.toFixed(3)}%</span>
          </div>
          <div className="flex justify-between text-destructive/70">
            <span>− Fees</span>
            <span>{opportunity.feesImpact.toFixed(3)}%</span>
          </div>
          <div className="flex justify-between text-destructive/70">
            <span>− Slippage</span>
            <span>{opportunity.slippageImpact.toFixed(3)}%</span>
          </div>
          <div className="flex justify-between text-destructive/70">
            <span>− Red</span>
            <span>{opportunity.networkImpact.toFixed(3)}%</span>
          </div>
        </div>

        {/* Fill probability + prices */}
        <div className="flex gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Fill Prob </span>
            <span className="font-medium">
              {(opportunity.fillProbability * 100).toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Compra </span>
            <span className="font-medium">
              ${opportunity.buyPrice.toFixed(4)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Venta </span>
            <span className="font-medium">
              ${opportunity.sellPrice.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Rejection reasons */}
        {opportunity.rejectionReasons &&
          opportunity.rejectionReasons.length > 0 && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              {opportunity.rejectionReasons.map((r, i) => (
                <p key={i} className="font-mono text-[10px]">
                  {r}
                </p>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}
```

### T10.4 — Filtros de clasificación (Client Component)

```tsx
// components/dashboard/classification-filter.tsx
"use client";

import { useDashboardStore } from "@/lib/store/dashboard.store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS = ["ALL", "EXECUTABLE", "MARGINAL", "INVALID"] as const;

export function ClassificationFilter() {
  const { activeClassification, setClassification } = useDashboardStore();

  return (
    <div className="flex gap-2 flex-wrap">
      {OPTIONS.map((opt) => (
        <Button
          key={opt}
          variant={activeClassification === opt ? "default" : "outline"}
          size="sm"
          onClick={() => setClassification(opt)}
          className={cn("text-xs", activeClassification === opt && "shadow-sm")}
        >
          {opt}
        </Button>
      ))}
    </div>
  );
}
```

### T10.5 — Página principal del dashboard (RSC)

```tsx
// app/(dashboard)/page.tsx
import { requireAuth } from "@/lib/auth-helpers";
import { getOpportunities } from "@/lib/db/queries/opportunities";
import { getAllPlatformStatuses } from "@/lib/db/queries/platform-status";
import { OpportunityCard } from "@/components/dashboard/opportunity-card";
import { ClassificationFilter } from "@/components/dashboard/classification-filter";
import { PlatformStatusBar } from "@/components/dashboard/platform-status";
import type { OpportunityOutput } from "@/lib/schemas";

export const revalidate = 30; // revalidar cada 30s

export default async function DashboardPage() {
  await requireAuth();

  const [rawOpps, platformStatuses] = await Promise.all([
    getOpportunities({ limit: 20 }),
    getAllPlatformStatuses(),
  ]);

  // Normalizar a OpportunityOutput
  const opportunities = rawOpps.map((o) => ({
    id: o.id,
    route: o.route,
    buyPlatform: o.buyPlatform,
    sellPlatform: o.sellPlatform,
    asset: o.asset,
    buyPrice: o.buyPrice,
    sellPrice: o.sellPrice,
    capitalAmount: o.capitalAmount,
    roiGross: o.roiGross,
    feesImpact: o.feesImpact,
    slippageImpact: o.slippageImpact,
    networkImpact: o.networkImpact,
    roiAdjusted: o.roiAdjusted,
    fillProbability: o.fillProbability,
    liquidityRatio: o.liquidityRatio,
    latencyRiskMs: o.latencyRiskMs,
    classification: o.classification as OpportunityOutput["classification"],
    rejectionReasons: o.rejectionReasons,
    evaluatedAt: o.evaluatedAt.toISOString(),
    snapshotAge: { buyMs: o.snapshotAgeBuyMs, sellMs: o.snapshotAgeSellMs },
  })) satisfies OpportunityOutput[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Monitor</h1>
        <span className="text-xs text-muted-foreground">
          {opportunities.length} oportunidades
        </span>
      </div>

      <PlatformStatusBar statuses={platformStatuses} />
      <ClassificationFilter />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.id} opportunity={opp} />
        ))}

        {opportunities.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
            No hay oportunidades recientes. El sistema está monitoreando.
          </div>
        )}
      </div>
    </div>
  );
}
```

### T10.6 — PlatformStatusBar

```tsx
// components/dashboard/platform-status.tsx
import { cn } from "@/lib/utils";

type PlatformStatus = {
  platform: string;
  isHealthy: boolean;
  lastSuccessAt?: Date | null;
  consecutiveErrors: number;
};

export function PlatformStatusBar({
  statuses,
}: {
  statuses: PlatformStatus[];
}) {
  if (statuses.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((s) => (
        <div
          key={s.platform}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border",
            s.isHealthy
              ? "bg-success/10 text-success border-success/20"
              : "bg-destructive/10 text-destructive border-destructive/20",
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              s.isHealthy ? "bg-success" : "bg-destructive",
            )}
          />
          {s.platform}
          {!s.isHealthy && ` (${s.consecutiveErrors} errores)`}
        </div>
      ))}
    </div>
  );
}
```

## Verificación de Salida (gate)

- [ ] `/dashboard` renderiza grid de oportunidades con cards
- [ ] Botones de filtro cambian `activeClassification` en Zustand
- [ ] `PlatformStatusBar` muestra indicadores de salud de plataformas
- [ ] `OpportunityCard` muestra breakdown completo de ROI
- [ ] `npm run typecheck` → 0 errores

## HANDOFF → Fase 11

```
FASE_COMPLETADA: 10
ZUSTAND_STORE: lib/store/dashboard.store.ts — slices completos con persist
COMPONENTS: OpportunityCard, ClassificationBadge, ClassificationFilter, PlatformStatusBar
DASHBOARD_PAGE: app/(dashboard)/page.tsx — RSC con revalidate=30
SIGUIENTE_TAREA: Fase 11 — Página de configuración: RHF + Zod + Server Action
```

---

---

# FASE 11 — Dashboard: Configuración + Server Action

## Objetivo

Implementar la página de configuración de umbrales con React Hook Form + Zod + Server Action. Cumple AC-08.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 10
SCHEMAS_ZOD: UserConfigFormSchema, UserConfigFormInput
AUTH_HELPERS: requireAuth()
SHADCN: input, label, select, button, form — disponibles
RHF_INSTALADO: react-hook-form@^7, @hookform/resolvers
```

## Tareas

### T11.1 — Server Action: updateUserConfig

```typescript
// lib/actions/config.actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { UserConfigFormSchema } from "@/lib/schemas";

type ActionResult = { success: true } | { success: false; error: string };

export async function updateUserConfig(input: unknown): Promise<ActionResult> {
  // Protección de Server Action: sin middleware.ts, cada action verifica su propia sesión.
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { success: false, error: "No autenticado" };
  }

  const parsed = UserConfigFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const data = parsed.data;

  await prisma.userConfig.upsert({
    where: { userId },
    update: {
      minROI: data.minROI,
      capitalAmount: data.capitalAmount,
      maxSlippage: data.maxSlippage,
      minFillProbability: data.minFillProbability,
      alertEmail: data.alertEmail ?? null,
      alertTelegram: data.alertTelegram ?? null,
      alertDedupeWindowMin: data.alertDedupeWindowMin,
      enabledPlatforms: data.enabledPlatforms,
      monitoredAssets: data.monitoredAssets,
      updatedAt: new Date(),
    },
    create: {
      userId,
      minROI: data.minROI ?? 1.5,
      capitalAmount: data.capitalAmount ?? 500,
      maxSlippage: data.maxSlippage ?? 0.005,
      minFillProbability: data.minFillProbability ?? 0.7,
      alertEmail: data.alertEmail ?? null,
      alertTelegram: data.alertTelegram ?? null,
      alertDedupeWindowMin: data.alertDedupeWindowMin ?? 30,
      enabledPlatforms: data.enabledPlatforms ?? ["binance_spot", "bybit_spot"],
      monitoredAssets: data.monitoredAssets ?? ["USDT"],
    },
  });

  revalidatePath("/dashboard/config");
  return { success: true };
}
```

### T11.2 — ThresholdForm (Client Component)

```tsx
// components/config/threshold-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { UserConfigFormSchema } from "@/lib/schemas";
import type { UserConfigFormInput } from "@/lib/schemas";
import { updateUserConfig } from "@/lib/actions/config.actions";
import { useDashboardStore } from "@/lib/store/dashboard.store";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  initialConfig: UserConfigFormInput;
};

export function ThresholdForm({ initialConfig }: Props) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const { addNotification } = useDashboardStore();

  const form = useForm<UserConfigFormInput>({
    resolver: zodResolver(UserConfigFormSchema),
    defaultValues: initialConfig,
  });

  async function onSubmit(values: UserConfigFormInput) {
    setStatus("saving");
    const result = await updateUserConfig(values);

    if (result.success) {
      setStatus("saved");
      addNotification({ message: "Configuración guardada", type: "success" });
      form.reset(values);
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
      form.setError("root", { message: result.error });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {form.formState.errors.root && (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="minROI"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ROI Mínimo (%)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.1"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Solo se alertan oportunidades con ROI ajustado ≥ este valor.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capitalAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capital (USD)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="100"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Monto base para calcular ROI y evaluar liquidez.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="minFillProbability"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fill Probability Mínima</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  0.0 – 1.0. Umbral de fill en P2P.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="alertDedupeWindowMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ventana de Deduplicación (min)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="5"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  No se envían alertas repetidas por la misma ruta en esta
                  ventana.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="alertEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email de alertas</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>
                Recibirás emails cuando haya oportunidades EXECUTABLE.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={status === "saving"}>
          {status === "saving"
            ? "Guardando..."
            : status === "saved"
              ? "✓ Guardado"
              : "Guardar configuración"}
        </Button>
      </form>
    </Form>
  );
}
```

### T11.3 — Página de configuración (RSC)

```tsx
// app/(dashboard)/config/page.tsx
import { requireAuth } from "@/lib/auth-helpers";
import { getOrCreateDefaultUserConfig } from "@/lib/db/queries/user-config";
import { ThresholdForm } from "@/components/config/threshold-form";
import type { UserConfigFormInput } from "@/lib/schemas";

export default async function ConfigPage() {
  const session = await requireAuth();
  const config = await getOrCreateDefaultUserConfig(session.user.id);

  const formDefaults: UserConfigFormInput = {
    minROI: config.minROI,
    capitalAmount: config.capitalAmount,
    maxSlippage: config.maxSlippage,
    minFillProbability: config.minFillProbability,
    alertEmail: config.alertEmail,
    alertTelegram: config.alertTelegram,
    alertDedupeWindowMin: config.alertDedupeWindowMin,
    enabledPlatforms: config.enabledPlatforms,
    monitoredAssets: config.monitoredAssets,
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ajusta los umbrales del motor de arbitraje y las preferencias de
          alertas.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <ThresholdForm initialConfig={formDefaults} />
      </div>
    </div>
  );
}
```

### T11.4 — Test de Server Action (AC-08)

```typescript
// __tests__/unit/config.actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateUserConfig } from "@/lib/actions/config.actions";

// Mock del helper de auth — no del módulo auth directamente
vi.mock("@/lib/auth-helpers", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("user_test_id"),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userConfig: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("AC-08: Server Action validación Zod", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects negative minROI without DB write", async () => {
    const result = await updateUserConfig({
      minROI: -5,
      capitalAmount: 500,
      maxSlippage: 0.005,
      minFillProbability: 0.7,
      alertDedupeWindowMin: 30,
      enabledPlatforms: ["binance_spot"],
      monitoredAssets: ["USDT"],
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain(
      "greater than",
    );

    const { prisma } = await import("@/lib/db/prisma");
    expect(prisma.userConfig.upsert).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated call without DB write", async () => {
    const { getAuthenticatedUserId } = await import("@/lib/auth-helpers");
    vi.mocked(getAuthenticatedUserId).mockResolvedValueOnce(null);

    const result = await updateUserConfig({
      minROI: 1.5,
      capitalAmount: 500,
      maxSlippage: 0.005,
      minFillProbability: 0.7,
      alertDedupeWindowMin: 30,
      enabledPlatforms: ["binance_spot"],
      monitoredAssets: ["USDT"],
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      "No autenticado",
    );

    const { prisma } = await import("@/lib/db/prisma");
    expect(prisma.userConfig.upsert).not.toHaveBeenCalled();
  });

  it("saves valid config successfully", async () => {
    const result = await updateUserConfig({
      minROI: 1.5,
      capitalAmount: 500,
      maxSlippage: 0.005,
      minFillProbability: 0.7,
      alertDedupeWindowMin: 30,
      enabledPlatforms: ["binance_spot", "bybit_spot"],
      monitoredAssets: ["USDT"],
    });

    expect(result.success).toBe(true);
  });
});
```

## Verificación de Salida (gate)

- [ ] `npm test -- config.actions` → **3 tests** passing (AC-08: invalid payload, unauthenticated call, valid save)
- [ ] `/dashboard/config` renderiza formulario con valores iniciales de DB
- [ ] Envío de `minROI: -5` → error mostrado en formulario, sin DB write
- [ ] Envío sin sesión → `{ success: false, error: 'No autenticado' }`, sin DB write
- [ ] Envío de config válida → notificación de éxito en store Zustand
- [ ] `npm run typecheck` → 0 errores

## HANDOFF → Fase 12

```
FASE_COMPLETADA: 11
SERVER_ACTION: lib/actions/config.actions.ts — updateUserConfig con Zod + auth
THRESHOLD_FORM: components/config/threshold-form.tsx — RHF + shadcn Form
CONFIG_PAGE: app/(dashboard)/config/page.tsx — RSC carga + Client Form
TESTS_PASSING: AC-07 (auth redirect), AC-08 (server action validation)
SIGUIENTE_TAREA: Fase 12 — Recharts analytics: ROI chart + distribución por plataforma
```

---

---

# FASE 12 — Dashboard: Recharts Analytics

## Objetivo

Añadir gráficos de Recharts al dashboard: serie temporal de ROI de oportunidades ejecutables y distribución de clasificaciones por plataforma.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 11
DB_QUERIES: getOpportunityStats(opts) → { evaluatedAt, roiAdjusted, route, fillProbability }[]
SHADCN: ChartContainer disponible si se añadió 'chart' — si no, añadirlo ahora
RECHARTS: instalado
RSC_PATTERN: RSC carga datos → pasa como props → Client Component Recharts
```

## Tareas

### T12.1 — Añadir componente chart de shadcn

```bash
npx shadcn@latest add chart
```

### T12.2 — ROIChart (Client Component)

```tsx
// components/dashboard/roi-chart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

type DataPoint = {
  evaluatedAt: string;
  roiAdjusted: number;
  route: string;
};

const CHART_CONFIG = {
  roiAdjusted: {
    label: "ROI Ajustado (%)",
    color: "var(--color-brand-primary)",
  },
};

export function ROIChart({ data }: { data: DataPoint[] }) {
  const chartData = data.map((d) => ({
    time: new Date(d.evaluatedAt).toLocaleTimeString("es-VE", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    roiAdjusted: parseFloat(d.roiAdjusted.toFixed(3)),
    route: d.route,
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos de ROI en los últimos 7 días
      </div>
    );
  }

  return (
    <ChartContainer config={CHART_CONFIG} className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<ChartTooltipContent />} />
          <ReferenceLine
            y={0}
            stroke="var(--color-muted-foreground)"
            strokeDasharray="3 3"
          />
          <Line
            type="monotone"
            dataKey="roiAdjusted"
            stroke="var(--color-brand-primary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
```

### T12.3 — ClassificationDistChart

```tsx
// components/dashboard/classification-dist-chart.tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";

type DistData = {
  name: string;
  EXECUTABLE: number;
  MARGINAL: number;
  INVALID: number;
};

const CHART_CONFIG = {
  EXECUTABLE: { label: "Ejecutable", color: "var(--color-success)" },
  MARGINAL: { label: "Marginal", color: "var(--color-warning)" },
  INVALID: { label: "Inválido", color: "var(--color-muted-foreground)" },
};

export function ClassificationDistChart({ data }: { data: DistData[] }) {
  if (data.length === 0) return null;

  return (
    <ChartContainer config={CHART_CONFIG} className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar
            dataKey="EXECUTABLE"
            fill="var(--color-success)"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="MARGINAL"
            fill="var(--color-warning)"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="INVALID"
            fill="var(--color-muted-foreground)"
            opacity={0.4}
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
```

### T12.4 — Query de distribución por plataforma

```typescript
// lib/db/queries/opportunities.ts — añadir
export async function getClassificationDistByPlatform(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.opportunity.groupBy({
    by: ["buyPlatform", "classification"],
    where: { evaluatedAt: { gte: since } },
    _count: { id: true },
  });

  // Pivot: platform → { EXECUTABLE, MARGINAL, INVALID }
  const pivot: Record<
    string,
    { name: string; EXECUTABLE: number; MARGINAL: number; INVALID: number }
  > = {};

  for (const row of rows) {
    if (!pivot[row.buyPlatform]) {
      pivot[row.buyPlatform] = {
        name: row.buyPlatform,
        EXECUTABLE: 0,
        MARGINAL: 0,
        INVALID: 0,
      };
    }
    const classification = row.classification as
      | "EXECUTABLE"
      | "MARGINAL"
      | "INVALID";
    if (classification in pivot[row.buyPlatform]!) {
      pivot[row.buyPlatform]![classification] = row._count.id;
    }
  }

  return Object.values(pivot);
}
```

### T12.5 — Integrar charts en la página principal del dashboard

```tsx
// app/(dashboard)/page.tsx — actualizar para incluir charts
import { requireAuth } from "@/lib/auth-helpers";
import {
  getOpportunities,
  getOpportunityStats,
  getClassificationDistByPlatform,
} from "@/lib/db/queries/opportunities";
import { getAllPlatformStatuses } from "@/lib/db/queries/platform-status";
import { OpportunityCard } from "@/components/dashboard/opportunity-card";
import { ClassificationFilter } from "@/components/dashboard/classification-filter";
import { PlatformStatusBar } from "@/components/dashboard/platform-status";
import { ROIChart } from "@/components/dashboard/roi-chart";
import { ClassificationDistChart } from "@/components/dashboard/classification-dist-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OpportunityOutput } from "@/lib/schemas";

export const revalidate = 30;

export default async function DashboardPage() {
  await requireAuth();

  const [rawOpps, platformStatuses, roiStats, distData] = await Promise.all([
    getOpportunities({ limit: 20 }),
    getAllPlatformStatuses(),
    getOpportunityStats({ days: 7 }),
    getClassificationDistByPlatform(7),
  ]);

  const opportunities = rawOpps.map((o) => ({
    id: o.id,
    route: o.route,
    buyPlatform: o.buyPlatform,
    sellPlatform: o.sellPlatform,
    asset: o.asset,
    buyPrice: o.buyPrice,
    sellPrice: o.sellPrice,
    capitalAmount: o.capitalAmount,
    roiGross: o.roiGross,
    feesImpact: o.feesImpact,
    slippageImpact: o.slippageImpact,
    networkImpact: o.networkImpact,
    roiAdjusted: o.roiAdjusted,
    fillProbability: o.fillProbability,
    liquidityRatio: o.liquidityRatio,
    latencyRiskMs: o.latencyRiskMs,
    classification: o.classification as OpportunityOutput["classification"],
    rejectionReasons: o.rejectionReasons,
    evaluatedAt: o.evaluatedAt.toISOString(),
    snapshotAge: { buyMs: o.snapshotAgeBuyMs, sellMs: o.snapshotAgeSellMs },
  })) satisfies OpportunityOutput[];

  const roiChartData = roiStats.map((s) => ({
    evaluatedAt: s.evaluatedAt.toISOString(),
    roiAdjusted: s.roiAdjusted,
    route: s.route,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Monitor</h1>
        <span className="text-xs text-muted-foreground">
          {opportunities.length} oportunidades recientes
        </span>
      </div>

      <PlatformStatusBar statuses={platformStatuses} />

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              ROI Ajustado — últimos 7 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ROIChart data={roiChartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Distribución por plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ClassificationDistChart data={distData} />
          </CardContent>
        </Card>
      </div>

      <ClassificationFilter />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.id} opportunity={opp} />
        ))}
        {opportunities.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
            No hay oportunidades recientes. El sistema está monitoreando.
          </div>
        )}
      </div>
    </div>
  );
}
```

## Verificación de Salida (gate)

- [ ] `/dashboard` muestra dos cards con gráficos (ROI timeseries + distribución)
- [ ] ROIChart renderiza sin errores con datos vacíos (fallback message)
- [ ] `ClassificationDistChart` renderiza sin errores con datos vacíos
- [ ] `npm run typecheck` → 0 errores

## HANDOFF → Fase 13

```
FASE_COMPLETADA: 12
ROI_CHART: components/dashboard/roi-chart.tsx — Recharts LineChart con ChartContainer
DIST_CHART: components/dashboard/classification-dist-chart.tsx — Recharts BarChart
QUERY_NUEVA: getClassificationDistByPlatform() — groupBy pivot
DASHBOARD_COMPLETO: Monitor + Charts + Status + Cards + Filtros
SIGUIENTE_TAREA: Fase 13 — Exportación CSV via UploadThing
```

---

---

# FASE 13 — Exportación CSV (UploadThing)

## Objetivo

Implementar la exportación de historial de oportunidades como CSV via Server Action + UploadThing. El usuario obtiene una URL de descarga con TTL.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 12
UPLOADTHING_VARS: UPLOADTHING_SECRET, UPLOADTHING_APP_ID
DB_QUERIES: getOpportunities() disponible
SERVER_ACTION_PATTERN: establecido en Fase 11
```

## Tareas

### T13.1 — Configurar UploadThing router

```typescript
// lib/uploadthing.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/lib/auth";

const f = createUploadthing();

export const ourFileRouter = {
  exportUploader: f({ blob: { maxFileSize: "16MB" } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(({ metadata, file }) => {
      console.info(
        `[uploadthing] export uploaded userId=${metadata.userId} url=${file.url}`,
      );
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
```

### T13.2 — API Route para UploadThing

```typescript
// app/api/uploadthing/route.ts
import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "@/lib/uploadthing";

export const { GET, POST } = createRouteHandler({ router: ourFileRouter });
```

### T13.3 — Server Action: exportOpportunities

```typescript
// lib/actions/export.actions.ts
"use server";

import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { getOpportunities } from "@/lib/db/queries/opportunities";
import { UTApi } from "uploadthing/server";

type ExportResult =
  | { success: true; downloadUrl: string; filename: string; count: number }
  | { success: false; error: string };

function opportunitiesToCSV(
  rows: Awaited<ReturnType<typeof getOpportunities>>,
): string {
  const headers = [
    "id",
    "route",
    "buyPlatform",
    "sellPlatform",
    "asset",
    "buyPrice",
    "sellPrice",
    "capitalAmount",
    "roiGross",
    "feesImpact",
    "slippageImpact",
    "networkImpact",
    "roiAdjusted",
    "fillProbability",
    "liquidityRatio",
    "classification",
    "evaluatedAt",
  ];

  const lines = rows.map((r) =>
    [
      r.id,
      r.route,
      r.buyPlatform,
      r.sellPlatform,
      r.asset,
      r.buyPrice,
      r.sellPrice,
      r.capitalAmount,
      r.roiGross,
      r.feesImpact,
      r.slippageImpact,
      r.networkImpact,
      r.roiAdjusted,
      r.fillProbability,
      r.liquidityRatio,
      r.classification,
      r.evaluatedAt.toISOString(),
    ]
      .map(String)
      .join(","),
  );

  return [headers.join(","), ...lines].join("\n");
}

export async function exportOpportunities(
  classification?: string,
): Promise<ExportResult> {
  // Protección de Server Action — sin middleware.ts, verificación directa
  const userId = await getAuthenticatedUserId();
  if (!userId) return { success: false, error: "No autenticado" };

  const rows = await getOpportunities({
    classification: classification === "ALL" ? undefined : classification,
    limit: 10_000,
  });

  if (rows.length === 0) {
    return { success: false, error: "No hay datos para exportar" };
  }

  const csv = opportunitiesToCSV(rows);
  const filename = `aim-export-${new Date().toISOString().slice(0, 10)}.csv`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const file = new File([blob], filename, { type: "text/csv" });

  const utapi = new UTApi();
  const response = await utapi.uploadFiles([file]);

  const uploaded = response[0];
  if (!uploaded || uploaded.error) {
    return {
      success: false,
      error: uploaded?.error?.message ?? "Upload failed",
    };
  }

  return {
    success: true,
    downloadUrl: uploaded.data.url,
    filename,
    count: rows.length,
  };
}
```

### T13.4 — Botón de exportación en la página de historial

```tsx
// components/dashboard/export-button.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportOpportunities } from "@/lib/actions/export.actions";
import { Download } from "lucide-react";

export function ExportButton({ classification }: { classification?: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  async function handleExport() {
    setStatus("loading");
    const result = await exportOpportunities(classification);

    if (result.success) {
      // Disparar descarga
      const a = document.createElement("a");
      a.href = result.downloadUrl;
      a.download = result.filename;
      a.click();
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={status === "loading"}
    >
      <Download className="w-3.5 h-3.5 mr-1.5" />
      {status === "loading"
        ? "Exportando..."
        : status === "done"
          ? "✓ Descargado"
          : status === "error"
            ? "Error"
            : "Exportar CSV"}
    </Button>
  );
}
```

### T13.5 — Página de historial

```tsx
// app/(dashboard)/opportunities/page.tsx
import { requireAuth } from "@/lib/auth-helpers";
import { getOpportunities } from "@/lib/db/queries/opportunities";
import { OpportunityCard } from "@/components/dashboard/opportunity-card";
import { ExportButton } from "@/components/dashboard/export-button";
import type { OpportunityOutput } from "@/lib/schemas";

export const revalidate = 60;

export default async function OpportunitiesPage() {
  await requireAuth();

  const rawOpps = await getOpportunities({ limit: 100 });

  const opportunities = rawOpps.map((o) => ({
    id: o.id,
    route: o.route,
    buyPlatform: o.buyPlatform,
    sellPlatform: o.sellPlatform,
    asset: o.asset,
    buyPrice: o.buyPrice,
    sellPrice: o.sellPrice,
    capitalAmount: o.capitalAmount,
    roiGross: o.roiGross,
    feesImpact: o.feesImpact,
    slippageImpact: o.slippageImpact,
    networkImpact: o.networkImpact,
    roiAdjusted: o.roiAdjusted,
    fillProbability: o.fillProbability,
    liquidityRatio: o.liquidityRatio,
    latencyRiskMs: o.latencyRiskMs,
    classification: o.classification as OpportunityOutput["classification"],
    rejectionReasons: o.rejectionReasons,
    evaluatedAt: o.evaluatedAt.toISOString(),
    snapshotAge: { buyMs: o.snapshotAgeBuyMs, sellMs: o.snapshotAgeSellMs },
  })) satisfies OpportunityOutput[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Historial</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {opportunities.length} oportunidades registradas
          </p>
        </div>
        <ExportButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.id} opportunity={opp} />
        ))}
      </div>
    </div>
  );
}
```

## Verificación de Salida (gate)

- [ ] `/dashboard/opportunities` muestra botón "Exportar CSV"
- [ ] Click en botón → Server Action ejecuta → descarga CSV
- [ ] CSV contiene headers correctos + una fila por oportunidad
- [ ] `npm run typecheck` → 0 errores

## HANDOFF → Fase 14

```
FASE_COMPLETADA: 13
UPLOADTHING_ROUTER: lib/uploadthing.ts + app/api/uploadthing/route.ts
EXPORT_ACTION: lib/actions/export.actions.ts — exportOpportunities()
EXPORT_BUTTON: components/dashboard/export-button.tsx
HISTORIAL_PAGE: app/(dashboard)/opportunities/page.tsx
SISTEMA_COMPLETO: todas las funcionalidades del MVP implementadas
SIGUIENTE_TAREA: Fase 14 — Tests y CI: completar suite de tests, GitHub Actions
```

---

---

# FASE 14 — Tests y CI

## Objetivo

Completar la suite de tests para cubrir los 8 AC verificables y configurar GitHub Actions para CI automático en cada PR.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 13
TESTS_EXISTENTES:
  - __tests__/unit/pipeline.test.ts — AC-01, AC-02, AC-04
  - __tests__/unit/slippage.test.ts — slippage model
  - __tests__/unit/dedup.test.ts — AC-03
  - __tests__/unit/config.actions.test.ts — AC-08
VITEST_CONFIG: vitest.config.ts configurado con jsdom
FALTANTES: AC-05 (platform status), AC-06 (latencia evaluación), AC-07 (auth redirect)
```

## Tareas

### T14.1 — Test de platform status tracking (AC-05)

```typescript
// __tests__/unit/platform-status.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  markPlatformError,
  markPlatformHealthy,
} from "@/lib/db/queries/platform-status";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    platformStatus: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("AC-05: Platform Status Tracking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks platform unhealthy after 3 consecutive errors", async () => {
    const { prisma } = await import("@/lib/db/prisma");

    // Simular que ya hay 2 errores consecutivos
    vi.mocked(prisma.platformStatus.findUnique).mockResolvedValue({
      id: "cl1",
      platform: "airtm",
      isHealthy: true,
      consecutiveErrors: 2,
      lastSuccessAt: null,
      lastErrorAt: null,
      errorMessage: null,
      updatedAt: new Date(),
    });

    await markPlatformError("airtm", "Connection refused");

    expect(prisma.platformStatus.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isHealthy: false,
          consecutiveErrors: 3,
        }),
      }),
    );
  });

  it("resets consecutive errors on healthy scrape", async () => {
    const { prisma } = await import("@/lib/db/prisma");

    await markPlatformHealthy("binance_spot");

    expect(prisma.platformStatus.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isHealthy: true,
          consecutiveErrors: 0,
          errorMessage: null,
        }),
      }),
    );
  });
});
```

### T14.2 — Test de latencia de evaluación (AC-06)

```typescript
// __tests__/unit/evaluate-latency.test.ts
import { describe, it, expect } from "vitest";
import { evaluateAllPairs } from "@/lib/arbitrage-engine/pipeline";
import type { MarketSnapshot, UserConfig } from "@/lib/schemas";

function makeFreshSnapshot(
  id: string,
  platform: MarketSnapshot["platform"],
  price: number,
): MarketSnapshot {
  return {
    id,
    platform,
    asset: "USDT",
    baseCurrency: "USD",
    price,
    availableLiquidity: 10_000,
    fee: 0.001,
    latencyMs: 200,
    scrapedAt: new Date().toISOString(),
    isStale: false,
  };
}

describe("AC-06: Latencia de evaluación", () => {
  it("evaluates all pairs under 2000ms for 12 snapshots (6 platforms x 2 assets)", () => {
    // Simular 6 plataformas × 2 assets = 12 snapshots
    const snapshots: MarketSnapshot[] = [
      makeFreshSnapshot("s01", "binance_spot", 1.0),
      makeFreshSnapshot("s02", "binance_spot", 1.001),
      makeFreshSnapshot("s03", "bybit_spot", 1.003),
      makeFreshSnapshot("s04", "bybit_spot", 1.002),
      makeFreshSnapshot("s05", "binance_p2p", 1.01),
      makeFreshSnapshot("s06", "binance_p2p", 1.011),
      makeFreshSnapshot("s07", "bybit_p2p", 1.008),
      makeFreshSnapshot("s08", "bybit_p2p", 1.007),
      makeFreshSnapshot("s09", "airtm", 1.015),
      makeFreshSnapshot("s10", "airtm", 1.014),
      makeFreshSnapshot("s11", "kontigo", 1.02),
      makeFreshSnapshot("s12", "kontigo", 1.019),
    ];

    const config: UserConfig = {
      id: "cfg",
      userId: "usr",
      minROI: 1.5,
      capitalAmount: 1000,
      maxSlippage: 0.005,
      minFillProbability: 0.7,
      alertDedupeWindowMin: 30,
      enabledPlatforms: [
        "binance_spot",
        "bybit_spot",
        "binance_p2p",
        "bybit_p2p",
        "airtm",
        "kontigo",
      ],
      monitoredAssets: ["USDT"],
      updatedAt: new Date().toISOString(),
    };

    const start = Date.now();
    const results = evaluateAllPairs(snapshots, config, 1000);
    const duration = Date.now() - start;

    // El engine puro (sin IO) debe completar en << 2000ms
    expect(duration).toBeLessThan(500); // conservador: 500ms para el engine puro
    expect(results.length).toBeGreaterThan(0);
  });
});
```

### T14.3 — Test de integración del pipeline completo

```typescript
// __tests__/integration/evaluate-pipeline.test.ts
import { describe, it, expect } from "vitest";
import { evaluateOpportunity } from "@/lib/arbitrage-engine/pipeline";
import type { OpportunityInput } from "@/lib/schemas";

describe("Pipeline integration", () => {
  it("produces EXECUTABLE for clear arbitrage opportunity", () => {
    const now = new Date().toISOString();

    const input: OpportunityInput = {
      buySnapshot: {
        id: "buy01",
        platform: "binance_spot",
        asset: "USDT",
        baseCurrency: "USD",
        price: 1.0,
        availableLiquidity: 10_000,
        fee: 0.001,
        latencyMs: 200,
        scrapedAt: now,
        isStale: false,
      },
      sellSnapshot: {
        id: "sell01",
        platform: "bybit_spot",
        asset: "USDT",
        baseCurrency: "USD",
        price: 1.03, // 3% de spread bruto
        availableLiquidity: 10_000,
        fee: 0.001,
        latencyMs: 200,
        scrapedAt: now,
        isStale: false,
      },
      capitalAmount: 1000,
      networkCostUSD: 0,
      userConfig: {
        id: "cfg",
        userId: "usr",
        minROI: 1.5,
        capitalAmount: 1000,
        maxSlippage: 0.005,
        minFillProbability: 0.7,
        alertDedupeWindowMin: 30,
        enabledPlatforms: ["binance_spot", "bybit_spot"],
        monitoredAssets: ["USDT"],
        updatedAt: now,
      },
    };

    const result = evaluateOpportunity(input);

    expect(result.classification).toBe("EXECUTABLE");
    expect(result.roiAdjusted).toBeGreaterThan(0);
    expect(result.roiGross).toBeCloseTo(3.0, 1);
    // Invariante AC-02
    expect(
      Math.abs(
        result.roiAdjusted -
          (result.roiGross -
            result.feesImpact -
            result.slippageImpact -
            result.networkImpact),
      ),
    ).toBeLessThan(0.0001);
  });

  it("produces INVALID for negative-ROI pair", () => {
    const now = new Date().toISOString();

    const input: OpportunityInput = {
      buySnapshot: {
        id: "buy02",
        platform: "binance_spot",
        asset: "USDT",
        baseCurrency: "USD",
        price: 1.03,
        availableLiquidity: 10_000,
        fee: 0.001,
        latencyMs: 200,
        scrapedAt: now,
        isStale: false,
      },
      sellSnapshot: {
        id: "sell02",
        platform: "bybit_spot",
        asset: "USDT",
        baseCurrency: "USD",
        price: 1.0, // vender más barato que comprar
        availableLiquidity: 10_000,
        fee: 0.001,
        latencyMs: 200,
        scrapedAt: now,
        isStale: false,
      },
      capitalAmount: 1000,
      networkCostUSD: 0,
      userConfig: {
        id: "cfg",
        userId: "usr",
        minROI: 1.5,
        capitalAmount: 1000,
        maxSlippage: 0.005,
        minFillProbability: 0.7,
        alertDedupeWindowMin: 30,
        enabledPlatforms: ["binance_spot", "bybit_spot"],
        monitoredAssets: ["USDT"],
        updatedAt: now,
      },
    };

    const result = evaluateOpportunity(input);
    expect(result.classification).toBe("INVALID");
    expect(
      result.rejectionReasons?.some((r) => r.includes("ROI_NEGATIVE")),
    ).toBe(true);
  });
});
```

### T14.4 — GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  check:
    name: Typecheck + Lint + Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma client
        run: npx prisma generate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Verify no middleware.ts exists
        run: |
          if [ -f middleware.ts ]; then
            echo "ERROR: middleware.ts exists — auth pattern must use per-layer auth() calls"
            exit 1
          fi
          echo "OK: middleware.ts absent"

      - name: Unit tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info
        continue-on-error: true
```

### T14.5 — Resumen de cobertura AC

Crear `__tests__/AC_COVERAGE.md`:

```markdown
# Cobertura de Acceptance Criteria

| AC    | Descripción                                                                                  | Test file                                                    | Status  |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------- |
| AC-01 | Snapshot stale → INVALID + STALE_DATA reason                                                 | unit/pipeline.test.ts                                        | ✓       |
| AC-02 | roiAdjusted = roiGross - sum(impacts) error < 0.0001%                                        | unit/pipeline.test.ts, integration/evaluate-pipeline.test.ts | ✓       |
| AC-03 | Alerta no enviada si duplicate en ventana                                                    | unit/dedup.test.ts                                           | ✓       |
| AC-04 | Alta utilización → mayor slippageImpact                                                      | unit/pipeline.test.ts, unit/slippage.test.ts                 | ✓       |
| AC-05 | 3 errores consecutivos → isHealthy=false                                                     | unit/platform-status.test.ts                                 | ✓       |
| AC-06 | Evaluación 12 snapshots < 2000ms                                                             | unit/evaluate-latency.test.ts                                | ✓       |
| AC-07 | Sin sesión → redirect /login (vía layout.tsx requireAuth)                                    | E2E (manual / Playwright en Fase 2)                          | PENDING |
| AC-08 | Server Action rechaza payload inválido sin DB write; rechaza llamada sin sesión sin DB write | unit/config.actions.test.ts (3 tests)                        | ✓       |

## Notas de arquitectura de auth

- **Sin `middleware.ts`**: la protección de rutas se implementa en cada capa — layout RSC para el grupo dashboard, `requireAuthApi()` en Route Handlers, `getAuthenticatedUserId()` en Server Actions.
- El archivo `middleware.ts` no debe existir en el proyecto. La CI debe verificar su ausencia.
```

## Verificación de Salida (gate)

- [ ] `npm test` → todos los tests passing (≥ **14 tests** — 3 en config.actions por el nuevo caso de unauthenticated)
- [ ] `npm run typecheck` → 0 errores
- [ ] `ls middleware.ts` → archivo NO existe (confirmación final)
- [ ] `.github/workflows/ci.yml` existe
- [ ] `__tests__/AC_COVERAGE.md` documenta estado de todos los ACs

## HANDOFF → Fase 15

```
FASE_COMPLETADA: 14
TESTS_PASSING: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-08 (7/8 ACs)
AC_07_PENDING: auth redirect — verificación manual o E2E Playwright en Fase 2 del producto
CI: .github/workflows/ci.yml — typecheck + lint + tests en cada PR
COVERAGE: __tests__/AC_COVERAGE.md
SIGUIENTE_TAREA: Fase 15 — Deploy a Vercel producción + Neon configuración final
```

---

---

# FASE 15 — Deploy a Producción

## Objetivo

Configurar el despliegue en Vercel con las variables de entorno de producción, activar Neon branching para staging, y verificar que el cron de Vercel dispara correctamente.

## CONTEXTO_HEREDADO

```
FASE_COMPLETADA: 14
VERCEL_JSON: vercel.json con cron schedule creado en Fase 6
BUILD: passing localmente
ENV_VARS: todas documentadas en .env.local.example
NEON: base de datos en staging durante desarrollo, necesita producción
```

## Tareas

### T15.1 — Verificar `vercel.json` final

```json
{
  "crons": [
    {
      "path": "/api/cron/trigger",
      "schedule": "* * * * *"
    }
  ],
  "headers": [
    {
      "source": "/api/health",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    }
  ]
}
```

### T15.2 — Checklist de variables de entorno en Vercel

El agente debe verificar que cada variable en `.env.local.example` está configurada en el panel de Vercel para el entorno Production. Documentar cuáles están pendientes:

```
Variables requeridas para Fase 1 (MVP):
  [ ] DATABASE_URL        — Neon pooler URL producción
  [ ] DIRECT_URL          — Neon direct URL producción
  [ ] AUTH_SECRET         — openssl rand -base64 32
  [ ] AUTH_TRUST_HOST     — "true"
  [ ] CRON_SECRET         — token aleatorio seguro
  [ ] UPSTASH_REDIS_REST_URL
  [ ] UPSTASH_REDIS_REST_TOKEN
  [ ] QSTASH_CURRENT_SIGNING_KEY
  [ ] QSTASH_NEXT_SIGNING_KEY
  [ ] QSTASH_URL
  [ ] RESEND_API_KEY
  [ ] RESEND_FROM_EMAIL
  [ ] NEXT_PUBLIC_APP_URL — URL de producción: https://aim.yourdomain.com

Variables para Fase 2 (P2P):
  [ ] PLAYWRIGHT_WORKER_URL
  [ ] PLAYWRIGHT_WORKER_SECRET
  [ ] UPLOADTHING_SECRET
  [ ] UPLOADTHING_APP_ID
  [ ] ENABLE_P2P_SCRAPING — "true" (activar en Fase 2)
```

### T15.3 — Migration en producción

```bash
# Correr migration en producción usando DIRECT_URL (no pooler)
DATABASE_URL=$DIRECT_URL npx prisma migrate deploy
```

### T15.4 — Smoke test post-deploy

Secuencia de verificación manual post-deploy:

1. `GET https://aim.yourdomain.com/api/health` → 200 `{ status: 'ok' }`
2. `GET https://aim.yourdomain.com/login` → renderiza página de login
3. Login con magic link → redirige a `/dashboard`
4. `/dashboard` carga sin errores (oportunidades vacías es OK)
5. `/dashboard/config` carga con valores por defecto
6. Guardar configuración → notificación de éxito
7. Esperar 1 minuto → verificar en Neon que hay registros en `MarketSnapshot`
8. `POST https://aim.yourdomain.com/api/evaluate` con sesión → `{ evaluatedPairs: N }`
9. Verificar que dashboard muestra oportunidades

### T15.5 — Verificar que el Cron de Vercel está activo

En el panel de Vercel → Settings → Cron Jobs:

- Verificar que `/api/cron/trigger` aparece con schedule `* * * * *`
- Ver logs de ejecución (Vercel Logs → Functions)

## Verificación de Salida (gate)

- [ ] `GET /api/health` en producción → 200
- [ ] Login funciona con magic link
- [ ] Snapshots se registran en DB producción (verificar en Neon console)
- [ ] Al menos 1 ciclo de evaluación exitoso en producción
- [ ] Cron Jobs activo en panel Vercel

## HANDOFF — Sistema Completo

```
FASE_COMPLETADA: 15
DEPLOY: Vercel producción activo
CRON: /api/cron/trigger cada minuto
DB: Neon producción con migration aplicada
AUTH: magic link via Resend funcionando
SISTEMA: MVP completo — Fase 1 del producto DONE

CRITERIO_SALIDA_FASE_1_CUMPLIDO:
  ✓ AC-01: stale data rejection
  ✓ AC-02: ROI breakdown auditabilidad
  ✓ AC-03: alert deduplication
  ✓ AC-04: slippage no lineal
  ✓ AC-05: platform status tracking
  ✓ AC-06: evaluación < 2000ms
  ✓ AC-07: rutas protegidas (manual)
  ✓ AC-08: server action validation

PRÓXIMA_FASE_PRODUCTO: Fase 2 — P2P Scrapers (Playwright Worker en Droplet)
DOCUMENTACIÓN: SPEC_ARBITRAGE_MONITOR v1.1.0-rc1
```

---

---

## APÉNDICE: Guía de Uso para el Agente

### Cómo ejecutar este plan

Cada fase es un prompt que el agente recibe. El flujo ideal:

```
1. El agente lee esta fase completa
2. Ejecuta las tareas en orden (T0.1, T0.2, ...)
3. Ejecuta la verificación de salida
4. Si la verificación falla → depura y re-ejecuta la tarea fallida
5. Escribe el HANDOFF en su contexto
6. Señala que está listo para la siguiente fase
```

### Reglas de manejo de errores

- **TypeScript error:** nunca usar `any` para silenciar. Resolver el tipo correctamente.
- **Test failing:** no modificar el test para que pase. Arreglar la implementación.
- **Dependency conflict:** reportar al operador humano antes de proceder.
- **Missing env var:** crear un placeholder y documentarlo en el HANDOFF.
- **middleware.ts aparece en el proyecto:** eliminarlo inmediatamente. La protección de rutas es por capa, no por middleware global.

### Fases independientes vs acopladas

Las siguientes fases pueden paralelizarse si hay múltiples agentes:

- Fases 3 y 1 son independientes entre sí (schemas vs DB).
- Fases 9–13 son secuenciales (el dashboard se construye sobre sí mismo).
- Fase 14 puede correr parcialmente al final de cada fase (los tests de cada fase).

### Tokens de handoff

El bloque `HANDOFF` al final de cada fase es la fuente de verdad del estado del sistema. Un agente que toma una fase a la mitad debe leer este bloque, no asumir el estado.

```

```
