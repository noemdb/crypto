import { requireAuth } from "@/lib/auth-helpers";
import { getOrCreateDefaultUserConfig } from "@/lib/db/queries/user-config";
import { ThresholdForm } from "@/components/config/threshold-form";
import { DangerZone } from "@/components/config/danger-zone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

import { PlatformEnum, AssetEnum } from "@/lib/schemas";

export default async function ConfigPage() {
  const session = await requireAuth();
  const config = await getOrCreateDefaultUserConfig(session.user.id);

  // Sanitizar plataformas y assets para evitar errores de validación si hay valores obsoletos en la DB
  let validPlatforms = config.enabledPlatforms.filter((p: any) => 
    PlatformEnum.options.includes(p)
  );
  let validAssets = config.monitoredAssets.filter((a: any) => 
    AssetEnum.options.includes(a)
  );

  // Fallback si la sanitización dejó los arrays vacíos (datos antiguos incompatibles)
  if (validPlatforms.length === 0) validPlatforms = ["binance_spot", "bybit_spot"];
  if (validAssets.length === 0) validAssets = ["USDT"];

  // Convertir para el formulario (InitialConfig necesita ser serializable)
  const initialValues = {
    minROI: config.minROI,
    capitalAmount: config.capitalAmount,
    maxSlippage: config.maxSlippage,
    minFillProbability: config.minFillProbability,
    alertEmail: config.alertEmail,
    alertTelegram: config.alertTelegram,
    alertDedupeWindowMin: config.alertDedupeWindowMin,
    scanIntervalSeconds: config.scanIntervalSeconds,
    opportunitiesLimit: config.opportunitiesLimit ?? 50,
    enabledPlatforms: validPlatforms,
    monitoredAssets: validAssets,
    // ── Monitor de Precio P2P ──────────────────────────────────────────────
    monitorEnabled:          config.monitorEnabled,
    monitorPlatforms:        config.monitorPlatforms,
    monitorAssets:           config.monitorAssets,
    priceChangeThresholdPct: config.priceChangeThresholdPct,
    priceAlertThresholdPct:  config.priceAlertThresholdPct,
    priceAlertEnabled:       config.priceAlertEnabled,
  };


  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="text-muted-foreground text-sm">
          Ajusta los parámetros del motor de arbitraje y las alertas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Umbrales y Motor</CardTitle>
        </CardHeader>
        <CardContent>
          <ThresholdForm initialConfig={initialValues} />
        </CardContent>
      </Card>

      <DangerZone />
    </div>
  );
}
