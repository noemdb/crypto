import { proxyRequest } from "@/lib/proxy";
import type { Scraper, ScraperResult } from "./base-scraper";
import type { Asset } from "@/lib/schemas";

// OKX ticker endpoint — público, sin auth
const OKX_BASE = "https://www.okx.com";

type OkxResponse = {
  code: string;
  msg: string;
  data: Array<{
    instId: string;
    last: string;
    bidPx: string;
    askPx: string;
    bidSz: string;
    askSz: string;
    vol24h: string;
  }>;
};

const ASSET_SYMBOL_MAP: Record<Asset, string> = {
  USDT: "USDC-USDT",
  USDC: "USDC-USDT",
  BTC: "BTC-USDT",
  ETH: "ETH-USDT",
};

export const okxSpotScraper: Scraper = {
  platform: "okx_spot",
  supportedAssets: ["USDT", "USDC", "BTC", "ETH"],

  async scrape(asset: Asset): Promise<ScraperResult> {
    const symbol = ASSET_SYMBOL_MAP[asset];

    const res = await proxyRequest<OkxResponse>({
      url: `${OKX_BASE}/api/v5/market/ticker?instId=${symbol}`,
      context: `okx_spot_${asset}`,
      timeoutMs: 5000,
      retries: 2,
    });

    if (!res.ok) {
      throw new Error(`OKX Spot scrape failed: ${res.error}`);
    }

    if (res.data.code !== "0" || !res.data.data[0]) {
      throw new Error(`OKX API error: ${res.data.msg || "No data"}`);
    }

    const ticker = res.data.data[0];
    let bidPrice = parseFloat(ticker.bidPx);
    let askPrice = parseFloat(ticker.askPx);

    if (asset === "USDT") {
      // Invertir el par USDC-USDT
      const tempBid = 1 / askPrice;
      const tempAsk = 1 / bidPrice;
      bidPrice = tempBid;
      askPrice = tempAsk;
    }

    const midPrice = (bidPrice + askPrice) / 2;

    const snapshot: import("@/lib/schemas").RawSnapshotInput = {
      platform: "okx_spot",
      asset,
      baseCurrency: "USD",
      price: midPrice,
      priceBid: bidPrice,
      priceAsk: askPrice,
      availableLiquidity: 1_000_000,
      fee: 0.001, // 0.1% taker fee estándar OKX
      latencyMs: res.latencyMs,
      scrapedAt: new Date().toISOString(),
      metadata: { symbol, raw: ticker },
    };

    return { snapshot, raw: ticker };
  },
};
