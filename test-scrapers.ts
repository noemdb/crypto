import { binanceSpotScraper } from "./lib/scrapers/binance-spot";
import { bybitSpotScraper } from "./lib/scrapers/bybit-spot";

async function main() {
  console.log("Testing Binance Spot BTC...");
  const binanceRes = await binanceSpotScraper.scrape("BTC");
  console.log(binanceRes.snapshot);

  console.log("\nTesting Bybit Spot BTC...");
  const bybitRes = await bybitSpotScraper.scrape("BTC");
  console.log(bybitRes.snapshot);
}

main().catch(console.error);
