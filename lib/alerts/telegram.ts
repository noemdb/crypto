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

// ── Monitor de Precio P2P ──────────────────────────────────────────────────────

export type PriceAlertPayload = {
  chatId: string
  platform: string
  asset: string
  priceMin: number
  priceMax: number
  changePct: number
  direction: 'up' | 'down'
}

export async function sendPriceAlert(payload: PriceAlertPayload): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — skipping price alert')
    return
  }

  const arrow = payload.direction === 'up' ? '📈' : '📉'
  const sign  = payload.direction === 'up' ? '+' : ''

  const message = [
    `${arrow} *AIM · Alerta de Precio P2P*`,
    ``,
    `*Activo:* ${payload.asset} en \`${payload.platform}\``,
    `*Cambio:* ${sign}${payload.changePct.toFixed(2)}%`,
    ``,
    `*Mínimo actual:* $${payload.priceMin.toFixed(4)}`,
    `*Máximo actual:* $${payload.priceMax.toFixed(4)}`,
    ``,
    `_${new Date().toLocaleString('es-VE')}_`,
  ].join('\n')

  try {
    await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: payload.chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      },
    )
    console.info(
      `[telegram] price alert sent platform=${payload.platform} asset=${payload.asset} change=${payload.changePct.toFixed(2)}%`,
    )
  } catch (err) {
    console.error('[telegram] price alert failed:', err)
  }
}

