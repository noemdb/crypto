"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { UserConfigFormSchema } from "@/lib/schemas";

type ActionResult = { success: true } | { success: false; error: string };
type TestResult =
  | { success: true; message: string }
  | { success: false; error: string };

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
      scanIntervalSeconds: data.scanIntervalSeconds,
      opportunitiesLimit: data.opportunitiesLimit,
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
      scanIntervalSeconds: data.scanIntervalSeconds ?? 180,
      opportunitiesLimit: data.opportunitiesLimit ?? 50,
      enabledPlatforms: data.enabledPlatforms ?? ["binance_spot", "bybit_spot"],
      monitoredAssets: data.monitoredAssets ?? ["USDT"],
    },
  });

  revalidatePath("/dashboard/config");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Envía un mensaje de prueba al Chat ID de Telegram del usuario
 * para verificar que el bot y el chat están correctamente configurados.
 */
export async function testTelegramAlert(chatId: string): Promise<TestResult> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { success: false, error: "No autenticado" };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      success: false,
      error: "TELEGRAM_BOT_TOKEN no está configurado en el servidor.",
    };
  }

  if (!chatId?.trim()) {
    return { success: false, error: "Chat ID vacío." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "AIM";
  const message =
    `<b>✅ Conexión exitosa</b> — Arbitrage Intelligence Monitor\n\n` +
    `Tu Chat ID <code>${chatId}</code> está correctamente configurado.\n` +
    `Recibirás alertas aquí cuando se detecten oportunidades <b>EXECUTABLE</b>.\n\n` +
    `<i>${appUrl}</i>`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );

    const data = await res.json();

    if (!data.ok) {
      return {
        success: false,
        error: data.description ?? "Error desconocido de la API de Telegram.",
      };
    }

    return { success: true, message: "Mensaje de prueba enviado correctamente." };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error de red al contactar Telegram.",
    };
  }
}
