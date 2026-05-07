"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ClassificationBadge } from "./classification-badge";
import { useDashboardStore } from "@/lib/store/dashboard.store";
import type { OpportunityOutput } from "@/lib/schemas";

function computeAgeLabel(ts: number): string {
  const age = Date.now() - ts;
  if (age < 0) return "ahora";
  if (age < 60_000) return `hace ${Math.max(0, Math.round(age / 1000))}s`;
  if (age < 3_600_000) return `hace ${Math.round(age / 60_000)}min`;
  return `hace ${Math.round(age / 3_600_000)}h`;
}

export function OpportunityCard({
  opportunity,
}: {
  opportunity: OpportunityOutput;
}) {
  const { displayTimezone } = useDashboardStore();

  const displayTime = opportunity.createdAt ?? opportunity.evaluatedAt;
  const ts =
    typeof displayTime === "number"
      ? displayTime
      : new Date(displayTime).getTime();

  // Defer locale-sensitive rendering to client-only to avoid SSR hydration mismatch.
  const [ageLabel, setAgeLabel] = useState<string>("...");
  const [formattedTime, setFormattedTime] = useState<string>("");

  useEffect(() => {
    const resolvedTz =
      displayTimezone === "local"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : displayTimezone;

    setAgeLabel(computeAgeLabel(ts));
    setFormattedTime(
      new Intl.DateTimeFormat("es", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: resolvedTz,
        timeZoneName: "short",
      }).format(new Date(ts))
    );

    // Refresh the age label every minute
    const interval = setInterval(() => setAgeLabel(computeAgeLabel(ts)), 60_000);
    return () => clearInterval(interval);
  }, [ts, displayTimezone]);

  const isExecutable = opportunity.classification === "EXECUTABLE";
  const hasPositiveROI = opportunity.roiAdjusted > 0;

  return (
    <Card
      className={[
        "transition-shadow",
        isExecutable
          ? "hover:shadow-[0_0_16px_2px_rgba(52,211,153,0.12)] border-l-[3px] border-l-success/60 bg-success/[0.03]"
          : "hover:shadow-md",
      ].join(" ")}
    >
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div>
          <p className="font-mono text-sm font-semibold">
            {opportunity.asset}: {opportunity.route}
          </p>
          <p
            className="text-xs text-muted-foreground mt-0.5"
            title={formattedTime}
          >
            {ageLabel}
          </p>
        </div>
        <ClassificationBadge
          classification={
            opportunity.classification as import("@/lib/schemas").Classification
          }
        />
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* ROI */}
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">ROI Ajustado</span>
          <span
            className={`flex items-center gap-1 text-lg font-bold ${
              hasPositiveROI ? "text-success" : "text-destructive"
            }`}
          >
            {hasPositiveROI && (
              <svg
                aria-hidden="true"
                viewBox="0 0 10 10"
                width="10"
                height="10"
                className="shrink-0 opacity-80"
                fill="currentColor"
              >
                {/* upward-trend mini-spark: right-angle triangle pointing up-right */}
                <polyline
                  points="1,9 4,5 6,7 9,1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points="6.5,1 9,1 9,3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {opportunity.roiAdjusted.toFixed(2)}%
          </span>
        </div>

        {/* ROI Breakdown */}
        <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
          <div className="flex justify-between">
            <span>Bruto</span>
            <span>{opportunity.roiGross.toFixed(3)}%</span>
          </div>
          <div className="flex justify-between text-destructive/70">
            <span>− Fees</span>
            <span>{opportunity.feesImpact.toFixed(3)}%</span>
          </div>
          <div className="flex justify-between text-destructive/70">
            <span>− Slippage</span>
            <span>{opportunity.slippageImpact.toFixed(3)}%</span>
          </div>
          <div className="flex justify-between text-destructive/70">
            <span>− Red</span>
            <span>{opportunity.networkImpact.toFixed(3)}%</span>
          </div>
        </div>

        {/* Fill probability + prices */}
        <div className="flex gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Fill Prob </span>
            <span className="font-medium">
              {(opportunity.fillProbability * 100).toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Compra </span>
            <span className="font-medium">
              ${opportunity.buyPrice.toFixed(4)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Venta </span>
            <span className="font-medium">
              ${opportunity.sellPrice.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Rejection reasons */}
        {opportunity.rejectionReasons &&
          opportunity.rejectionReasons.length > 0 && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              {opportunity.rejectionReasons.map((r, i) => (
                <p key={i} className="font-mono text-[10px]">
                  {r}
                </p>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}
