import type { OpportunityOutput } from "@/lib/schemas";

const TELEGRAM_API = "https://api.telegram.org/bot";

export async function sendTelegramAlert(
  chatId: string,
  opportunity: OpportunityOutput
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram] No bot token found in env");
    return false;
  }

  const message = formatAlertMessage(opportunity);

  try {
    const response = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "MarkdownV2",
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error("[telegram] API error:", data.description);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[telegram] Network error:", err);
    return false;
  }
}

function formatAlertMessage(op: OpportunityOutput): string {
  const escape = (str: string) => str.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");

  const roiColor = op.roiAdjusted >= 1.5 ? "🟢" : "🟡";
  const title = `${roiColor} *ARBITRAGE ALERT* ${roiColor}`;
  
  return `
${title}

🚀 *Asset:* ${escape(op.asset)}
💰 *ROI:* ${escape(op.roiAdjusted.toFixed(2))}%
📊 *Route:* ${escape(op.route)}

📥 *Buy:* ${escape(op.buyPlatform)} @ ${escape(op.buyPrice.toFixed(4))}
📤 *Sell:* ${escape(op.sellPlatform)} @ ${escape(op.sellPrice.toFixed(4))}

💵 *Capital:* $${escape(op.capitalAmount.toString())}
📉 *Fees:* ${escape(op.feesImpact.toFixed(3))}%
🎯 *Fill Prob:* ${escape((op.fillProbability * 100).toFixed(0))}%

⏰ *Snapshot Age:* Buy ${escape((op.snapshotAge.buyMs / 1000).toFixed(1))}s, Sell ${escape((op.snapshotAge.sellMs / 1000).toFixed(1))}s
`.trim();
}
