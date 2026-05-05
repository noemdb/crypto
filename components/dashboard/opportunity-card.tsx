import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ClassificationBadge } from "./classification-badge";
import type { OpportunityOutput } from "@/lib/schemas";

export function OpportunityCard({
  opportunity,
  serverTime,
}: {
  opportunity: OpportunityOutput;
  serverTime: number;
}) {
  const displayTime = opportunity.createdAt || opportunity.evaluatedAt;
  const timestamp = typeof displayTime === "number" ? displayTime : new Date(displayTime).getTime();
  const age = serverTime - timestamp;
  const ageLabel =
    age < 60_000
      ? `hace ${Math.max(0, Math.round(age / 1000))}s`
      : `hace ${Math.round(age / 60_000)}min`;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div>
          <p className="font-mono text-sm font-semibold">
            {opportunity.asset}: {opportunity.route}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{ageLabel}</p>
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
            className={`text-lg font-bold ${
              opportunity.roiAdjusted >= 0 ? "text-success" : "text-destructive"
            }`}
          >
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
