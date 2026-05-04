import { binanceSpotScraper } from "./binance-spot";
import { bybitSpotScraper } from "./bybit-spot";
import type { Scraper } from "./base-scraper";
import type { Platform } from "@/lib/schemas";

export const SCRAPERS: Partial<Record<Platform, Scraper>> = {
  binance_spot: binanceSpotScraper,
  bybit_spot: bybitSpotScraper,
  // binance_p2p, bybit_p2p, airtm, kontigo → Fase 2
};

export function getScraper(platform: Platform): Scraper | undefined {
  return SCRAPERS[platform];
}

export * from "./base-scraper";
