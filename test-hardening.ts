import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

process.env.ENABLE_P2P_SCRAPING = "true";
process.env.ENABLE_TELEGRAM_ALERTS = "false";

import { triggerFullScan } from "./lib/scanner-service";

async function testHardening() {
  console.log("Starting hardening test...");
  try {
    const result = await triggerFullScan();
    console.log("Scan Result:", JSON.stringify(result, null, 2));
    console.log("\nNote: Opportunities between Spot (USD) and P2P (ARS) should now be INVALID.");
  } catch (e) {
    console.error("Scan failed:", e);
  }
}

testHardening().catch(console.error);
