import { proxyRequest } from "@/lib/proxy";
import type { Scraper, ScraperResult } from "./base-scraper";
import type { Asset } from "@/lib/schemas";

const BINANCE_P2P_API = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

type BinanceP2PAd = {
  adv: {
    price: string;
    surplusAmount: string;
    maxSingleTransAmount: string;
    minSingleTransAmount: string;
  };
  advertiser: {
    nickName: string;
    monthOrderCount: number;
    monthFinishRate: number;
  };
};

type BinanceP2PResponse = {
  code: string;
  data: BinanceP2PAd[];
  success: boolean;
};

export const binanceP2PScraper: Scraper = {
  platform: "binance_p2p",
  supportedAssets: ["USDT", "USDC"], // Binance P2P ARS mayormente USDT/USDC

  async scrape(asset: Asset): Promise<ScraperResult> {
    const fiat = "ARS"; // Por ahora hardcoded ARS para Fase 2

    // 1. Fetch SELL ads (to get the Ask price - price we pay to buy)
    const sellAdsRes = await proxyRequest<BinanceP2PResponse>({
      url: BINANCE_P2P_API,
      method: "POST",
      body: {
        asset,
        fiat,
        merchantCheck: false,
        page: 1,
        payTypes: [],
        publisherType: null,
        rows: 5,
        tradeType: "SELL",
      },
      context: `binance_p2p_buy_${asset}`,
    });

    // 2. Fetch BUY ads (to get the Bid price - price we get when selling)
    const buyAdsRes = await proxyRequest<BinanceP2PResponse>({
      url: BINANCE_P2P_API,
      method: "POST",
      body: {
        asset,
        fiat,
        merchantCheck: false,
        page: 1,
        payTypes: [],
        publisherType: null,
        rows: 5,
        tradeType: "BUY",
      },
      context: `binance_p2p_sell_${asset}`,
    });

    if (!sellAdsRes.ok) {
      throw new Error(`Binance P2P (SELL) failed: ${sellAdsRes.error}`);
    }
    if (!buyAdsRes.ok) {
      throw new Error(`Binance P2P (BUY) failed: ${buyAdsRes.error}`);
    }

    const sellAds = sellAdsRes.data.data || [];
    const buyAds = buyAdsRes.data.data || [];

    if (sellAds.length === 0 || buyAds.length === 0) {
      throw new Error("No P2P ads found on Binance");
    }

    // Sanitizado de strings y parsing seguro (Distinguished Engineer Rule)
    const sanitizeNum = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, ""));
    
    const bestAsk = sanitizeNum(sellAds[0]!.adv.price);
    const bestBid = sanitizeNum(buyAds[0]!.adv.price);

    // Cálculo de liquidez real disponible
    const tradableQty = sanitizeNum(sellAds[0]!.adv.surplusAmount);
    const maxTrans = sanitizeNum(sellAds[0]!.adv.maxSingleTransAmount);
    const availableLiquidity = Math.min(tradableQty, maxTrans);

    const snapshot: import("@/lib/schemas").RawSnapshotInput = {
      platform: "binance_p2p",
      asset,
      baseCurrency: fiat,
      price: (bestAsk + bestBid) / 2,
      priceBid: bestBid,
      priceAsk: bestAsk,
      availableLiquidity,
      fee: 0,
      latencyMs: (sellAdsRes.latencyMs + buyAdsRes.latencyMs) / 2,
      scrapedAt: new Date().toISOString(),
      metadata: {
        topBuyAds: buyAds.map(a => ({ nick: a.advertiser.nickName, price: a.adv.price })),
        topSellAds: sellAds.map(a => ({ nick: a.advertiser.nickName, price: a.adv.price })),
      },
    };

    return { snapshot, raw: { sellAds, buyAds } };
  },
};
