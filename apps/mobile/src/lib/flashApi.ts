import type { FlashSale } from "./flashPage";
import { failure, sendJson, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/**
 * แฟลชเซล's calls. A new sale goes up with its products in one POST, and แก้แคมเปญ's บันทึก in one
 * PATCH (added, changed and binned products together), so a sale is never left half-saved.
 */

const saleUrl = (base: string, id: string) => `${base}/campaigns/${encodeURIComponent(id)}`;

/** Every sale, newest first, each with its products. */
export async function fetchSales(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<FlashSale[]> {
  const res = await fetchFn(`${base}/campaigns`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Flash sales failed to load");
  return ((await res.json()) as { campaigns: FlashSale[] }).campaigns;
}

/** A new sale with its products; the new sale's id. */
export async function createSale(
  fetchFn: FetchFn,
  base: string,
  token: string,
  body: unknown,
): Promise<string> {
  const res = await fetchFn(`${base}/campaigns`, sendJson(token, body));
  if (!res.ok) throw await failure(res, "Flash sale was not saved");
  return ((await res.json()) as { id: string }).id;
}

export async function updateSale(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  patch: unknown,
): Promise<void> {
  const res = await fetchFn(saleUrl(base, id), { ...sendJson(token, patch), method: "PATCH" });
  if (!res.ok) throw await failure(res, "Flash sale was not saved");
}

/** The sale and its products go; their prices go back to normal. */
export async function deleteSale(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<void> {
  const res = await fetchFn(saleUrl(base, id), { method: "DELETE", headers: session(token) });
  if (!res.ok) throw await failure(res, "Flash sale was not deleted");
}
