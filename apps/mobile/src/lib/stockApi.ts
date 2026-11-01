import { failure, session } from "./scanApi";
import type { FetchFn } from "./signIn";
import type { Movement } from "./stockHistory";

/**
 * ประวัติซื้อขาย's one call: the stock changes, newest first. No period → the latest ones; a period
 * (both ends included, ms) → every change in it, up to the server's limit, which comes back too.
 */
export async function fetchMovements(
  fetchFn: FetchFn,
  base: string,
  token: string,
  period: { start: number; end: number } | null,
): Promise<{ movements: Movement[]; limit: number }> {
  const query = period ? `?from=${period.start}&to=${period.end}` : "";
  const res = await fetchFn(`${base}/stock/movements${query}`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Stock history failed to load");
  return (await res.json()) as { movements: Movement[]; limit: number };
}
