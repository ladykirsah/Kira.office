/** Cloudflare Access JWT header injected at the edge for authenticated requests. */
export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

/** Build the upstream Worker URL from path segments and the request search string. */
export function buildWorkerProxyUrl(
  apiBase: string,
  pathSegments: string[],
  search: string,
): string {
  const base = apiBase.replace(/\/$/, "");
  const path = pathSegments.join("/");
  return `${base}/${path}${search}`;
}

/**
 * Call the API Worker on behalf of the browser, surviving a transient hop failure.
 *
 * WHY THIS EXISTS: the proxy used to `await fetch(...)` bare. A single upstream blip therefore
 * escaped as an unhandled rejection and Next.js rendered a generic 500 — which the owner hit
 * intermittently on /banners, /shop-info and /payments. It looked like an API bug, but the API
 * Worker logged Errors: 0 over the same period: the request never completed the hop, so there was
 * nothing at the far end to log. Two behaviours follow from that:
 *
 *  - A GET is retried ONCE. GETs are idempotent, and a repeat costs one subrequest.
 *  - Anything else is NEVER retried. A POST that failed may still have been applied upstream;
 *    retrying could double-submit an order or a stock movement. One attempt, then honest failure.
 *
 * An upstream that *answers* — 401, 404, 500 — is a real answer and is passed through untouched.
 * Only a thrown fetch (connection reset, DNS, timeout) counts as a hop failure.
 */
export async function fetchUpstream(
  fetchImpl: typeof fetch,
  target: string,
  init: RequestInit,
  method: string,
): Promise<Response> {
  const attempts = method === "GET" || method === "HEAD" ? 2 : 1;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchImpl(target, init);
    } catch (err) {
      lastError = err;
    }
  }

  // Deliberately 502, not 500: the admin app is healthy, the hop to the API failed. That
  // distinction is what tells the next person to look at connectivity and not at route code.
  console.error("worker proxy: upstream unreachable", {
    target,
    method,
    attempts,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });
  return new Response(JSON.stringify({ error: "upstream_unreachable" }), {
    status: 502,
    headers: { "content-type": "application/json" },
  });
}

/** Headers to forward from the admin app to the API Worker (Access JWT + content type). */
export function workerProxyForwardHeaders(incoming: Headers): Headers {
  const out = new Headers();
  const ct = incoming.get("content-type");
  if (ct) out.set("content-type", ct);
  const jwt = incoming.get(ACCESS_JWT_HEADER);
  if (jwt) out.set(ACCESS_JWT_HEADER, jwt);
  return out;
}

/**
 * Headers to forward from the API Worker's response back to the browser. fetch() has already
 * decompressed the body, so the upstream content-encoding/content-length/transfer-encoding no
 * longer describe what we send — forwarding them makes the browser try to re-decode plain bytes
 * and fail every proxied response with net::ERR_CONTENT_DECODING_FAILED.
 */
export function workerProxyResponseHeaders(upstream: Headers): Headers {
  const out = new Headers(upstream);
  out.delete("content-encoding");
  out.delete("content-length");
  out.delete("transfer-encoding");
  return out;
}
