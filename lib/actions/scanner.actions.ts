"use server";

import { triggerFullScan } from "@/lib/scanner-service";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db/prisma";

export async function runManualScan() {
  try {
    // Verificar autenticación
    await requireAuth();

    const result = await triggerFullScan();
    
    // Revalidar el dashboard para mostrar las nuevas oportunidades
    revalidatePath("/dashboard");
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error("[scanner-action] Error during manual scan:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Fallo desconocido al ejecutar el escaneo"
    };
  }
}

export async function resetMonitoringData() {
  try {
    await requireAuth();

    // Eliminar datos de monitoreo (onDelete: Cascade se encarga de las Alertas)
    await prisma.opportunity.deleteMany();
    await prisma.marketSnapshot.deleteMany();

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/config");

    return { success: true };
  } catch (error) {
    console.error("[scanner-action] Error resetting data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Fallo al reiniciar los datos",
    };
  }
}
