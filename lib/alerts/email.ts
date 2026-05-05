import { isAlertDuplicate, recordAlert } from "./dedup";
import { prisma } from "@/lib/db/prisma";
import type { OpportunityOutput, UserConfig } from "@/lib/schemas";

export async function processAlerts(
  opportunities: OpportunityOutput[],
  config: UserConfig,
): Promise<number> {
  const recipient = config.alertEmail;
  if (!recipient) return 0;

  // Dynamic imports to avoid Next.js build-time static analysis of react-email components
  const { Resend } = await import("resend");
  const { render } = await import("@react-email/render");
  const { OpportunityAlertEmail } = await import("@/lib/emails/opportunity-alert");

  const resend = new Resend(process.env.RESEND_API_KEY!);
  let sent = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  for (const opp of opportunities) {
    if (opp.classification !== "EXECUTABLE") continue;
    if (opp.roiAdjusted < config.minROI) continue;

    const isDupe = await isAlertDuplicate(
      opp.route,
      recipient,
      config.alertDedupeWindowMin,
    );

    // Buscar el ID persistido en DB para la alerta
    const persistedOpp = await prisma.opportunity.findFirst({
      where: {
        route: opp.route,
        evaluatedAt: { gte: new Date(Date.now() - 5000) },
      },
      orderBy: { evaluatedAt: "desc" },
    });

    if (isDupe) {
      if (persistedOpp) {
        await recordAlert(persistedOpp.id, "email", recipient, "deduped");
      }
      continue;
    }

    try {
      const html = await render(
        OpportunityAlertEmail({ opportunity: opp, appUrl }),
      );

      const result = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "alerts@example.com",
        to: recipient,
        subject: `⚡ AIM: ${opp.route} → ROI ${opp.roiAdjusted.toFixed(2)}%`,
        html,
      });

      if (result.error) {
        console.error(`[alerts] Resend error for ${opp.route}:`, result.error);
        if (persistedOpp)
          await recordAlert(persistedOpp.id, "email", recipient, "failed");
      } else {
        if (persistedOpp)
          await recordAlert(persistedOpp.id, "email", recipient, "sent");
        sent++;
        console.info(
          `[alerts] sent for route=${opp.route} roi=${opp.roiAdjusted.toFixed(2)}%`,
        );
      }
    } catch (err) {
      console.error(`[alerts] exception for ${opp.route}:`, err);
      if (persistedOpp)
        await recordAlert(persistedOpp.id, "email", recipient, "failed");
    }
  }

  return sent;
}
