import { prisma } from "@/lib/db/prisma";
import type { OpportunityOutput } from "@/lib/schemas";
import { sendTelegramAlert } from "./telegram";

export async function processNotifications(
  userId: string,
  opportunities: OpportunityOutput[]
): Promise<number> {
  const config = await prisma.userConfig.findUnique({
    where: { userId },
  });

  if (!config) return 0;

  const executableOpportunities = opportunities.filter(
    (o) => o.classification === "EXECUTABLE"
  );

  if (executableOpportunities.length === 0) return 0;

  let sentCount = 0;

  for (const op of executableOpportunities) {
    // 1. Verificar deduplicación (Dedupe Window)
    const recentAlert = await prisma.alert.findFirst({
      where: {
        recipient: config.alertTelegram || config.userId,
        sentAt: {
          gte: new Date(Date.now() - config.alertDedupeWindowMin * 60 * 1000),
        },
        opportunity: {
          route: op.route,
          asset: op.asset,
        },
      },
    });

    if (recentAlert) {
      console.info(`[notifications] Skipping alert for ${op.route} ${op.asset} (deduplicated)`);
      continue;
    }

    // 2. Enviar Telegram si está configurado
    if (config.alertTelegram) {
      const ok = await sendTelegramAlert(config.alertTelegram, op);
      if (ok) {
        await logAlert(op.id, "TELEGRAM", config.alertTelegram);
        sentCount++;
      }
    }

    // 3. TODO: Enviar Email si está configurado (Fase 2 Follow-up)
  }

  return sentCount;
}

async function logAlert(opportunityId: string, channel: string, recipient: string) {
  try {
    await prisma.alert.create({
      data: {
        opportunityId,
        channel,
        recipient,
        status: "SENT",
      },
    });
  } catch (err) {
    console.error("[notifications] Error logging alert:", err);
  }
}
