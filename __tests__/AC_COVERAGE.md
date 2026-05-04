# Cobertura de Acceptance Criteria

| AC    | Descripción                                                                                  | Test file                                                    | Status  |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------- |
| AC-01 | Snapshot stale → INVALID + STALE_DATA reason                                                 | unit/pipeline.test.ts                                        | ✓       |
| AC-02 | roiAdjusted = roiGross - sum(impacts) error < 0.0001%                                        | unit/pipeline.test.ts, integration/evaluate-pipeline.test.ts | ✓       |
| AC-03 | Alerta no enviada si duplicate en ventana                                                    | unit/dedup.test.ts                                           | ✓       |
| AC-04 | Alta utilización → mayor slippageImpact                                                      | unit/pipeline.test.ts                                        | ✓       |
| AC-05 | 3 errores consecutivos → isHealthy=false                                                     | unit/platform-status.test.ts                                 | ✓       |
| AC-06 | Evaluación 12 snapshots < 2000ms                                                             | unit/evaluate-latency.test.ts                                | ✓       |
| AC-07 | Sin sesión → redirect /login (vía layout.tsx requireAuth)                                    | E2E (Verificación manual en layout.tsx)                      | ✓       |
| AC-08 | Server Action rechaza payload inválido sin DB write; rechaza llamada sin sesión sin DB write | unit/config.actions.test.ts                                  | ✓       |

## Notas de arquitectura de auth

- **Sin `middleware.ts`**: la protección de rutas se implementa en cada capa — layout RSC para el grupo dashboard, `requireAuthApi()` en Route Handlers, `getAuthenticatedUserId()` en Server Actions.
- El archivo `middleware.ts` no existe en el proyecto para evitar fugas de memoria y latencia innecesaria en el Edge.
