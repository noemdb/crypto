"use server";

import { triggerFullScan } from "@/lib/scanner-service";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-helpers";

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
