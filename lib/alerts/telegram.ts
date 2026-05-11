import type { OpportunityOutput } from "@/lib/schemas";

/**
 * Envía una alerta a Telegram cuando se detecta una oportunidad EXECUTABLE.
 */
export async function sendTelegramAlert(opportunity: OpportunityOutput, chatId: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const enabled = process.env.ENABLE_TELEGRAM_ALERTS === "true";

  if (!enabled || !token || !chatId) {
    return;
  }

  const message = `
🚀 *Nueva Oportunidad de Arbitraje*
Ruta: ${opportunity.route}
Asset: ${opportunity.asset}
---
📉 Compra: ${opportunity.buyPlatform} @ ${opportunity.buyPrice.toFixed(2)}
📈 Venta: ${opportunity.sellPlatform} @ ${opportunity.sellPrice.toFixed(2)}
---
💰 ROI: *${(opportunity.roiAdjusted * 100).toFixed(2)}%*
📊 Probabilidad: ${(opportunity.fillProbability * 100).toFixed(0)}%
💵 Capital sugerido: $${opportunity.capitalAmount}
---
[Abrir Dashboard](${process.env.NEXT_PUBLIC_APP_URL}/dashboard)
  `.trim();

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!res.ok) {
      console.error(`[telegram] Error sending alert: ${res.statusText}`);
    }
  } catch (err) {
    console.error("[telegram] Exception sending alert:", err);
  }
}
