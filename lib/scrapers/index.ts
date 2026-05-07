import { binanceSpotScraper } from "./binance-spot";
import { bybitSpotScraper } from "./bybit-spot";
import { binanceP2PScraper } from "./binance-p2p";
import { binanceP2PVESScraper } from "./binance-p2p-ves";
import { bybitP2PScraper } from "./bybit-p2p";
import type { Scraper } from "./base-scraper";
import type { Platform } from "@/lib/schemas";

export const SCRAPERS: Partial<Record<Platform, Scraper>> = {
  binance_spot: binanceSpotScraper,
  bybit_spot: bybitSpotScraper,
  binance_p2p: binanceP2PScraper,
  binance_p2p_ves: binanceP2PVESScraper,
  bybit_p2p: bybitP2PScraper,
  // airtm, kontigo → Fase 2
};

export function getScraper(platform: Platform): Scraper | undefined {
  return SCRAPERS[platform];
}

export * from "./base-scraper";
