import { requireAuth } from "@/lib/auth-helpers";
import { getOpportunities } from "@/lib/db/queries/opportunities";
import { OpportunityCard } from "@/components/dashboard/opportunity-card";
import { ExportButton } from "@/components/dashboard/export-button";
import type { OpportunityOutput } from "@/lib/schemas";

export default async function OpportunitiesPage() {
  await requireAuth();

  const rawOpps = await getOpportunities({ limit: 50 });

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
          <p className="text-sm text-muted-foreground">
            Últimas 50 oportunidades evaluadas por el motor.
          </p>
        </div>
        <ExportButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {opportunities.map((opp) => (
          <OpportunityCard 
            key={opp.id} 
            opportunity={opp} 
            serverTime={Date.now()}
          />
        ))}

        {opportunities.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
            No hay historial disponible todavía.
          </div>
        )}
      </div>
    </div>
  );
}
