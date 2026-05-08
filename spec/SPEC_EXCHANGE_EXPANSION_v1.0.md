# SPEC_EXCHANGE_EXPANSION v1.0

**Módulo: Expansión de Exchanges (MEXC & OKX)**
**Sistema padre:** Arbitrage Intelligence Monitor (AIM)
**Clasificación:** Feature Spec — Production Grade
**Estado:** Listo para ejecución
**Fecha:** 2026-05-08

---

## 1. Resumen Ejecutivo

Esta especificación detalla la integración de **MEXC** y **OKX** en el ecosistema de AIM. El objetivo principal es capitalizar la estructura de comisiones de MEXC (0% fees en spot), lo que permite ejecutar arbitrajes con márgenes de beneficio mucho más bajos (0.10% - 0.15%) que anteriormente eran inviables debido a las comisiones de Binance/Bybit.

**Impacto en la Red:**
- **Nuevos Scrapers:** 2 (MEXC Spot, OKX Spot)
- **Nuevas Rutas:** 12 (ej. MEXC ➔ Binance, OKX ➔ Bybit, etc.)
- **Ventaja Competitiva:** MEXC actúa como el "origen" o "destino" ideal de fondos para minimizar el arrastre de comisiones.

---

## 2. Contexto Operativo

### El "Efecto Fee 0%"
En un arbitraje estándar Binance ➔ Bybit, el costo de entrada/salida es ~0.20%. En MEXC ➔ Binance, el costo cae a ~0.10% (solo el taker fee de Binance). Esto duplica las oportunidades detectables bajo condiciones de mercado de baja volatilidad.

---

## 3. Diseño Técnico

### 3.1 Contrato de API: MEXC Spot
- **Endpoint:** `https://api.mexc.com/api/v3/ticker/bookTicker`
- **Modelo de Datos:**
  ```typescript
  type MexcTicker = {
    symbol: string;
    bidPrice: string;
    askPrice: string;
    bidQty: string;
    askQty: string;
  }
  ```
- **Fees:** 0.00 (0%) para pares USDT.

### 3.2 Contrato de API: OKX Spot
- **Endpoint:** `https://www.okx.com/api/v5/market/tickers?instType=SPOT`
- **Modelo de Datos:**
  ```typescript
  type OkxTicker = {
    instId: string;
    last: string;
    bidPx: string;
    askPx: string;
    vol24h: string;
  }
  ```
- **Fees:** 0.001 (0.1% taker estándar).

---

## 4. Cambios en el Sistema

### 4.1 Schemas y Tipos
Añadir a `PlatformEnum` en `lib/schemas/snapshot.schema.ts`:
- `mexc_spot`
- `okx_spot`

### 4.2 Ingestión (lib/scrapers/)
Implementar `mexc-spot.ts` y `okx-spot.ts` siguiendo el patrón de `binance-spot.ts`.

### 4.3 Motor de Arbitraje (lib/arbitrage-engine/)
Actualizar `TTL_MS` en `validate-freshness.ts`:
- `mexc_spot`: 30,000ms
- `okx_spot`: 30,000ms

---

## 5. Matriz de Rutas (Nuevas)

| Origen | Destino | Ventaja |
|---|---|---|
| **MEXC** | Binance | Spread mínimo requerido: 0.11% |
| **MEXC** | Bybit | Spread mínimo requerido: 0.11% |
| **MEXC** | OKX | Spread mínimo requerido: 0.11% |
| **OKX** | Binance | Spread estándar |
| **OKX** | MEXC | Spread reducido por fee 0% en destino |

---

## 6. Plan de Ejecución

1. **Sprint 1 (Scrapers):** Implementar y probar conectividad con MEXC y OKX.
2. **Sprint 2 (Engine):** Registrar plataformas y validar normalización de símbolos (ej. `BTC-USDT` en OKX vs `BTCUSDT` en Binance).
3. **Sprint 3 (Dashboard):** Verificar que los nuevos logos y nombres de plataforma se rendericen correctamente.

---

## 7. Riesgos y Mitigación

- **Rate Limits:** OKX es estricto con sus rate limits de API pública. Mitigación: Uso de `proxy.ts` con retries escalonados.
- **Liquidez Fantasma:** MEXC a veces reporta precios con poca profundidad. Mitigación: El Normalizer debe validar `availableLiquidity` si la API lo provee, o usar un factor de seguridad de slippage mayor (0.15%).
