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
