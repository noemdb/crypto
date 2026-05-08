import type { MarketSnapshot } from "@/lib/schemas";

export type TriangularCycle = {
  exchange: string;
  assets: [string, string, string]; // [A, B, C]
  snapshots: [MarketSnapshot, MarketSnapshot, MarketSnapshot];
};

/**
 * Detects all possible 3-node cycles for a given set of snapshots within the same exchange.
 * A cycle is A -> B -> C -> A.
 */
export function detectTriangularCycles(snapshots: MarketSnapshot[]): TriangularCycle[] {
  const cycles: TriangularCycle[] = [];
  
  // Group snapshots by platform
  const byPlatform: Record<string, MarketSnapshot[]> = {};
  for (const s of snapshots) {
    if (!byPlatform[s.platform]) byPlatform[s.platform] = [];
    byPlatform[s.platform]!.push(s);
  }

  for (const [platform, platformSnapshots] of Object.entries(byPlatform)) {
    // Only process platforms that are likely to have triangular pairs (spot exchanges)
    if (platform.includes("p2p") || platform.includes("airtm") || platform.includes("kontigo")) continue;

    // Build an adjacency list of assets
    // asset -> [{ to: string, snapshot: MarketSnapshot, isInverse: boolean }]
    // Example: Pair ETH/BTC means we can go BTC -> ETH (BUY) or ETH -> BTC (SELL)
    const adj: Record<string, Array<{ to: string, snapshot: MarketSnapshot, action: "BUY" | "SELL" }>> = {};

    for (const s of platformSnapshots) {
      const base = s.asset; // ETH
      const quote = s.baseCurrency; // BTC
      
      if (!adj[quote]) adj[quote] = [];
      adj[quote].push({ to: base, snapshot: s, action: "BUY" });
      
      if (!adj[base]) adj[base] = [];
      adj[base].push({ to: quote, snapshot: s, action: "SELL" });
    }

    // Find cycles of length 3
    const assets = Object.keys(adj);
    for (const a of assets) {
      const neighborsA = adj[a] || [];
      for (const edge1 of neighborsA) {
        const b = edge1.to;
        if (b === a) continue;
        
        const neighborsB = adj[b] || [];
        for (const edge2 of neighborsB) {
          const c = edge2.to;
          if (c === a || c === b) continue;
          
          const neighborsC = adj[c] || [];
          for (const edge3 of neighborsC) {
            if (edge3.to === a) {
              // Found a cycle: A -> B -> C -> A
              // To avoid duplicates (A-B-C, B-C-A, C-A-B), we can sort the assets
              // and only add if 'a' is the smallest.
              const cycleAssets = [a, b, c];
              if (a < b && a < c) {
                cycles.push({
                  exchange: platform,
                  assets: [a, b, c],
                  snapshots: [edge1.snapshot, edge2.snapshot, edge3.snapshot],
                });
              }
            }
          }
        }
      }
    }
  }

  return cycles;
}
