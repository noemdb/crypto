# SPEC_TRIANGULAR_ARBITRAGE v1.0

**Estrategia: Arbitraje Triangular Intra-exchange**
**Sistema padre:** Arbitrage Intelligence Monitor (AIM)
**Clasificación:** Strategy Spec — Production Grade
**Estado:** Draft para revisión
**Fecha:** 2026-05-08

---

## 1. Resumen Ejecutivo

Esta especificación detalla la implementación de **Arbitraje Triangular** dentro de una misma plataforma (ej. Binance o Bybit). A diferencia del arbitraje espacial (A -> B), el arbitraje triangular busca ineficiencias de precio entre tres pares interconectados dentro de un solo libro de órdenes, eliminando costos de red y latencia de transferencia entre exchanges.

**Ejemplo de Ciclo:**
1. Comprar ETH con BTC (BTC/ETH)
2. Comprar USDT con ETH (ETH/USDT)
3. Comprar BTC con USDT (USDT/BTC)
*Resultado:* Si el BTC final > BTC inicial, existe una oportunidad.

---

## 2. Contexto y Justificación

### Por qué esta estrategia:
1. **Latencia Cero en Red:** Todas las operaciones ocurren en la misma cuenta.
2. **Costos Reducidos:** No hay "network fees" (gas) por retiro, solo comisiones de trading (Maker/Taker).
3. **Velocidad de Ejecución:** El pipeline puede disparar las 3 órdenes casi simultáneamente (o secuencialmente via API con latencia interna mínima).

### Impacto en el Engine (AIM):
El motor actual está diseñado para evaluar pares de dos puntos (Snapshot A vs Snapshot B). Soporta arbitraje triangular requiere una evolución hacia una arquitectura de **detección de ciclos en grafos**.

---

## 3. Diseño Arquitectónico (ADRs)

### ADR-T01: Representación de Mercado como Grafo Dirigido
- **Contexto:** Las relaciones entre activos en un exchange forman un grafo.
- **Decisión:** Modelar cada exchange como un grafo donde los nodos son Assets (BTC, ETH, USDT) y las aristas son los Pares (BTC/ETH).
- **Consecuencia:** Permite usar algoritmos de búsqueda de ciclos (ej. Bellman-Ford modificado o búsqueda exhaustiva de 3 saltos) para detectar oportunidades.

### ADR-T02: Pipeline de Evaluación de 3 Nodos
- **Decisión:** Crear un nuevo `TriangularEvaluator` que procese una terna de snapshots atómicos del mismo exchange y timestamp.
- **Validación:** Los 3 snapshots deben tener un `scrapedAt` con una dispersión máxima de < 500ms para ser considerados válidos.

---

## 4. Diseño Funcional y Matemático

### 4.1 La Fórmula de ROI
Para un ciclo de 3 pasos (A -> B -> C -> A):

$$ROI_{bruto} = (P_1 \times P_2 \times P_3) - 1$$

Donde $P_n$ es el ratio de conversión (ajustado por si es `Buy` o `Sell` en el par).

**ROI Ajustado:**
$$ROI_{ajustado} = ROI_{bruto} - (Fee_1 + Fee_2 + Fee_3) - Slippage_{est}$$

### 4.2 Clasificación de Oportunidades
- **EXECUTABLE:** $ROI_{ajustado} \geq 0.3\%$ (en volatilidad alta) o $0.1\%$ (volatilidad normal).
- **MARGINAL:** $0\% < ROI_{ajustado} < Threshold$.
- **INVALID:** $ROI_{ajustado} \leq 0\%$ o datos stale.

---

## 5. Contratos de Datos (Zod)

### 5.1 TriangularCycle Schema
```typescript
export const TriangularCycleSchema = z.object({
  exchange: z.string(),
  path: z.array(z.string()).length(3), // ["BTC", "ETH", "USDT"]
  pairs: z.array(z.string()).length(3), // ["BTC/ETH", "ETH/USDT", "BTC/USDT"]
  snapshots: z.array(MarketSnapshotSchema).length(3),
  calculatedAt: z.string().datetime(),
})
```

---

## 6. Pipeline de Ejecución (AIM Engine)

1. **Ingestión:** El scraper de Binance/Bybit recolecta todos los pares base (USDT, BTC, ETH) simultáneamente.
2. **Ciclo Discovery:**
   - Generar combinaciones válidas de 3 saltos.
   - Filtrar por liquidez mínima en los 3 libros.
3. **Evaluación:**
   - `calculateTriangularROI()`
   - `applyTripleFees()` (considerando niveles VIP de cuenta).
   - `applySlippage(3x)` (el impacto es acumulativo).
4. **Notificación:**
   - Formatear ruta: `BINANCE: BTC ➔ ETH ➔ USDT ➔ BTC (+0.42%)`.

---

## 7. Plan de Implementación

1. **Fase 1:** Extender `lib/arbitrage-engine/` para soportar `MultiStepStrategy`.
2. **Fase 2:** Implementar el descubridor de ciclos para `binance_spot` y `bybit_spot`.
3. **Fase 3:** Actualizar el Dashboard para mostrar visualmente los 3 pasos de la ruta.

---

## 8. Riesgos y Mitigación

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Front-running** | Alto | Evaluar profundidad del libro (Order Book Depth) en lugar de solo precio mid/last. |
| **Partial Fills** | Medio | Si una de las 3 órdenes falla o se llena parcialmente, el ciclo queda "roto". Requiere lógica de salida de emergencia. |
| **API Rate Limits** | Medio | Agrupar requests de pares en un solo WebSocket stream. |
