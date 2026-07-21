import { apiBase } from "@/lib/apiFetch";
import {
  buildWorkerProxyUrl,
  workerProxyForwardHeaders,
  workerProxyResponseHeaders,
  fetchUpstream,
} from "@/lib/workerProxy";

// Runs in the OpenNext/Cloudflare Workers server function (already at the edge) — NOT Next's edge
// runtime, which OpenNext can't bundle into a single function. The proxy only does fetch(), so this
// is behaviourally a no-op; it just lets the admin build for Cloudflare. force-dynamic keeps the
// route from being statically evaluated at build time.
export const dynamic = "force-dynamic";

async function proxy(request: Request, path: string[]): Promise<Response> {
  const incoming = new URL(request.url);
  const target = buildWorkerProxyUrl(apiBase, path, incoming.search);
  const headers = workerProxyForwardHeaders(request.headers);
  const body =
    request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined;
  // fetchUpstream, not bare fetch: a thrown hop used to escape as a generic Next.js 500 (see the
  // note on fetchUpstream). GETs retry once; writes never do.
  const res = await fetchUpstream(
    fetch,
    target,
    { method: request.method, headers, body },
    request.method,
  );
  return new Response(res.body, {
    status: res.status,
    headers: workerProxyResponseHeaders(res.headers),
  });
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
