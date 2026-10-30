import { parsePaymentMethods } from "@l-shopee/core";
import type { BillDraft, BillSale, CustomerUpsert, PosLine } from "./posBill";
import { failure, sendJson, session } from "./scanApi";
import type { Buyer, SyncResult } from "./scanSale";
import type { FetchFn } from "./signIn";

/**
 * What ทำบิล reads and writes — the same endpoints the web back office's ทำบิล uses, so both apps
 * record the same bills, drafts and customers. Every call carries the signed-in session.
 */

/** A product as GET /products lists it (sellable stock already leaves out what is on hold). */
export interface ProductRow {
  id: string;
  variantId: string | null;
  productRef: string | null;
  name: string;
  status: string;
  imageKey: string | null;
  brandName: string | null;
  offlinePriceSatang: number;
  b2bPriceSatang?: number;
  itemCostSatang: number;
  onHand: number;
}

/**
 * Parts to pick from: every match in one list, by name, code or brand. Sold out = not there at all
 * (owner, 30 Oct 2026: "0 in stock = hidden … never appear on the pickable list").
 */
export function searchParts(list: readonly ProductRow[], query: string): ProductRow[] {
  const q = query.trim().toLowerCase();
  return list.filter((p) => {
    if (!p.variantId || p.onHand <= 0) return false;
    if (!q) return true;
    return [p.name, p.productRef, p.brandName].some((f) => (f ?? "").toLowerCase().includes(q));
  });
}

export function partLine(p: ProductRow, buyer: Buyer, key: string): PosLine {
  const mechanic = p.b2bPriceSatang ?? 0;
  const useMechanic = buyer === "mechanic" && mechanic > 0;
  return {
    key,
    kind: "part",
    variantId: p.variantId,
    productId: p.id,
    productRef: p.productRef,
    name: p.name,
    photoKey: p.imageKey,
    barcode: null,
    quantity: 1,
    walkInSatang: p.offlinePriceSatang,
    mechanicSatang: mechanic,
    priceSatang: useMechanic ? mechanic : p.offlinePriceSatang,
    useMechanic,
    costSatang: p.itemCostSatang,
    onHand: p.onHand,
  };
}

export function serviceLine(s: { name: string; priceSatang: number }, key: string): PosLine {
  return {
    key,
    kind: "service",
    variantId: null,
    productId: null,
    productRef: null,
    name: s.name,
    photoKey: null,
    barcode: null,
    quantity: 1,
    walkInSatang: s.priceSatang,
    mechanicSatang: 0,
    priceSatang: s.priceSatang,
    useMechanic: false,
    costSatang: 0,
    onHand: null,
  };
}

export interface CustomerDetail {
  customer: {
    licensePlate: string;
    plateProvince: string | null;
    customerName: string | null;
    phone: string | null;
    carModel: string | null;
  } | null;
  history: { createdAt: number }[];
  lastMileage?: { km: number; at: number } | null;
}

export interface CustomerSummary {
  known: boolean;
  name: string | null;
  phones: string[];
  province: string | null;
  car: string | null;
  visits: number;
  lastVisitAt: number | null;
  lastMileage: { km: number; at: number } | null;
}

/** What เริ่มบิล shows for a typed plate: a known customer and car, or a new one. */
export function customerSummary(d: CustomerDetail): CustomerSummary {
  const c = d.customer;
  return {
    known: c !== null || d.history.length > 0,
    name: c?.customerName?.trim() || null,
    phones: (c?.phone ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
    province: c?.plateProvince?.trim() || null,
    car: c?.carModel?.trim() || null,
    visits: d.history.length,
    lastVisitAt: d.history[0]?.createdAt ?? null,
    lastMileage: d.lastMileage ?? null,
  };
}

export interface ServiceRow {
  id: string;
  name: string;
  nameEn: string;
  basePriceSatang: number;
}

export interface CarBrand {
  id: string;
  name: string;
  models: { id: string; name: string }[];
}

/** A parked bill or quotation, as GET /onsite/drafts lists it. */
export interface OpenDraft {
  id: string;
  saleNumber: string | null;
  saleType: string | null;
  licensePlate: string | null;
  vehicle: string | null;
  notes: string | null;
  stage: "draft" | "quotation";
  grandTotalSatang: number;
  discountKind: string | null;
  discountValue: string | null;
  createdAt: number;
  mileageKm?: number | null;
  buyerName?: string | null;
  lines: {
    productVariantId: string | null;
    lineType: "part" | "service";
    description: string;
    barcodeValue?: string | null;
    quantity: number;
    unitPriceSatang: number;
    unitCostSatang?: number;
  }[];
}

/** A PromptPay account to receive into, with the name its bank shows (owner: always under the QR). */
export interface ReceiveAccount {
  id: string;
  label: string;
  promptpayId: string;
  accountName: string | null;
  isDefault: boolean;
}

export async function getJson<T>(
  fetchFn: FetchFn,
  url: string,
  token: string,
  what: string,
): Promise<T> {
  const res = await fetchFn(url, { headers: session(token) });
  if (!res.ok) throw await failure(res, what);
  return (await res.json()) as T;
}

export const fetchProducts = async (fetchFn: FetchFn, base: string, token: string) =>
  (
    await getJson<{ products: ProductRow[] }>(
      fetchFn,
      `${base}/products`,
      token,
      "Products failed to load",
    )
  ).products;

export const fetchServices = async (fetchFn: FetchFn, base: string, token: string) =>
  (
    await getJson<{ services: ServiceRow[] }>(
      fetchFn,
      `${base}/services`,
      token,
      "Services failed to load",
    )
  ).services;

export const fetchCars = async (fetchFn: FetchFn, base: string, token: string) =>
  (
    await getJson<{ brands: CarBrand[] }>(
      fetchFn,
      `${base}/car-fitment`,
      token,
      "Cars failed to load",
    )
  ).brands;

export const fetchCustomer = (fetchFn: FetchFn, base: string, token: string, plate: string) =>
  getJson<CustomerDetail>(
    fetchFn,
    `${base}/customers/${encodeURIComponent(plate.trim())}`,
    token,
    "Customer failed to load",
  );

export const fetchDrafts = async (fetchFn: FetchFn, base: string, token: string) =>
  (
    await getJson<{ drafts: OpenDraft[] }>(
      fetchFn,
      `${base}/onsite/drafts`,
      token,
      "Drafts failed to load",
    )
  ).drafts;

export async function saveCustomer(
  fetchFn: FetchFn,
  base: string,
  token: string,
  upsert: CustomerUpsert,
): Promise<void> {
  const res = await fetchFn(`${base}/customers/by-plate`, {
    ...sendJson(token, upsert),
    method: "PUT",
  });
  if (!res.ok) throw await failure(res, "Customer was not saved");
}

export async function saveDraft(
  fetchFn: FetchFn,
  base: string,
  token: string,
  draft: BillDraft,
): Promise<void> {
  const res = await fetchFn(`${base}/onsite/drafts`, sendJson(token, draft));
  if (!res.ok) throw await failure(res, "Draft was not saved");
}

export async function deleteDraft(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<void> {
  const res = await fetchFn(`${base}/onsite/drafts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: session(token),
  });
  if (!res.ok) throw await failure(res, "Draft was not deleted");
}

/** The issued bill into the sales ledger: stock comes off, keyed on clientUuid so a resend is safe. */
export async function sendBill(
  fetchFn: FetchFn,
  base: string,
  token: string,
  sale: BillSale,
): Promise<SyncResult> {
  const res = await fetchFn(`${base}/sync`, sendJson(token, { sales: [sale] }));
  if (!res.ok) throw await failure(res, "Bill was not saved");
  return (await res.json()) as SyncResult;
}

/** Den Air Service's name for the bill and every PromptPay account it can receive into. */
export async function readShopAccounts(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<{ name: string; accounts: ReceiveAccount[] }> {
  const body = await getJson<{ name?: string | null; paymentMethods?: string | null }>(
    fetchFn,
    `${base}/shop-info/denair`,
    token,
    "Shop details failed to load",
  );
  return {
    name: body.name ?? "",
    accounts: parsePaymentMethods(body.paymentMethods).map((m) => ({
      id: m.id,
      label: m.label,
      promptpayId: m.promptpayId,
      accountName: m.accountName?.trim() || null,
      isDefault: m.isDefault === true,
    })),
  };
}
