import { proxyRequest } from "@/lib/proxy";
import type { Scraper, ScraperResult } from "./base-scraper";
import type { Asset } from "@/lib/schemas";

// MEXC ticker endpoint — público, sin auth
const MEXC_BASE = "https://api.mexc.com";

type MexcTicker = {
  symbol: string;
  bidPrice: string;
  askPrice: string;
  bidQty: string;
  askQty: string;
};

const ASSET_SYMBOL_MAP: Record<Asset, string> = {
  USDT: "USDCUSDT",
  USDC: "USDCUSDT",
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
};

export const mexcSpotScraper: Scraper = {
  platform: "mexc_spot",
  supportedAssets: ["USDT", "USDC", "BTC", "ETH"],

  async scrape(asset: Asset): Promise<ScraperResult> {
    const symbol = ASSET_SYMBOL_MAP[asset];

    const tickerRes = await proxyRequest<MexcTicker>({
      url: `${MEXC_BASE}/api/v3/ticker/bookTicker?symbol=${symbol}`,
      context: `mexc_spot_${asset}`,
      timeoutMs: 5000,
      retries: 2,
    });

    if (!tickerRes.ok) {
      throw new Error(`MEXC Spot scrape failed: ${tickerRes.error}`);
    }

    const ticker = tickerRes.data;
    let bidPrice = parseFloat(ticker.bidPrice);
    let askPrice = parseFloat(ticker.askPrice);

    if (asset === "USDT") {
      // Invertir el par USDCUSDT para obtener el valor de USDT en términos de USDC (USD)
      const tempBid = 1 / askPrice;
      const tempAsk = 1 / bidPrice;
      bidPrice = tempBid;
      askPrice = tempAsk;
    }

    const midPrice = (bidPrice + askPrice) / 2;

    const snapshot: import("@/lib/schemas").RawSnapshotInput = {
      platform: "mexc_spot",
      asset,
      baseCurrency: "USD",
      price: midPrice,
      priceBid: bidPrice,
      priceAsk: askPrice,
      availableLiquidity: 500_000, // MEXC suele tener buena liquidez en estos pares
      fee: 0.00, // 0% spot fees promocional (o para la mayoría de usuarios)
      latencyMs: tickerRes.latencyMs,
      scrapedAt: new Date().toISOString(),
      metadata: { symbol, raw: ticker },
    };

    return { snapshot, raw: ticker };
  },
};
