import { NextRequest, NextResponse } from "next/server";
import { requireAuthApi } from "@/lib/auth-helpers";
import { getAllFreshSnapshots } from "@/lib/db/queries/snapshots";
import { getOrCreateDefaultUserConfig } from "@/lib/db/queries/user-config";
import { insertOpportunity } from "@/lib/db/queries/opportunities";
import { dbSnapshotToSchema } from "@/lib/db/normalize";
import { evaluateAllPairs } from "@/lib/arbitrage-engine/pipeline";


export async function POST(request: NextRequest) {
  const start = Date.now();

  // Protección de ruta: sin middleware.ts — verificación directa en el handler.
  const unauthorized = await requireAuthApi();
  if (unauthorized) return unauthorized;

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

  // 5. Enviar Alertas (Telegram/Email)
  // Mapeamos los IDs de DB de vuelta a los objetos de oportunidad para el manager
  const opportunitiesWithIds = opportunities.map((op, index) => {
    const dbRes = persistedOpportunities[index];
    return {
      ...op,
      id: dbRes?.status === "fulfilled" ? dbRes.value.id : op.id,
    };
  });

  const { processNotifications } = await import("@/lib/notifications/manager");
  const alertsSent = await processNotifications(firstUser.id, opportunitiesWithIds);

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
