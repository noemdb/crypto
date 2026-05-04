import { requireAuth } from "@/lib/auth-helpers";
import {
  getOpportunities,
  getOpportunityStats,
  getClassificationDistByPlatform,
} from "@/lib/db/queries/opportunities";
import { getAllPlatformStatuses } from "@/lib/db/queries/platform-status";
import { getOrCreateDefaultUserConfig } from "@/lib/db/queries/user-config";
import { OpportunityList } from "@/components/dashboard/opportunity-list";
import { ClassificationFilter } from "@/components/dashboard/classification-filter";
import { PlatformStatusBar } from "@/components/dashboard/platform-status";
import { ROIChart } from "@/components/dashboard/roi-chart";
import { ClassificationDistChart } from "@/components/dashboard/classification-dist-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OpportunityOutput } from "@/lib/schemas";

export const revalidate = 30; // revalidar cada 30s

export default async function DashboardPage() {
  const session = await requireAuth();
  
  // Obtener config para aplicar filtros reactivos
  const userConfig = await getOrCreateDefaultUserConfig(session.user.id);

  const [rawOpps, platformStatuses, roiStats, distData] = await Promise.all([
    getOpportunities({ limit: 20 }),
    getAllPlatformStatuses(),
    getOpportunityStats({ days: 7, minROI: userConfig.minROI }),
    getClassificationDistByPlatform(7),
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

      {/* 
        Pasamos la config para que el listado pueda re-clasificar 
        si el usuario cambió los umbrales en la DB.
      */}
      <OpportunityList 
        initialOpportunities={opportunities} 
        serverTime={Date.now()}
        config={{
          minROI: userConfig.minROI,
          minFillProbability: userConfig.minFillProbability
        }}
      />
    </div>
  );
}
