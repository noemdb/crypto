"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { UserConfigFormSchema } from "@/lib/schemas";

type ActionResult = { success: true } | { success: false; error: string };

export async function updateUserConfig(input: unknown): Promise<ActionResult> {
  // Protección de Server Action: sin middleware.ts, cada action verifica su propia sesión.
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { success: false, error: "No autenticado" };
  }

  const parsed = UserConfigFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const data = parsed.data;

  await prisma.userConfig.upsert({
    where: { userId },
    update: {
      minROI: data.minROI,
      capitalAmount: data.capitalAmount,
      maxSlippage: data.maxSlippage,
      minFillProbability: data.minFillProbability,
      alertEmail: data.alertEmail ?? null,
      alertTelegram: data.alertTelegram ?? null,
      alertDedupeWindowMin: data.alertDedupeWindowMin,
      enabledPlatforms: data.enabledPlatforms,
      monitoredAssets: data.monitoredAssets,
      updatedAt: new Date(),
    },
    create: {
      userId,
      minROI: data.minROI ?? 1.5,
      capitalAmount: data.capitalAmount ?? 500,
      maxSlippage: data.maxSlippage ?? 0.005,
      minFillProbability: data.minFillProbability ?? 0.7,
      alertEmail: data.alertEmail ?? null,
      alertTelegram: data.alertTelegram ?? null,
      alertDedupeWindowMin: data.alertDedupeWindowMin ?? 30,
      enabledPlatforms: data.enabledPlatforms ?? ["binance_spot", "bybit_spot"],
      monitoredAssets: data.monitoredAssets ?? ["USDT"],
    },
  });

  revalidatePath("/dashboard/config");
  revalidatePath("/dashboard");
  return { success: true };
}
