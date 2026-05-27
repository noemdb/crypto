import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import http from "node:http";
import { URL } from "node:url";

(async () => {

  const { triggerFullScan } = await import("../lib/scanner-service");
  const { prisma } = await import("../lib/db/prisma");

  const PORT = Number(process.env.PORT ?? process.env.SCAN_WORKER_PORT ?? 3333);
  const DEFAULT_INTERVAL = Number(process.env.SCAN_WORKER_INTERVAL ?? 180);
  const IP_CHECK_URL = process.env.SCAN_WORKER_IP_URL ?? "https://api.ipify.org?format=json";

  // Initial fetch of config to set the interval
  let initialInterval = DEFAULT_INTERVAL;
  try {
    const dbConfig = await prisma.userConfig.findFirst();
    if (dbConfig?.scanIntervalSeconds) {
      initialInterval = dbConfig.scanIntervalSeconds;
      console.log(`[worker] Initialized with DB interval: ${initialInterval}s`);
    } else {
      console.log(`[worker] No DB config found, using default interval: ${initialInterval}s`);
    }
  } catch (error) {
    console.warn("[worker] Failed to fetch initial config, using default:", initialInterval + "s");
  }

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
    lastMode: "online",
    onlineActive: true,
    currentExecution: false,
    intervalSeconds: initialInterval,
    lastRunAt: null,
    nextRunAt: null,
    lastStatus: null,
    lastError: null,
    sourceIpMode: "device-executor",
    timer: null,
  };

  // ── Log Capture System ────────────────────────────────────────────────────────
  type LogEntry = {
    timestamp: string;
    level: "info" | "warn" | "error";
    message: string;
  };
  const MAX_LOGS = 200;
  const logHistory: LogEntry[] = [];

  function addLog(level: "info" | "warn" | "error", args: any[]) {
    const timestamp = new Date().toISOString();
    const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    logHistory.push({ timestamp, level, message });
    if (logHistory.length > MAX_LOGS) logHistory.shift();
  }

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args) => { addLog("info", args); originalLog(...args); };
  console.info = (...args) => { addLog("info", args); originalInfo(...args); };
  console.warn = (...args) => { addLog("warn", args); originalWarn(...args); };
  console.error = (...args) => { addLog("error", args); originalError(...args); };

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
    state.lastError = null;
    state.lastStatus = null;

    try {
      await triggerFullScan();
      state.lastRunAt = new Date().toISOString();
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

    // Fetch latest config before each cycle
    try {
      const config = await prisma.userConfig.findFirst();
      if (config?.scanIntervalSeconds) {
        state.intervalSeconds = config.scanIntervalSeconds;
      }
    } catch (error) {
      console.warn("[worker] Failed to fetch latest config, using current interval:", error instanceof Error ? error.message : error);
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

    if (pathname === "/scan/logs" && method === "GET") {
      sendJson(res, { logs: logHistory });
      return;
    }

    if (pathname === "/scan/manual" && method === "POST") {
      // Permitir escaneo manual si no hay uno en progreso (performScan ya lo valida)
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
    console.log(`[worker] Online interval: ${state.intervalSeconds}s`);
    console.log(`[worker] Auto-starting online mode...`);
    scheduleOnlineScan().catch((error) => {
      console.error("[worker] Auto-start scheduleOnlineScan error:", error);
    });
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
