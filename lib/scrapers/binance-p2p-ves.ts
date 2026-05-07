import { proxyRequest } from "@/lib/proxy";
import type { Scraper, ScraperResult } from "./base-scraper";
import type { Asset } from "@/lib/schemas";

const BINANCE_P2P_API = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

type BinanceP2PAd = {
  adv: {
    price: string;
    surplusAmount: string;
  };
  advertiser: {
    nickName: string;
  };
};

type BinanceP2PResponse = {
  data: BinanceP2PAd[];
};

export const binanceP2PVESScraper: Scraper = {
  platform: "binance_p2p_ves",
  supportedAssets: ["USDT", "BTC", "ETH"], // En VES también se usa mucho BTC/ETH

  async scrape(asset: Asset): Promise<ScraperResult> {
    const fiat = "VES";

    const sellAdsRes = await proxyRequest<BinanceP2PResponse>({
      url: BINANCE_P2P_API,
      method: "POST",
      body: {
        asset,
        fiat,
        merchantCheck: false,
        page: 1,
        payTypes: [],
        rows: 5,
        tradeType: "SELL",
      },
      context: `binance_p2p_ves_buy_${asset}`,
    });

    const buyAdsRes = await proxyRequest<BinanceP2PResponse>({
      url: BINANCE_P2P_API,
      method: "POST",
      body: {
        asset,
        fiat,
        merchantCheck: false,
        page: 1,
        payTypes: [],
        rows: 5,
        tradeType: "BUY",
      },
      context: `binance_p2p_ves_sell_${asset}`,
    });

    if (!sellAdsRes.ok) throw new Error(`Binance P2P VES (SELL) failed: ${sellAdsRes.error}`);
    if (!buyAdsRes.ok) throw new Error(`Binance P2P VES (BUY) failed: ${buyAdsRes.error}`);

    const sellAds = sellAdsRes.data.data || [];
    const buyAds = buyAdsRes.data.data || [];

    // Sanitizado de strings y parsing seguro (Distinguished Engineer Rule)
    const sanitizeNum = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, ""));
    
    const bestAsk = sanitizeNum(sellAds[0]!.adv.price);
    const bestBid = sanitizeNum(buyAds[0]!.adv.price);

    // Cálculo de liquidez real disponible
    const tradableQty = sanitizeNum(sellAds[0]!.adv.surplusAmount);
    const availableLiquidity = tradableQty; // En VES simplificamos o usamos surplus

    const snapshot: import("@/lib/schemas").RawSnapshotInput = {
      platform: "binance_p2p_ves",
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
