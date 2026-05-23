type ProxyRequestOptions = {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  context: string;
  responseType?: 'json' | 'text';
};

type ProxySuccess<T> = { ok: true; data: T; latencyMs: number };
type ProxyFailure = {
  ok: false;
  error: string;
  statusCode?: number;
  latencyMs: number;
};
export type ProxyResponse<T> = ProxySuccess<T> | ProxyFailure;

export async function proxyRequest<T>(
  opts: ProxyRequestOptions,
): Promise<ProxyResponse<T>> {
  const start = Date.now();
  const maxRetries = opts.retries ?? 2;
  const retryDelay = opts.retryDelayMs ?? 1000;
  const timeout = opts.timeoutMs ?? 8000;

  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, retryDelay * attempt));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const reqInit: RequestInit = {
        method: opts.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...opts.headers,
        },
        signal: controller.signal,
      };

      if (opts.body !== undefined) {
        reqInit.body = JSON.stringify(opts.body);
      }

      const res = await fetch(opts.url, reqInit);

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        console.error(
          `[proxy] ${opts.context} attempt=${attempt} error=${lastError}`,
        );

        // No reintentar en errores del cliente (4xx)
        if (res.status >= 400 && res.status < 500) {
          return {
            ok: false,
            error: lastError,
            statusCode: res.status,
            latencyMs,
          };
        }

        continue;
      }

      let data: T;
      if (opts.responseType === 'text') {
        data = (await res.text()) as unknown as T;
      } else {
        data = (await res.json()) as T;
      }
      console.info(
        `[proxy] ${opts.context} OK latency=${latencyMs}ms attempt=${attempt}`,
      );
      return { ok: true, data, latencyMs };
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err.message : "Unknown error";
      console.error(
        `[proxy] ${opts.context} attempt=${attempt} exception=${lastError}`,
      );
    }
  }

  const latencyMs = Date.now() - start;
  return {
    ok: false,
    error: `After ${maxRetries + 1} attempts: ${lastError}`,
    latencyMs,
  };
}
