import { requireAuth } from "@/lib/auth-helpers";
import { getOpportunities } from "@/lib/db/queries/opportunities";
import { getUserConfig } from "@/lib/db/queries/user-config";
import { OpportunityCard } from "@/components/dashboard/opportunity-card";
import { ExportButton } from "@/components/dashboard/export-button";
import { OpportunitiesFilters } from "@/components/opportunities/filters";
import type { OpportunityOutput } from "@/lib/schemas";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireAuth();
  const config = await getUserConfig(session.user.id);
  const limit = config?.opportunitiesLimit ?? 50;

  const params = await searchParams;
  const classification = typeof params.classification === 'string' ? params.classification : undefined;
  const asset = typeof params.asset === 'string' ? params.asset : undefined;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const sortBy = typeof params.sortBy === 'string' ? (params.sortBy as any) : undefined;
  const sortOrder = typeof params.sortOrder === 'string' ? (params.sortOrder as any) : undefined;

  const rawOpps = await getOpportunities({ 
    limit,
    classification,
    asset,
    search,
    sortBy,
    sortOrder
  });

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
            Últimas {limit} oportunidades evaluadas por el motor.
          </p>
        </div>
        <ExportButton />
      </div>

      <OpportunitiesFilters />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {opportunities.map((opp) => (
          <OpportunityCard 
            key={opp.id} 
            opportunity={opp} 
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
