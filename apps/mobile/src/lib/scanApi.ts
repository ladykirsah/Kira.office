import { defaultPaymentMethod, parsePaymentMethods } from "@l-shopee/core";
import type { BillLine, SaleRecord, SyncResult } from "./scanSale";
import type { HoldLine, ScannedPart, StockMove } from "./scanTabs";
import type { FetchFn } from "./signIn";
import { STAFF_SESSION_HEADER } from "./staffApi";

/**
 * The shop's data that Scan reads and writes — the same API endpoints the web back office's Scan,
 * ทำบิล and Payment pages use, so both apps record the same movements and sales. Every call carries
 * the signed-in session; the API checks who may do what.
 */

export interface HoldResult {
  variantId: string;
  applied: boolean;
  reason?: string;
  sellableAfter: number;
  heldAfter: number;
}

interface BarcodeHit {
  barcode: string;
  variantId: string;
  productId: string;
  productRef: string;
  name: string;
}

interface ProductDetail {
  product: { imageKey: string | null; brandName: string | null };
  onHand: number;
  held: number;
  pricing: { targetPriceSatang: number; b2bPriceSatang: number; itemCostSatang: number } | null;
  images: { imageKey: string }[];
}

/** The PromptPay account a mechanic's QR pays into, as set on the Shop page. */
export interface PayAccount {
  label: string;
  promptpayId: string;
  /** The name the bank shows; the QR always shows it (owner rule, 30 Oct 2026). Null = not set. */
  accountName: string | null;
}

export const session = (token: string) => ({ [STAFF_SESSION_HEADER]: token });

export function sendJson(token: string, body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { ...session(token), "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** The API's own refusal sentence when it gives one, else the status — never a silent failure. */
export async function failure(res: Response, what: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  return new Error(typeof body.error === "string" ? body.error : `${what} (HTTP ${res.status})`);
}

/**
 * A scanned code → the part, with its photos, stock and both prices for the card. Null only when no
 * product has the code; any other failure throws, so a broken connection is never reported as "not
 * found" and pushes someone into adding a duplicate product.
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
  const gallery = detail.images.map((i) => i.imageKey);
  const cover = detail.product.imageKey;

  return {
    variantId: hit.variantId,
    productId: hit.productId,
    productRef: hit.productRef,
    name: hit.name,
    brandName: detail.product.brandName ?? null,
    barcode: hit.barcode,
    photoKeys: gallery.length > 0 ? gallery : cover ? [cover] : [],
    onHand: detail.onHand,
    held: detail.held,
    unitPriceSatang: detail.pricing?.targetPriceSatang ?? 0,
    b2bPriceSatang: detail.pricing?.b2bPriceSatang ?? 0,
    unitCostSatang: detail.pricing?.itemCostSatang ?? 0,
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

/** One stock movement (received, recounted or written off); the stock ledger records each alone. */
export async function adjustStock(
  fetchFn: FetchFn,
  base: string,
  token: string,
  move: StockMove,
): Promise<{ applied: boolean; reason?: string }> {
  const res = await fetchFn(`${base}/stock/adjust`, sendJson(token, move));
  if (!res.ok) throw await failure(res, "Stock was not saved");
  const body = (await res.json()) as { applied: boolean; reason?: string };
  return body.reason ? { applied: body.applied, reason: body.reason } : { applied: body.applied };
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

/** Every bill number issued so far, so a new bill follows the highest one of the day. */
export async function todaysSaleNumbers(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<(string | null)[]> {
  const res = await fetchFn(`${base}/sales`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Bills failed to load");
  return ((await res.json()) as { sales: { saleNumber: string | null }[] }).sales.map(
    (s) => s.saleNumber,
  );
}

/** A paid sale into the sales ledger: stock comes off and the bill is recorded, as from ทำบิล. */
export async function sendSale(
  fetchFn: FetchFn,
  base: string,
  token: string,
  sale: SaleRecord,
): Promise<SyncResult> {
  const res = await fetchFn(`${base}/sync`, sendJson(token, { sales: [sale] }));
  if (!res.ok) throw await failure(res, "Bill was not saved");
  return (await res.json()) as SyncResult;
}

/** A PromptPay payment onto the shop's payment list, the same record the Payment page keeps. */
export async function recordPayment(
  fetchFn: FetchFn,
  base: string,
  token: string,
  payment: { methodLabel: string; promptpayId: string; amountSatang: number },
): Promise<void> {
  const res = await fetchFn(`${base}/payments`, sendJson(token, payment));
  if (!res.ok) throw await failure(res, "Payment was not recorded");
}

/** Den Air Service's name for the bill and its default PromptPay account for the QR. */
export async function readShop(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<{ name: string; account: PayAccount | null }> {
  const res = await fetchFn(`${base}/shop-info/denair`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Shop details failed to load");
  const body = (await res.json()) as { name?: string | null; paymentMethods?: string | null };
  const method = defaultPaymentMethod(parsePaymentMethods(body.paymentMethods));
  return {
    name: body.name ?? "",
    account: method
      ? {
          label: method.label,
          promptpayId: method.promptpayId,
          accountName: method.accountName?.trim() || null,
        }
      : null,
  };
}
