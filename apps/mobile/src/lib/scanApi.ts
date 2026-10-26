import type { BillLine, HoldLine, ScannedPart } from "./scanList";
import type { FetchFn } from "./signIn";
import { STAFF_SESSION_HEADER } from "./staffApi";

/**
 * The shop's data that Scan reads and writes — the same API endpoints the web back office's Scan
 * page uses, so both apps record the same movements. Every call carries the signed-in session; the
 * API checks who may do what.
 */

export interface HoldResult {
  variantId: string;
  applied: boolean;
  reason?: string;
  sellableAfter: number;
  heldAfter: number;
}

interface BarcodeHit {
  variantId: string;
  productId: string;
  productRef: string;
  name: string;
}

interface ProductDetail {
  product: { imageKey: string | null };
  onHand: number;
  held: number;
  pricing: { targetPriceSatang: number; itemCostSatang: number } | null;
}

const session = (token: string) => ({ [STAFF_SESSION_HEADER]: token });

function sendJson(token: string, body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { ...session(token), "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** The API's own refusal sentence when it gives one, else the status — never a silent failure. */
async function failure(res: Response, what: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  return new Error(typeof body.error === "string" ? body.error : `${what} (HTTP ${res.status})`);
}

/**
 * A scanned code → the part, with its stock and price for the "3 → 6" preview. Null only when no
 * product has the code; any other failure throws, so a broken connection is never reported as
 * "not found" and pushes someone into adding a duplicate product.
 */
export async function lookupPart(
  fetchFn: FetchFn,
  base: string,
  token: string,
  code: string,
): Promise<ScannedPart | null> {
  const hitRes = await fetchFn(`${base}/products/by-barcode/${encodeURIComponent(code)}`, {
    headers: session(token),
  });
  if (hitRes.status === 404) return null;
  if (!hitRes.ok) throw await failure(hitRes, "Lookup failed");
  const hit = (await hitRes.json()) as BarcodeHit;

  const detailRes = await fetchFn(`${base}/products/${encodeURIComponent(hit.productId)}`, {
    headers: session(token),
  });
  if (!detailRes.ok) throw await failure(detailRes, "Product failed to load");
  const detail = (await detailRes.json()) as ProductDetail;

  return {
    variantId: hit.variantId,
    productId: hit.productId,
    productRef: hit.productRef,
    name: hit.name,
    imageKey: detail.product.imageKey,
    onHand: detail.onHand,
    held: detail.held,
    unitPriceSatang: detail.pricing?.targetPriceSatang ?? 0,
    unitCostSatang: detail.pricing?.itemCostSatang ?? 0,
    qty: 1,
  };
}

/** One batch, one call. Lines are independent: a refused line does not cancel the others. */
export async function moveHold(
  fetchFn: FetchFn,
  base: string,
  token: string,
  lines: HoldLine[],
): Promise<HoldResult[]> {
  const res = await fetchFn(`${base}/stock/hold`, sendJson(token, { lines }));
  if (!res.ok) throw await failure(res, "Hold failed");
  return ((await res.json()) as { results: HoldResult[] }).results;
}

export async function receiveStock(
  fetchFn: FetchFn,
  base: string,
  token: string,
  variantId: string,
  qty: number,
): Promise<{ applied: boolean; quantityAfter: number; reason?: string }> {
  const res = await fetchFn(
    `${base}/stock/adjust`,
    sendJson(token, {
      productVariantId: variantId,
      quantityDelta: qty,
      movementType: "receive",
      reason: "received via Scan",
    }),
  );
  if (!res.ok) throw await failure(res, "Receive failed");
  return (await res.json()) as { applied: boolean; quantityAfter: number; reason?: string };
}

/** Parks the scanned parts as a draft bill; ทำบิล opens it by id, already in the cart. */
export async function parkBill(
  fetchFn: FetchFn,
  base: string,
  token: string,
  draftId: string,
  lines: BillLine[],
): Promise<void> {
  const res = await fetchFn(
    `${base}/onsite/drafts`,
    sendJson(token, { draftId, stage: "draft", saleType: "parts", lines }),
  );
  if (!res.ok) throw await failure(res, "Bill was not saved");
}
