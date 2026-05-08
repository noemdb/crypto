import { chromium, Browser } from "playwright";
import type { Scraper, ScraperResult } from "./base-scraper";
import type { Asset } from "@/lib/schemas";

let sharedBrowser: Browser | null = null;

export async function closeSharedBrowser() {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

async function getBrowser() {
  if (!sharedBrowser) {
    sharedBrowser = await chromium.launch({ 
      headless: true,
      args: [
        "--disable-http2",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled"
      ]
    });
  }
  return sharedBrowser;
}

export async function scrapeBybitP2P(asset: Asset, fiat: "VES"): Promise<ScraperResult> {
  const start = Date.now();
  const browser = await getBrowser();
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 }
  });
  
  const page = await context.newPage();

  try {
    await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,css}", route => route.abort());

    // Bybit Mobile P2P URL
    const bidUrl = `https://www.bybit.com/fiat/trade/otc/?coin=${asset}&fiat=${fiat}&side=0`;
    await page.goto(bidUrl, { waitUntil: "commit", timeout: 45000 });
    await page.waitForSelector(".price-amount", { timeout: 20000 }).catch(() => null);
    
    const bidAds = await page.$$eval(".trade-table tr, .otc-item", (rows) => {
      return rows.map(row => {
        const price = row.querySelector(".price-amount")?.textContent?.trim();
        const quantity = row.querySelector(".limit-amount, .amount")?.textContent?.trim();
        return { price, quantity };
      }).filter(r => r.price).slice(0, 5);
    });

    const askUrl = `https://www.bybit.com/fiat/trade/otc/?coin=${asset}&fiat=${fiat}&side=1`;
    await page.goto(askUrl, { waitUntil: "commit", timeout: 45000 });
    await page.waitForSelector(".price-amount", { timeout: 20000 }).catch(() => null);
    
    const askAds = await page.$$eval(".trade-table tr, .otc-item", (rows) => {
      return rows.map(row => {
        const price = row.querySelector(".price-amount")?.textContent?.trim();
        const quantity = row.querySelector(".limit-amount, .amount")?.textContent?.trim();
        return { price, quantity };
      }).filter(r => r.price).slice(0, 5);
    });

    if (bidAds.length === 0 || askAds.length === 0) {
      throw new Error(`No ads found on Bybit P2P ${fiat} (Mobile)`);
    }

    const sanitizeNum = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, ""));
    const bestBid = sanitizeNum(bidAds[0]!.price!);
    const bestAsk = sanitizeNum(askAds[0]!.price!);

    const snapshot: import("@/lib/schemas").RawSnapshotInput = {
      platform: "bybit_p2p_ves",
      asset,
      baseCurrency: fiat,
      price: (bestBid + bestAsk) / 2,
      priceBid: bestBid,
      priceAsk: bestAsk,
      availableLiquidity: parseFloat(askAds[0]!.quantity?.split(" ")[0]?.replace(/[^0-9.-]/g, "") || "0"),
      fee: 0,
      latencyMs: Date.now() - start,
      scrapedAt: new Date().toISOString(),
      metadata: { 
        topBuyAds: bidAds, // Bid Ads are the ones we sell to (Buy for them)
        topSellAds: askAds, // Ask Ads are the ones we buy from (Sell for them)
      },
    };

    return { snapshot, raw: { bidAds, askAds } };
  } finally {
    await context.close();
  }
}

export const bybitP2PVESScraper: Scraper = {
  platform: "bybit_p2p_ves",
  supportedAssets: ["USDT", "USDC", "BTC", "ETH"],
  scrape: (asset: Asset) => scrapeBybitP2P(asset, "VES"),
};
