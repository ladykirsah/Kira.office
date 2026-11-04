import { session } from "./scanApi";
import type { FetchFn } from "./signIn";

/** One product Shopee still needs a stock update for (GET /stock/shopee-worklist). */
export interface ShopeeWorkItem {
  productId: string;
  /** The product code (= Shopee SKU), what the copy icon copies. */
  productRef: string;
  name: string;
  onHand: number;
  /** Net change since the last update; negative = lower it on Shopee. */
  deltaSinceSync: number;
  lastChangedAt: number;
}

/** Throws on a failure: "no work" and "couldn't look" are different answers on หน้าหลัก. */
export async function fetchShopeeWorklist(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<ShopeeWorkItem[]> {
  const res = await fetchFn(`${base}/stock/shopee-worklist`, { headers: session(token) });
  if (!res.ok) throw new Error(`Shopee list failed to load (HTTP ${res.status})`);
  return ((await res.json()) as { items: ShopeeWorkItem[] }).items;
}

/** ล้างที่ทำแล้ว: these products are up to date on Shopee, so they leave the list until stock moves. */
export async function markShopeeSynced(
  fetchFn: FetchFn,
  base: string,
  token: string,
  ids: readonly string[],
): Promise<void> {
  const res = await fetchFn(`${base}/stock/shopee-synced`, {
    method: "POST",
    headers: { ...session(token), "content-type": "application/json" },
    body: JSON.stringify({ productIds: ids }),
  });
  if (!res.ok) throw new Error(`Shopee list failed to clear (HTTP ${res.status})`);
}
