# Lógica de Ejecución Parcial (v1.0)

## Contexto
Originalmente, el sistema invalidaba cualquier oportunidad donde `liquidityRatio < 1.0` (insuficiente liquidez para el capital total configurado). Por requerimiento del usuario, esta lógica se ha flexibilizado para permitir operaciones parciales.

## Reglas de Clasificación Actualizadas

### 1. Liquidez (Flexibilidad Parcial)
- Si `liquidityRatio < 1.0`, se registra un aviso de `INSUFFICIENT_LIQUIDITY`.
- **Acción**: NO se rechaza la oportunidad. El pipeline continúa.
- **Resultado**: La oportunidad puede ser `EXECUTABLE` si el ROI es suficiente, indicando al operador que debe realizar una compra/venta parcial.

### 2. Bloqueos Duros (INVALID obligatorio)
A pesar de la flexibilidad en liquidez, los siguientes casos SIGUEN siendo `INVALID`:
- **ROI_NEGATIVE**: El ROI ajustado es menor a 0.
- **LOW_FILL_PROBABILITY**: La probabilidad de completar la orden (P2P) es < 0.5 (50%).
- **OUTLIER_DETECTED**: El precio detectado se desvía > 15% de la mediana del mercado.
- **STALE_DATA**: Los datos tienen una antigüedad superior al TTL configurado (frescura).

### 3. Estados de Clasificación
- **EXECUTABLE**: No hay bloqueos duros Y (`roiAdjusted >= minROI` Y `fillProbability >= minFillProbability`).
- **MARGINAL**: No hay bloqueos duros pero no se alcanzan los umbrales de ROI o Fill configurados por el usuario.
- **INVALID**: Existe al menos un bloqueo duro (ROI negativo, anomalía, etc.).

## Implementación Técnica
- El paso `liquidity-eval.ts` ahora solo añade el motivo a `rejectionReasons` sin llamar a `reject(ctx)`.
- El paso `classify.ts` hereda los motivos y solo marca como `INVALID` si `ctx.rejected === true`.
