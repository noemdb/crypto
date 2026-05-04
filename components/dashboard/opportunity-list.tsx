"use client";

import { useDashboardStore } from "@/lib/store/dashboard.store";
import { OpportunityCard } from "./opportunity-card";
import type { OpportunityOutput } from "@/lib/schemas";

type ConfigProps = {
  minROI: number;
  minFillProbability: number;
};

export function OpportunityList({
  initialOpportunities,
  serverTime,
  config,
}: {
  initialOpportunities: OpportunityOutput[];
  serverTime: number;
  config: ConfigProps;
}) {
  const { activeClassification } = useDashboardStore();

  const filtered = initialOpportunities
    .map((opp) => {
      // Re-clasificación reactiva basada en los umbrales actuales de la DB
      let currentClassification = opp.classification;

      if (
        opp.roiAdjusted >= config.minROI &&
        opp.fillProbability >= config.minFillProbability
      ) {
        currentClassification = "EXECUTABLE";
      } else if (opp.roiAdjusted > 0) {
        currentClassification = "MARGINAL";
      } else {
        currentClassification = "INVALID";
      }

      return { ...opp, classification: currentClassification };
    })
    .filter((opp) => {
      if (activeClassification === "ALL") return true;
      return opp.classification === activeClassification;
    });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((opp) => (
        <OpportunityCard 
          key={opp.id} 
          opportunity={opp} 
          serverTime={serverTime} 
        />
      ))}

      {filtered.length === 0 && (
        <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
          No hay oportunidades que coincidan con el filtro "{activeClassification}".
        </div>
      )}
    </div>
  );
}
