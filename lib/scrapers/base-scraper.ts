import type { RawSnapshotInput, Platform, Asset } from "@/lib/schemas";

export interface ScraperResult {
  snapshot: RawSnapshotInput;
  raw: unknown; // respuesta original de la API, para metadata
}

export interface Scraper {
  platform: Platform;
  supportedAssets: Asset[];
  scrape(asset: Asset): Promise<ScraperResult>;
}
