import { proxyRequest } from "@/lib/proxy";
import type { Scraper, ScraperResult } from "./base-scraper";
import type { Asset } from "@/lib/schemas";

const BYBIT_BASE = "https://api.bybit.com";

type BybitTickerResponse = {
  retCode: number;
  result: {
    list: Array<{
      symbol: string;
      bid1Price: string;
      ask1Price: string;
      lastPrice: string;
      volume24h: string;
    }>;
  };
};

const ASSET_SYMBOL_MAP: Record<Asset, string> = {
  USDT: "USDCUSDT", // Invertido
  USDC: "USDCUSDT",
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
};

export const bybitSpotScraper: Scraper = {
  platform: "bybit_spot",
  supportedAssets: ["USDT", "USDC", "BTC", "ETH"],

  async scrape(asset: Asset): Promise<ScraperResult> {
    const symbol = ASSET_SYMBOL_MAP[asset];

    const res = await proxyRequest<BybitTickerResponse>({
      url: `${BYBIT_BASE}/v5/market/tickers?category=spot&symbol=${symbol}`,
      context: `bybit_spot_${asset}`,
      timeoutMs: 5000,
      retries: 2,
    });

    if (!res.ok) throw new Error(`Bybit Spot scrape failed: ${res.error}`);
    if (res.data.retCode !== 0)
      throw new Error(`Bybit API error: retCode=${res.data.retCode}`);

    const ticker = res.data.result.list[0];
    if (!ticker) throw new Error("Bybit: empty ticker response");

    let bidPrice = parseFloat(ticker.bid1Price);
    let askPrice = parseFloat(ticker.ask1Price);

    if (asset === "USDT") {
      // Invertir el par USDCUSDT para obtener el precio de USDT
      const tempBid = 1 / askPrice;
      const tempAsk = 1 / bidPrice;
      bidPrice = tempBid;
      askPrice = tempAsk;
    }

    const midPrice = (bidPrice + askPrice) / 2;
    const volume24h = parseFloat(ticker.volume24h);

    const snapshot: import("@/lib/schemas").RawSnapshotInput = {
      platform: "bybit_spot",
      asset,
      baseCurrency: "USD",
      price: midPrice,
      priceBid: bidPrice,
      priceAsk: askPrice,
      volume24h,
      availableLiquidity: 999_999,
      fee: 0.001, // 0.1% taker fee estándar Bybit
      latencyMs: res.latencyMs,
      scrapedAt: new Date().toISOString(),
      metadata: { symbol, raw: ticker },
    };

    return { snapshot, raw: ticker };
  },
};
