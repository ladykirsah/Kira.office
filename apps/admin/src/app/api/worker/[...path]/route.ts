import { apiBase } from "@/lib/apiFetch";
import { buildWorkerProxyUrl, workerProxyForwardHeaders } from "@/lib/workerProxy";

export const runtime = "edge";

async function proxy(request: Request, path: string[]): Promise<Response> {
  const incoming = new URL(request.url);
  const target = buildWorkerProxyUrl(apiBase, path, incoming.search);
  const headers = workerProxyForwardHeaders(request.headers);
  const body =
    request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined;
  const res = await fetch(target, { method: request.method, headers, body });
  return new Response(res.body, { status: res.status, headers: res.headers });
}

type RouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, ctx: RouteCtx) {
  return proxy(request, (await ctx.params).path);
}
export async function POST(request: Request, ctx: RouteCtx) {
  return proxy(request, (await ctx.params).path);
}
export async function PUT(request: Request, ctx: RouteCtx) {
  return proxy(request, (await ctx.params).path);
}
export async function PATCH(request: Request, ctx: RouteCtx) {
  return proxy(request, (await ctx.params).path);
}
export async function DELETE(request: Request, ctx: RouteCtx) {
  return proxy(request, (await ctx.params).path);
}
