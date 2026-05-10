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
import { ScannerButton } from "@/components/dashboard/scanner-button";
import { TimeRangeSelector } from "@/components/dashboard/time-range-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OpportunityOutput } from "@/lib/schemas";

const RANGE_LABELS: Record<string, string> = {
  "12h": "últimas 12 horas",
  "24h": "últimas 24 horas",
  "3d": "últimos 3 días",
  "7d": "últimos 7 días",
  "15d": "últimos 15 días",
  "30d": "últimos 30 días",
  "3m": "últimos 3 meses",
  "6m": "últimos 6 meses",
  "9m": "últimos 9 meses",
  "12m": "últimos 12 meses",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireAuth();
  const { range = "7d" } = await searchParams;
  
  // Calcular 'since' basado en el rango
  const since = new Date();
  const numericValue = parseInt(range);
  if (range.endsWith("h")) {
    since.setHours(since.getHours() - numericValue);
  } else if (range.endsWith("d")) {
    since.setDate(since.getDate() - numericValue);
  } else if (range.endsWith("m")) {
    since.setMonth(since.getMonth() - numericValue);
  }

  // Obtener config para aplicar filtros reactivos
  const userConfig = await getOrCreateDefaultUserConfig(session.user.id);

  const [rawOpps, platformStatuses, roiStats, distData] = await Promise.all([
    getOpportunities({ limit: 20 }),
    getAllPlatformStatuses(),
    getOpportunityStats({ since, minROI: userConfig.minROI }),
    getClassificationDistByPlatform(since),
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
    evaluatedAt: o.evaluatedAt.getTime(),
    createdAt: o.createdAt.getTime(),
    snapshotAge: { buyMs: o.snapshotAgeBuyMs, sellMs: o.snapshotAgeSellMs },
  })) satisfies OpportunityOutput[];

  const roiChartData = roiStats.map((s) => ({
    evaluatedAt: s.evaluatedAt.toISOString(),
    roiAdjusted: s.roiAdjusted,
    route: s.route,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Monitor</h1>
            <p className="text-sm text-muted-foreground">
              {opportunities.length} oportunidades analizadas recientemente.
            </p>
          </div>
          <PlatformStatusBar statuses={platformStatuses} />
        </div>
        <div className="w-full md:w-auto">
          <ScannerButton />
        </div>
      </div>

      {/* Charts row */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <TimeRangeSelector />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                ROI Ajustado — {RANGE_LABELS[range] || range}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ROIChart data={roiChartData} range={range} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Distribución — {RANGE_LABELS[range] || range}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ClassificationDistChart data={distData} />
            </CardContent>
          </Card>
        </div>
      </div>

      <ClassificationFilter />

      {/* 
        Pasamos la config para que el listado pueda re-clasificar 
        si el usuario cambió los umbrales en la DB.
      */}
      <OpportunityList
        initialOpportunities={opportunities}
        config={{
          minROI: userConfig.minROI,
          minFillProbability: userConfig.minFillProbability
        }}
      />
    </div>
  );
}
