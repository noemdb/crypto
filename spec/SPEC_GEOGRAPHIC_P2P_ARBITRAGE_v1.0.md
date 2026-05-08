# SPEC_GEOGRAPHIC_P2P_ARBITRAGE v1.0

**Módulo: Arbitraje Geográfico P2P (VES/USD)**
**Sistema padre:** Arbitrage Intelligence Monitor (AIM)
**Clasificación:** Feature Spec — High Yield Strategy
**Estado:** Listo para ejecución
**Fecha:** 2026-05-08

---

## 1. Resumen Ejecutivo

Esta especificación detalla la implementación del **Arbitraje Geográfico P2P**, específicamente enfocado en el mercado de Venezuela (VES). La estrategia capitaliza el spread masivo (2-8%) entre el precio internacional de las criptomonedas (Binance Spot USD) y el precio en mercados P2P locales afectados por alta inflación y controles de capital.

**Impacto en la Red:**
- **Nueva Ruta Principal:** Binance Spot (USD) ➔ Binance P2P (VES).
- **Rentabilidad Esperada:** 2.0% - 8.0% ROI bruto.
- **Activo Clave:** USDT (Dólar Digital).

---

## 2. Contexto Operativo

En economías como la de Venezuela, el USDT actúa como moneda de reserva y unidad de cuenta. Debido a la restricción de acceso a divisas, el precio P2P en VES suele cotizar con una prima significativa sobre el tipo de cambio oficial, creando una oportunidad de arbitraje persistente para quienes tienen liquidez en ambos mercados (Internacional y Local).

---

## 3. Diseño Técnico

### 3.1 Ingestión de Datos (Scrapers)
Se ha unificado el soporte de divisas en los scrapers P2P para centrarse en la región de mayor spread.

- **Binance P2P**: Refactorizar `binance-p2p.ts` para centrarse exclusivamente en `VES`.
- **Frecuencia de Escaneo**: 180 segundos (TTL P2P estándar).

### 3.2 Normalización de Precios
Para comparar precios en VES con precios en USD, el sistema debe calcular una tasa implícita (Dólar Cripto).

- **Tasa de Referencia**: Se utilizará el promedio de los mejores anuncios de compra/venta en Binance P2P VES para USDT/VES.
- **Fórmula de Normalización**: `Precio_USD = Precio_VES / Tasa_VES_USD`.

---

## 4. Cambios en el Sistema

### 4.1 Scrapers (lib/scrapers/)
#### [MODIFY] [binance-p2p.ts](file:///home/nuser/code/crypto/lib/scrapers/binance-p2p.ts)
- Configurar plataforma específica `binance_p2p_ves`.

#### [DELETE] [binance-p2p-ves.ts](file:///home/nuser/code/crypto/lib/scrapers/binance-p2p-ves.ts)
- Consolidado en el scraper principal.

### 4.2 Servicio de Escaneo
#### [MODIFY] [scanner-service.ts](file:///home/nuser/code/crypto/lib/scanner-service.ts)
- Activar `binance_p2p_ves` en el loop de scraping cuando `ENABLE_P2P_SCRAPING` sea `true`.

### 4.3 Motor de Arbitraje
#### [MODIFY] [pipeline.ts](file:///home/nuser/code/crypto/lib/arbitrage-engine/pipeline.ts)
- Asegurar que el cálculo de `usdVesRate` se realice correctamente y se pase al contexto de evaluación.

---

## 5. Matriz de Rentabilidad (Ejemplo)

| Paso | Acción | Precio | Cantidad |
|---|---|---|---|
| 1. Binance Spot | Comprar USDT | $1.00 | 1000 USDT |
| 2. Transferencia | Spot ➔ P2P | $0.00 | 1000 USDT |
| 3. Binance P2P | Vender USDT (VES) | 39.50 VES | 39,500 VES |
| **ROI Bruto** | | | **7.4%** (vs Tasa Oficial 36.5) |

---

## 6. Plan de Ejecución

1. **Sprint 1 (Refactor):** Habilitar VES en scrapers.
2. **Sprint 2 (Normalización):** Validar la precisión de la tasa `usdVesRate` en el motor.
3. **Sprint 3 (UI):** Añadir etiquetas de "P2P VES" en las tarjetas de oportunidad para fácil identificación.

---

## 7. Riesgos y Mitigación

- **Volatilidad del Tipo de Cambio:** El bolívar (VES) puede devaluarse rápidamente. Mitigación: El motor utiliza snapshots con TTL corto (2 min) y rechaza datos antiguos.
- **Riesgo de Contraparte (P2P):** Las estafas en P2P son comunes. Mitigación: AIM solo actúa como monitor; la ejecución recae en el usuario, pero se muestran los "nicknames" y reputación en la metadata del snapshot.
