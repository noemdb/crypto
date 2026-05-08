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

import type { Platform } from "@/lib/schemas";

async function scrapeBinanceP2P(asset: Asset, fiat: string, platform: Platform): Promise<ScraperResult> {
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
    context: `${platform}_buy_${asset}`,
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
    context: `${platform}_sell_${asset}`,
  });

  if (!sellAdsRes.ok) throw new Error(`Binance P2P ${fiat} (SELL) failed: ${sellAdsRes.error}`);
  if (!buyAdsRes.ok) throw new Error(`Binance P2P ${fiat} (BUY) failed: ${buyAdsRes.error}`);

  const sellAds = sellAdsRes.data.data || [];
  const buyAds = buyAdsRes.data.data || [];

  if (sellAds.length === 0 || buyAds.length === 0) {
    throw new Error(`No P2P ads found for ${asset}/${fiat} on Binance`);
  }

  const sanitizeNum = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, ""));
  
  const bestAsk = sanitizeNum(sellAds[0]!.adv.price);
  const bestBid = sanitizeNum(buyAds[0]!.adv.price);

  const tradableQty = sanitizeNum(sellAds[0]!.adv.surplusAmount);
  const maxTrans = sanitizeNum(sellAds[0]!.adv.maxSingleTransAmount);
  const availableLiquidity = Math.min(tradableQty, maxTrans);

  const snapshot: import("@/lib/schemas").RawSnapshotInput = {
    platform,
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
}

export const binanceP2PVESScraper: Scraper = {
  platform: "binance_p2p_ves",
  supportedAssets: ["USDT", "BTC", "ETH"],
  async scrape(asset: Asset) {
    return scrapeBinanceP2P(asset, "VES", "binance_p2p_ves");
  }
};
