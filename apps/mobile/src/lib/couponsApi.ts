import type { Coupon } from "./couponPage";
import { failure, sendJson, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/**
 * คูปอง's calls — the endpoints the web back office's coupon page uses. Every call carries the
 * signed-in session; the server records who made a coupon from it.
 */

const couponUrl = (base: string, id: string) => `${base}/coupons/${encodeURIComponent(id)}`;

/** Every coupon, newest first, with how many times each was used. */
export async function fetchCoupons(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<Coupon[]> {
  const res = await fetchFn(`${base}/coupons`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Coupons failed to load");
  return ((await res.json()) as { coupons: Coupon[] }).coupons;
}

/** A new coupon; taken when another coupon already has the code (the form says so under โค้ด). */
export async function createCoupon(
  fetchFn: FetchFn,
  base: string,
  token: string,
  body: unknown,
): Promise<{ id: string } | { taken: true }> {
  const res = await fetchFn(`${base}/coupons`, sendJson(token, body));
  if (res.status === 409) return { taken: true };
  if (!res.ok) throw await failure(res, "Coupon was not saved");
  return { id: ((await res.json()) as { id: string }).id };
}

/** Only the fields sent change. */
export async function updateCoupon(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  patch: unknown,
): Promise<void> {
  const res = await fetchFn(couponUrl(base, id), { ...sendJson(token, patch), method: "PATCH" });
  if (!res.ok) throw await failure(res, "Coupon was not saved");
}

/** Gone for good — unless someone has used it (then the server keeps it, as sales history). */
export async function deleteCoupon(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<"deleted" | "used"> {
  const res = await fetchFn(couponUrl(base, id), { method: "DELETE", headers: session(token) });
  if (res.status === 409) return "used";
  if (!res.ok) throw await failure(res, "Coupon was not deleted");
  return "deleted";
}
