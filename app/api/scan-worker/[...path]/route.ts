import { NextRequest } from 'next/server';

const WORKER_URL = process.env.SCAN_WORKER_URL ?? 'http://127.0.0.1:3333';

async function proxyRequest(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  const path = params.path?.join('/') ?? '';
  const targetUrl = `${WORKER_URL}/${path}${new URL(req.url).search}`;

  const forwardedHeaders = new Headers(req.headers);
  forwardedHeaders.delete('host');

  const init: RequestInit = {
    method: req.method,
    headers: forwardedHeaders,
    body: ['GET', 'HEAD'].includes(req.method) ? null : await req.arrayBuffer(),
    redirect: 'manual',
  };

  const response = await fetch(targetUrl, init);
  const responseBody = await response.arrayBuffer();
  const headers = new Headers(response.headers);
  headers.delete('content-encoding');

  return new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
export const OPTIONS = proxyRequest;
