import { proxyRequest } from "@/lib/proxy";
import type { Scraper, ScraperResult } from "./base-scraper";
import type { Asset } from "@/lib/schemas";

// Binance ticker endpoint — público, sin auth
const BINANCE_BASE = "https://api.binance.com";

type BinanceTicker = {
  symbol: string;
  price: string;
  bidPrice: string;
  askPrice: string;
  volume: string;
};

const ASSET_SYMBOL_MAP: Record<Asset, string> = {
  USDT: "USDTUSDC", // USDT/USDC pair para precio en USD
  USDC: "USDCUSDT",
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
};

export const binanceSpotScraper: Scraper = {
  platform: "binance_spot",
  supportedAssets: ["USDT", "USDC", "BTC", "ETH"],

  async scrape(asset: Asset): Promise<ScraperResult> {
    const symbol = ASSET_SYMBOL_MAP[asset];

    const tickerRes = await proxyRequest<BinanceTicker>({
      url: `${BINANCE_BASE}/api/v3/ticker/bookTicker?symbol=${symbol}`,
      context: `binance_spot_${asset}`,
      timeoutMs: 5000,
      retries: 2,
    });

    if (!tickerRes.ok) {
      throw new Error(`Binance Spot scrape failed: ${tickerRes.error}`);
    }

    const ticker = tickerRes.data;
    const bidPrice = parseFloat(ticker.bidPrice);
    const askPrice = parseFloat(ticker.askPrice);
    const midPrice = (bidPrice + askPrice) / 2;

    const snapshot: import("@/lib/schemas").RawSnapshotInput = {
      platform: "binance_spot",
      asset,
      baseCurrency: "USD",
      price: midPrice,
      priceBid: bidPrice,
      priceAsk: askPrice,
      availableLiquidity: 999_999, // Spot exchange — liquidez prácticamente ilimitada
      fee: 0.001, // 0.1% taker fee estándar Binance
      latencyMs: tickerRes.latencyMs,
      scrapedAt: new Date().toISOString(),
      metadata: { symbol, raw: ticker },
    };

    return { snapshot, raw: ticker };
  },
};
