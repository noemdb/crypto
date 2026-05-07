import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import http from "node:http";
import { URL } from "node:url";

(async () => {

  const { triggerFullScan } = await import("../lib/scanner-service");

  const PORT = Number(process.env.PORT ?? process.env.SCAN_WORKER_PORT ?? 3333);
  const INTERVAL_SECONDS = Number(process.env.SCAN_WORKER_INTERVAL ?? 180);
  const IP_CHECK_URL = process.env.SCAN_WORKER_IP_URL ?? "https://api.ipify.org?format=json";

  type WorkerMode = "idle" | "manual" | "online";

  type WorkerState = {
    lastMode: WorkerMode;
    onlineActive: boolean;
    currentExecution: boolean;
    intervalSeconds: number;
    lastRunAt: string | null;
    /** ISO timestamp of the next scheduled online scan. Null when not in online mode. */
    nextRunAt: string | null;
    lastStatus: "success" | "failure" | null;
    lastError: string | null;
    sourceIpMode: "device-executor";
    timer: NodeJS.Timeout | null;
  };

  const state: WorkerState = {
    lastMode: "idle",
    onlineActive: false,
    currentExecution: false,
    intervalSeconds: INTERVAL_SECONDS,
    lastRunAt: null,
    nextRunAt: null,
    lastStatus: null,
    lastError: null,
    sourceIpMode: "device-executor",
    timer: null,
    };

  function getResponseState() {
    const running = state.currentExecution;
    const mode: WorkerMode = state.onlineActive ? "online" : state.lastMode;
    return {
      mode,
      running,
      intervalSeconds: state.intervalSeconds,
      lastRunAt: state.lastRunAt,
      nextRunAt: state.nextRunAt,
      lastStatus: state.lastStatus,
      lastError: state.lastError,
      sourceIpMode: state.sourceIpMode,
    };
    }

  function sendJson(res: http.ServerResponse, body: unknown, status = 200) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end(payload);
  }

  function sendError(res: http.ServerResponse, message: string, status = 500) {
    sendJson(res, { error: message }, status);
    }

  function stopOnlineLoop() {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    state.onlineActive = false;
    state.nextRunAt = null;
    if (!state.currentExecution) {
      state.lastMode = "idle";
    }
    }

  async function performScan(manualTrigger: boolean) {
    if (state.currentExecution) {
      return { success: false, error: "A scan is already in progress." };
    }

    state.currentExecution = true;
    state.lastMode = manualTrigger ? "manual" : "online";
    state.lastRunAt = new Date().toISOString();
    state.lastError = null;
    state.lastStatus = null;

    try {
      await triggerFullScan();
      state.lastStatus = "success";
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      state.lastStatus = "failure";
      state.lastError = message;
      return { success: false, error: message };
    } finally {
      state.currentExecution = false;
      if (!state.onlineActive && state.lastMode === "online") {
        state.lastMode = "idle";
      }
    }
    }

  async function scheduleOnlineScan() {
    if (!state.onlineActive) {
      return;
    }

    // Clear nextRunAt while scan is running
    state.nextRunAt = null;
    const scanResult = await performScan(false);
    if (!scanResult.success) {
      console.error("[worker] Online scan failed:", scanResult.error);
    }

    if (!state.onlineActive) {
      return;
    }

    // Record when the next scan will fire before scheduling it
    state.nextRunAt = new Date(Date.now() + state.intervalSeconds * 1000).toISOString();
    state.timer = setTimeout(scheduleOnlineScan, state.intervalSeconds * 1000);
    }

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;
    const method = req.method ?? "GET";

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    if (pathname === "/scan/status" && method === "GET") {
      sendJson(res, getResponseState());
      return;
      }

    if (pathname === "/scan/manual" && method === "POST") {
      if (state.onlineActive) {
        sendError(res, "Online mode is currently active. Stop online scans before running a manual scan.", 409);
        return;
      }

      const result = await performScan(true);
      if (!result.success) {
        sendError(res, result.error ?? "Manual scan failed", 502);
        return;
      }

      sendJson(res, { success: true, result: getResponseState() });
      return;
      }

    if (pathname === "/scan/online/start" && method === "POST") {
      if (state.onlineActive) {
        sendError(res, "Online scan is already active.", 409);
        return;
      }

      state.onlineActive = true;
      state.lastMode = "online";
      state.timer = null;
      scheduleOnlineScan().catch((error) => {
        console.error("[worker] scheduleOnlineScan error:", error);
      });

      sendJson(res, { success: true, result: getResponseState() });
      return;
      }

    if (pathname === "/scan/online/stop" && method === "POST") {
      if (!state.onlineActive) {
        sendError(res, "Online scan is not active.", 409);
        return;
      }

      stopOnlineLoop();
      sendJson(res, { success: true, result: getResponseState() });
      return;
      }

    if (pathname === "/scan/ip" && method === "GET") {
      try {
        const ipResponse = await fetch(IP_CHECK_URL, { method: "GET" });
        if (!ipResponse.ok) {
          throw new Error(`IP check responded with ${ipResponse.status}`);
        }
        const body = await ipResponse.text();
        let ip = body;
        try {
          const parsed = JSON.parse(body);
          if (typeof parsed.ip === "string") {
            ip = parsed.ip;
          }
        } catch {
          // ignore parse error and return text as-is
        }
        sendJson(res, { ip, sourceIpMode: state.sourceIpMode });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        sendError(res, `IP lookup failed: ${message}`, 502);
      }
      return;
    }

    sendError(res, "Endpoint not found", 404);
    }

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error("[worker] request failure", error);
      sendError(res, "Internal server error", 500);
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[worker] Scan worker listening on http://0.0.0.0:${PORT}`);
    console.log(`[worker] Online interval: ${INTERVAL_SECONDS}s`);
  });

  process.on("SIGINT", async () => {
    console.log("[worker] Shutting down...");
    stopOnlineLoop();
    const { closeSharedBrowser } = await import("../lib/scrapers/bybit-p2p");
    await closeSharedBrowser();
    server.close(() => process.exit(0));
  });
  
  process.on("SIGTERM", async () => {
    console.log("[worker] Shutting down...");
    stopOnlineLoop();
    const { closeSharedBrowser } = await import("../lib/scrapers/bybit-p2p");
    await closeSharedBrowser();
    server.close(() => process.exit(0));
  });

})();
