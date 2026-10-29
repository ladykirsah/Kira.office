import type { OrderListRow } from "./orderList";
import type { LabelShop } from "./shippingLabel";
import type { FetchFn } from "./signIn";
import { STAFF_SESSION_HEADER } from "./staffApi";

/**
 * The AirPlus order calls — the same API routes the web back office's Orders pages use, so a
 * payment confirmed or a parcel recorded here is the same record there. Every call carries the
 * signed-in session; the API decides who may do what (slip images and refunds: the owner only).
 */

export interface OrderAddress {
  recipientName: string | null;
  phone: string | null;
  addressLine1: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
}

export interface OrderClaim {
  id: string;
  kind: string;
  state: string;
  reasonNote: string | null;
  resolution: string | null;
  mechanicName: string | null;
  adminNote: string | null;
  assigneeName: string | null;
  carrier: string | null;
  trackingNo: string | null;
  shippingFeeSatang: number | null;
  createdAt: number;
  photoKeys: string[];
  lines: { salesOrderLineId: string; quantity: number }[];
  replacementAddress: OrderAddress | null;
}

/** One order's page, as GET /orders/:id returns it (mirrors OrderDetail in apps/api). */
export interface OrderDetail {
  order: {
    id: string;
    channel: string;
    externalOrderId: string;
    orderStatus: string | null;
    paymentStatus: string | null;
    subtotalSatang: number;
    discountTotalSatang: number;
    shippingFeeSatang: number;
    shippingAutoSatang: number;
    shippingOfferSatang: number | null;
    shippingRealSatang: number | null;
    grandTotalSatang: number;
    orderCreatedAt: number | null;
    importedAt: number;
    buyerUsername: string | null;
    carrier: string | null;
    trackingNo: string | null;
    shipTimeMs: number | null;
    staffNote: string | null;
    slipImageKey: string | null;
    refundBankName: string | null;
    refundAccountNo: string | null;
    refundAccountName: string | null;
    refundSatang: number | null;
    refundedAt: number | null;
    refundActorEmail: string | null;
    refundSlipImageKey: string | null;
  };
  money: {
    customerPaidSatang: number;
    goodsAfterDiscountSatang: number;
    itemCostSatang: number;
    shippingShortfallSatang: number | null;
    profitSatang: number | null;
  };
  refundAction: "needs_refund" | "refunded" | "none";
  customer: {
    id: string;
    customerCode: string | null;
    name: string | null;
    phone: string | null;
    tier: string | null;
    completeCount: number;
    incompleteCount: number;
  } | null;
  address: OrderAddress | null;
  lines: {
    id: string;
    name: string | null;
    brand: string | null;
    sku: string | null;
    imageKey: string | null;
    variantName: string | null;
    productRef: string | null;
    quantity: number;
    unitPriceSatang: number;
    lineTotalSatang: number;
  }[];
  timeline: { event: string; createdAt: number }[];
  claims: OrderClaim[];
  viewerIsSuperAdmin: boolean;
  viewerRole: "super_admin" | "mechanic" | "admin";
  mechanics: string[];
}

const session = (token: string) => ({ [STAFF_SESSION_HEADER]: token });

function send(token: string, method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { ...session(token), "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** A raw image as the request body — how the API takes our outgoing refund slips. */
function sendImage(token: string, image: Blob): RequestInit {
  return {
    method: "POST",
    headers: { ...session(token), "content-type": image.type || "image/jpeg" },
    body: image,
  };
}

/** The API's own refusal sentence when it gives one, else the status — never a silent failure. */
async function failure(res: Response, what: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  return new Error(typeof body.error === "string" ? body.error : `${what} (HTTP ${res.status})`);
}

async function call(fetchFn: FetchFn, url: string, init: RequestInit, what: string): Promise<void> {
  const res = await fetchFn(url, init);
  if (!res.ok) throw await failure(res, what);
}

const orderUrl = (base: string, id: string) => `${base}/orders/${encodeURIComponent(id)}`;
const claimUrl = (base: string, id: string) => `${base}/claims/${encodeURIComponent(id)}`;

export async function fetchOrders(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<OrderListRow[]> {
  const res = await fetchFn(`${base}/orders`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Orders failed to load");
  return ((await res.json()) as { orders: OrderListRow[] }).orders;
}

/** Null when no AirPlus order has this id. */
export async function fetchOrderDetail(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<OrderDetail | null> {
  const res = await fetchFn(orderUrl(base, id), { headers: session(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw await failure(res, "Order failed to load");
  return (await res.json()) as OrderDetail;
}

/** Confirm settles the order (→ to ship); reject sends it back to unpaid and needs a reason. */
export async function reviewPayment(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  decision: "confirm" | "reject",
  reason?: string,
): Promise<void> {
  await call(
    fetchFn,
    `${orderUrl(base, id)}/review-payment`,
    send(token, "POST", reason == null ? { decision } : { decision, reason }),
    "Payment review failed",
  );
}

export async function decideCod(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  decision: "approve" | "deny",
): Promise<void> {
  const paymentStatus = decision === "approve" ? "cod_confirmed" : "cod_denied";
  await call(fetchFn, orderUrl(base, id), send(token, "PATCH", { paymentStatus }), "COD failed");
}

/** The parcel went to the carrier: its details, and the move to in transit, in one write. */
export async function recordDropOff(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  input: { carrier: string; trackingNo: string; shippingRealSatang: number },
): Promise<void> {
  await call(
    fetchFn,
    orderUrl(base, id),
    send(token, "PATCH", { ...input, orderStatus: "shipped" }),
    "Drop-off was not saved",
  );
}

/** A bounced parcel's full refund, proven by our transfer slip. The owner only (API-enforced). */
export async function recordRefund(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  slip: Blob,
): Promise<void> {
  await call(fetchFn, `${orderUrl(base, id)}/refund`, sendImage(token, slip), "Refund failed");
}

export async function moveClaim(
  fetchFn: FetchFn,
  base: string,
  token: string,
  claimId: string,
  state: string,
  details: {
    reason?: string;
    assignee?: string;
    carrier?: string;
    trackingNo?: string;
    shippingFeeSatang?: number;
  } = {},
): Promise<void> {
  await call(
    fetchFn,
    claimUrl(base, claimId),
    send(token, "PATCH", { state, ...details }),
    "Claim was not updated",
  );
}

export async function recordClaimRefund(
  fetchFn: FetchFn,
  base: string,
  token: string,
  claimId: string,
  slip: Blob,
): Promise<void> {
  await call(
    fetchFn,
    `${claimUrl(base, claimId)}/refund`,
    sendImage(token, slip),
    "Claim refund failed",
  );
}

/** A rejected claim's part sent back to the customer. */
export async function recordClaimReturn(
  fetchFn: FetchFn,
  base: string,
  token: string,
  claimId: string,
  input: { carrier: string; trackingNo: string; shippingFeeSatang: number },
): Promise<void> {
  await call(
    fetchFn,
    `${claimUrl(base, claimId)}/return-shipment`,
    send(token, "POST", input),
    "Return shipment was not saved",
  );
}

export async function saveNote(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  staffNote: string,
): Promise<void> {
  await call(
    fetchFn,
    orderUrl(base, id),
    send(token, "PATCH", { staffNote }),
    "Note was not saved",
  );
}

/** A private file (bank slip, claim photo). An image tag cannot send the session, so it is fetched. */
export async function privateFile(
  fetchFn: FetchFn,
  base: string,
  token: string,
  key: string,
): Promise<Blob> {
  const path = key.split("/").map(encodeURIComponent).join("/");
  const res = await fetchFn(`${base}/file/${path}`, { headers: session(token) });
  if (!res.ok) throw new Error(`File failed to load (HTTP ${res.status})`);
  return res.blob();
}

/** AirPlus's saved details for the parcel label's sender, thank-you line and LINE QR. */
export async function fetchLabelShop(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<LabelShop> {
  const res = await fetchFn(`${base}/shop-info/airplus`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Shop details failed to load");
  const body = (await res.json()) as Record<string, string | null | undefined>;
  const text = (key: string) => body[key] ?? "";
  return {
    name: text("name"),
    phone: text("shipFromPhone"),
    address: text("address"),
    postcode: text("shipFromPostcode"),
    lineUrl: text("lineUrl"),
    headline: text("qrHeadline"),
    subtitle: text("qrSubtitle"),
  };
}
