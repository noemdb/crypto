"use server";

import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { getOpportunities } from "@/lib/db/queries/opportunities";
import { UTApi } from "uploadthing/server";

type ExportResult =
  | { success: true; downloadUrl: string; filename: string; count: number }
  | { success: false; error: string };

function opportunitiesToCSV(
  rows: Awaited<ReturnType<typeof getOpportunities>>,
): string {
  const headers = [
    "id",
    "route",
    "buyPlatform",
    "sellPlatform",
    "asset",
    "buyPrice",
    "sellPrice",
    "capitalAmount",
    "roiGross",
    "feesImpact",
    "slippageImpact",
    "networkImpact",
    "roiAdjusted",
    "fillProbability",
    "liquidityRatio",
    "classification",
    "evaluatedAt",
  ];

  const lines = rows.map((r) =>
    [
      r.id,
      r.route,
      r.buyPlatform,
      r.sellPlatform,
      r.asset,
      r.buyPrice,
      r.sellPrice,
      r.capitalAmount,
      r.roiGross,
      r.feesImpact,
      r.slippageImpact,
      r.networkImpact,
      r.roiAdjusted,
      r.fillProbability,
      r.liquidityRatio,
      r.classification,
      r.evaluatedAt.toISOString(),
    ]
      .map(String)
      .join(","),
  );

  return [headers.join(","), ...lines].join("\n");
}

export async function exportOpportunities(
  classification?: string,
): Promise<ExportResult> {
  // Protección de Server Action
  const userId = await getAuthenticatedUserId();
  if (!userId) return { success: false, error: "No autenticado" };

  const rows = await getOpportunities({
    ...(classification && classification !== "ALL" ? { classification } : {}),
    limit: 10_000,
  });

  if (rows.length === 0) {
    return { success: false, error: "No hay datos para exportar" };
  }

  const csv = opportunitiesToCSV(rows);
  const filename = `aim-export-${new Date().toISOString().slice(0, 10)}.csv`;
  
  // En Server Actions, usamos UTApi para subir el contenido directamente
  const utapi = new UTApi();
  
  try {
    // Create a file object from string
    const file = new File([csv], filename, { type: "text/csv" });
    const response = await utapi.uploadFiles(file);

    if (response.error) {
      return { success: false, error: response.error.message };
    }

    return {
      success: true,
      downloadUrl: response.data.url,
      filename,
      count: rows.length,
    };
  } catch (error) {
    console.error("[export] upload failed:", error);
    return { success: false, error: "Error al subir el archivo" };
  }
}
