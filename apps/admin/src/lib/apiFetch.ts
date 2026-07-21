import { ACCESS_JWT_HEADER } from "./workerProxy";

/**
 * Public API host — used for image URLs and server-side direct calls.
 *
 * Single-domain move: everything now lives under airplusauto.com. Only the admin *Worker* uses
 * this (browser calls go through the same-origin /api/worker proxy below), so it is a
 * server-to-server hop — no CORS entry and no cookie-domain coupling to worry about. The Worker
 * still answers on api.homeseeker.me, so this is reversible by env var alone.
 */
export const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "https://api.airplusauto.com";

/**
 * Fetch the API Worker from the admin app. Browser calls go through the same-origin
 * `/api/worker` proxy so Cloudflare Access JWT is forwarded; server components call
 * the Worker directly and attach the JWT from the incoming page request.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (typeof window !== "undefined") {
    return fetch(`/api/worker${normalized}`, { ...init, credentials: "include" });
  }

  const { headers: nextHeaders } = await import("next/headers");
  const h = await nextHeaders();
  const forward = new Headers(init.headers);
  const jwt = h.get(ACCESS_JWT_HEADER);
  if (jwt) forward.set(ACCESS_JWT_HEADER, jwt);
  return fetch(`${apiBase}${normalized}`, { ...init, headers: forward });
}
