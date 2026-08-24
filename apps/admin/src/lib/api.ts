/** Typed client for the kiraoffice API Worker. */
import { apiFetch, apiBase } from "./apiFetch";
import type { ShopProfile } from "@l-shopee/core";
import type { DraftApiLine } from "./posDraft";

export { apiBase };

export interface ProductRow {
  id: string;
  variantId: string | null;
  productRef: string;
  name: string;
  status: string;
  imageKey: string | null;
  shopeeListed: number;
  brandName: string | null;
  typeName: string | null;
  usageName: string | null;
  carBrands: string[];
  offlinePriceSatang: number;
  onlinePriceSatang: number;
  b2bPriceSatang?: number; // wholesale price (optional until the list API exposes it)
  itemCostSatang: number;
  onlineCommissionBp: number;
  taxOnCost: number;
  /** Sellable stock (held already excluded). */
  onHand: number;
  /** Net quantity on hold (paused, not for sale). */
  held: number;
}

/**
 * The admin products list.
 *
 * `includeArchived` is OPT-IN and only the products table passes it, for the merged "Not live" tab.
 * The POS and the Barcodes page call this too — an archived product must never reach either, or a
 * deleted part could be sold or labelled.
 */
export async function fetchProducts(
  opts: { includeArchived?: boolean } = {},
): Promise<ProductRow[]> {
  const qs = opts.includeArchived ? "?includeArchived=1" : "";
  const res = await apiFetch(`/products${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load products (HTTP ${res.status})`);
  type Raw = Omit<ProductRow, "carBrands"> & { carBrandsCsv: string | null };
  const data = (await res.json()) as { products: Raw[] };
  return data.products.map(({ carBrandsCsv, ...rest }) => ({
    ...rest,
    carBrands: carBrandsCsv ? carBrandsCsv.split(",") : [],
  }));
}

export interface CreateProductInput {
  productRef: string;
  name: string;
  description?: string;
  barcode?: string;
}

export interface CreateProductResult {
  productId: string;
  variantId: string | null;
  created: boolean;
}

export async function createProduct(input: CreateProductInput): Promise<CreateProductResult> {
  const res = await apiFetch(`/products`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Create failed (HTTP ${res.status})`);
  }
  return (await res.json()) as CreateProductResult;
}

export interface BarcodeLookup {
  barcode: string;
  variantId: string;
  productId: string;
  productRef: string;
  name: string;
}

export async function lookupBarcode(code: string): Promise<BarcodeLookup | null> {
  const res = await apiFetch(`/products/by-barcode/${encodeURIComponent(code)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lookup failed (HTTP ${res.status})`);
  return (await res.json()) as BarcodeLookup;
}

export type IdentifierKind = "ref" | "barcode" | "shopee";
export interface IdentifierMatch {
  id: string;
  name: string;
  productRef: string;
  status: string;
}

/** Does any product (active or not) already use this Product ID / barcode / Shopee ID? */
export async function checkIdentifier(
  kind: IdentifierKind,
  value: string,
): Promise<IdentifierMatch | null> {
  const res = await apiFetch(
    `/products/identifier-check?kind=${kind}&value=${encodeURIComponent(value)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return ((await res.json()) as { match: IdentifierMatch | null }).match;
}

export interface ProductImage {
  id: string;
  imageKey: string;
  sortOrder: number;
  isCover: number;
}

export type AttrKind = "brand" | "type" | "usage" | "car_brand" | "car_model";
export interface AttrOption {
  id: string;
  name: string;
  /** Cover-image R2 key — product types and car brands only; null/absent for other kinds. */
  imageKey?: string | null;
  /** Thai display name (migration 0060). Null until the owner supplies one. */
  nameTh?: string | null;
  /** English display name (migration 0060). Null until the owner supplies one. */
  nameEn?: string | null;
  /** Product categories only (migration 0064): the car system (usage id) this category belongs to. */
  usageId?: string | null;
}
export interface Attributes {
  brands: AttrOption[];
  types: AttrOption[];
  usages: AttrOption[];
  carBrands: AttrOption[];
  carModels: AttrOption[];
}

export interface Fitment {
  carBrand: string | null;
  carModel: string | null;
  yearFrom: number | null;
  yearTo: number | null;
}

export async function fetchAttributes(): Promise<Attributes> {
  const res = await apiFetch(`/attributes`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load attributes (HTTP ${res.status})`);
  return (await res.json()) as Attributes;
}

/** Warranty/return window (days) per product category — the storefront shows it on each PDP. */
export interface TypeWarranty {
  id: string;
  name: string;
  warrantyDays: number | null;
}

export async function fetchTypeWarranties(): Promise<TypeWarranty[]> {
  const res = await apiFetch(`/product-types/warranty`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load warranties (HTTP ${res.status})`);
  return (await res.json()) as TypeWarranty[];
}

export async function setTypeWarranty(id: string, warrantyDays: number | null): Promise<void> {
  const res = await apiFetch(`/product-types/${id}/warranty`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ warrantyDays }),
  });
  if (!res.ok) throw new Error(`Failed to save warranty (HTTP ${res.status})`);
}

/** Move a product category to a different car system (migration 0064). */
export async function setTypeCarSystem(id: string, usageId: string): Promise<void> {
  const res = await apiFetch(`/product-types/${id}/car-system`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ usageId }),
  });
  if (!res.ok) throw new Error(`Failed to move category (HTTP ${res.status})`);
}

export async function addAttribute(
  kind: AttrKind,
  name: string,
  extra?: { nameTh?: string | null; nameEn?: string | null; usageId?: string | null },
): Promise<AttrOption> {
  const res = await apiFetch(`/attributes/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, ...extra }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Add failed (HTTP ${res.status})`);
  }
  return (await res.json()) as AttrOption;
}

export async function deleteAttribute(kind: AttrKind, id: string): Promise<void> {
  const res = await apiFetch(`/attributes/${kind}/${id}`, { method: "DELETE" });
  if (res.status === 409) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`${err.error ?? "still in use"} — reassign those products first.`);
  }
  if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
}

/**
 * Save a row's Thai / English display names. PATCH, not PUT: `name` is the identity other tables
 * join on as free text and is never edited here — only the two display columns.
 */
export async function setAttributeNames(
  kind: AttrKind,
  id: string,
  names: { nameTh: string | null; nameEn: string | null },
): Promise<void> {
  const res = await apiFetch(`/attributes/${kind}/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(names),
  });
  if (!res.ok) throw new Error(`Save names failed (HTTP ${res.status})`);
}

export interface ServiceRow {
  id: string;
  name: string;
  nameEn: string;
  basePriceSatang: number;
}

export async function fetchServices(): Promise<ServiceRow[]> {
  const res = await apiFetch(`/services`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load services (HTTP ${res.status})`);
  return ((await res.json()) as { services: ServiceRow[] }).services;
}

export async function addService(
  name: string,
  nameEn: string,
  basePriceSatang: number,
): Promise<ServiceRow> {
  const res = await apiFetch(`/services`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, nameEn, basePriceSatang }),
  });
  if (!res.ok) throw new Error(`Add service failed (HTTP ${res.status})`);
  return (await res.json()) as ServiceRow;
}

export async function updateService(
  id: string,
  fields: { name: string; nameEn: string; basePriceSatang: number },
): Promise<void> {
  const res = await apiFetch(`/services/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`Update service failed (HTTP ${res.status})`);
}

export async function deleteService(id: string): Promise<void> {
  const res = await apiFetch(`/services/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete service failed (HTTP ${res.status})`);
}

// ── On-site drafts & quotations ────────────────────────────────────────────────────────────────
export interface SaveDraftInput {
  draftId: string;
  stage: "draft" | "quotation";
  saleNumber?: string | null;
  saleType?: "parts" | "repair";
  licensePlate?: string | null;
  vehicle?: string | null;
  notes?: string | null;
  lines: DraftApiLine[];
  // Bill-level discount carried on the header (not per line) so a quotation stores/prints/reopens
  // at the discounted price. `discountSatang` is the computed amount; kind/value are the raw input.
  discountSatang?: number;
  discountKind?: string;
  discountValue?: string;
}

/** A parked draft/quotation returned by GET /onsite/drafts, with its lines, for the reopen tray. */
export interface OpenDraft {
  id: string;
  saleNumber: string | null;
  saleType: string | null;
  licensePlate: string | null;
  vehicle: string | null;
  notes: string | null;
  stage: "draft" | "quotation";
  grandTotalSatang: number;
  discountTotalSatang: number;
  discountKind: string | null;
  discountValue: string | null;
  createdAt: number;
  lines: DraftApiLine[];
}

export async function saveDraft(input: SaveDraftInput): Promise<void> {
  const res = await apiFetch(`/onsite/drafts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Save draft failed (HTTP ${res.status})`);
}

export async function listDrafts(): Promise<OpenDraft[]> {
  const res = await apiFetch(`/onsite/drafts`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load drafts (HTTP ${res.status})`);
  return ((await res.json()) as { drafts: OpenDraft[] }).drafts;
}

export async function deleteDraft(id: string): Promise<void> {
  const res = await apiFetch(`/onsite/drafts/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete draft failed (HTTP ${res.status})`);
}

// ── Customers (car directory + service history) ─────────────────────────────────────────────────
export interface CustomerListItem {
  licensePlate: string;
  vehicle: string | null;
  customerName: string | null;
  phone: string | null;
  carModel: string | null;
  billCount: number;
  lastVisitAt: number | null; // null = imported/added to the directory, no bill yet
}

export interface CustomerSaleLine {
  onsiteSaleId?: string;
  description: string | null;
  lineType: string;
  quantity: number;
  unitPriceSatang: number;
  discountSatang: number;
  /** The Product ID of the exact part installed (null for service lines / unlinked lines). */
  productRef?: string | null;
}

export interface LegacyLine {
  description: string;
  productRef: string | null;
}
export interface CustomerLegacyEntry {
  id: string;
  happenedAt: number;
  note: string | null;
  lines: LegacyLine[];
}

export interface CustomerSale {
  id: string;
  saleNumber: string | null;
  stage: string;
  createdAt: number;
  subtotalSatang: number;
  discountTotalSatang: number;
  taxTotalSatang: number;
  grandTotalSatang: number;
  notes: string | null;
  vehicle: string | null;
  lines: CustomerSaleLine[];
}

export interface CustomerInfo {
  licensePlate: string;
  plateProvince: string | null;
  customerName: string | null;
  phone: string | null;
  carModel: string | null;
  notes: string | null;
}

export interface CustomerDetail {
  customer: CustomerInfo | null;
  vehicle: string | null;
  history: CustomerSale[];
  quotations: CustomerSale[];
  legacy: CustomerLegacyEntry[];
}

export async function searchCustomers(q: string): Promise<CustomerListItem[]> {
  const res = await apiFetch(`/customers?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load customers (HTTP ${res.status})`);
  return ((await res.json()) as { customers: CustomerListItem[] }).customers;
}

export async function getCustomerDetail(plate: string): Promise<CustomerDetail> {
  const res = await apiFetch(`/customers/${encodeURIComponent(plate)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load car (HTTP ${res.status})`);
  return (await res.json()) as CustomerDetail;
}

// ── AirPlus customers (storefront accounts) ─────────────────────────────────────────────────────
// A separate business with a separate consent basis, so a separate table and separate endpoints —
// never merged with the plate-keyed directory above. See migration 0037.
export interface StorefrontCustomerListItem {
  id: string;
  /** The customer's public User ID (AP-XXXXXXXX) — the same one shown on their AirPlus account. */
  customerCode: string | null;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  createdAt: number; // when the account was created
  lastLoginAt: number | null;
  phoneVerifiedAt: number | null;
  pdpaConsentAt: number | null;
  marketingConsentAt: number | null; // null = no marketing consent on record
  anonymizedAt: number | null;
  lineLinked: number; // 1/0 — whether a LINE identity is linked (the id itself is never exposed)
  orderCount: number;
  spentSatang: number;
  lastOrderAt: number | null;
}

export interface StorefrontOrder {
  id: string;
  externalOrderId: string;
  orderStatus: string | null;
  paymentStatus: string | null;
  grandTotalSatang: number;
  orderCreatedAt: number | null;
  carrier: string | null;
  trackingNo: string | null;
}

export interface StorefrontCustomerDetail {
  customer: (StorefrontCustomerListItem & { updatedAt: number }) | null;
  orders: StorefrontOrder[];
}

export async function searchStorefrontCustomers(q: string): Promise<StorefrontCustomerListItem[]> {
  const res = await apiFetch(`/storefront-customers?q=${encodeURIComponent(q)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load AirPlus customers (HTTP ${res.status})`);
  return ((await res.json()) as { customers: StorefrontCustomerListItem[] }).customers;
}

/** Backfill: recompute every AirPlus customer's credit + tier with the current rules. */
export async function recalcAllCustomerCredit(): Promise<number> {
  const res = await apiFetch(`/storefront-customers/recalculate-credit-all`, { method: "POST" });
  if (!res.ok) throw new Error(`Recalculate failed (HTTP ${res.status})`);
  return ((await res.json()) as { recalculated: number }).recalculated;
}

export async function getStorefrontCustomerDetail(id: string): Promise<StorefrontCustomerDetail> {
  const res = await apiFetch(`/storefront-customers/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load AirPlus customer (HTTP ${res.status})`);
  return (await res.json()) as StorefrontCustomerDetail;
}

export async function setStorefrontMarketingConsent(id: string, optedIn: boolean): Promise<void> {
  const res = await apiFetch(`/storefront-customers/${encodeURIComponent(id)}/marketing`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ optedIn }),
  });
  if (!res.ok) throw new Error(`Failed to save marketing consent (HTTP ${res.status})`);
}

export async function anonymizeStorefrontCustomer(id: string): Promise<void> {
  const res = await apiFetch(`/storefront-customers/${encodeURIComponent(id)}/anonymize`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to erase customer (HTTP ${res.status})`);
}

export interface FullBillLine {
  productVariantId: string | null;
  lineType: string;
  description: string | null;
  quantity: number;
  unitPriceSatang: number;
  discountSatang: number;
  taxSatang: number;
}

/** A whole on-site sale with its lines — the full-track detail behind a history row. */
export interface FullBill {
  id: string;
  saleNumber: string | null;
  saleType: string | null;
  licensePlate: string | null;
  vehicle: string | null;
  notes: string | null;
  paymentMethod: string | null;
  stage: string;
  saleStatus: string;
  subtotalSatang: number;
  discountTotalSatang: number;
  taxTotalSatang: number;
  grandTotalSatang: number;
  createdAt: number;
  lines: FullBillLine[];
}

export async function getOnsiteSale(id: string): Promise<FullBill> {
  const res = await apiFetch(`/onsite/sales/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load bill (HTTP ${res.status})`);
  return ((await res.json()) as { sale: FullBill }).sale;
}

export async function saveCustomer(input: {
  licensePlate: string;
  customerName?: string | null;
  phone?: string | null;
  plateProvince?: string | null;
  carModel?: string | null;
  notes?: string | null;
}): Promise<void> {
  const res = await apiFetch(`/customers/by-plate`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Save customer failed (HTTP ${res.status})`);
}

export interface CustomerImportResult {
  received: number;
  created: number;
  updated: number;
  duplicates: number;
  invalid: number;
  errors: { rowIndex: number; reason: string }[];
}

/** Bulk upsert of the legacy customer Excel (already parsed to CSV in the browser). */
export async function importCustomersCsv(
  csv: string,
  mapping: Record<string, string>,
): Promise<CustomerImportResult> {
  const res = await apiFetch(`/import/customers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv, mapping }),
  });
  if (!res.ok) throw new Error(`Import failed (HTTP ${res.status})`);
  return (await res.json()) as CustomerImportResult;
}

export interface HistoryImportResult {
  received: number;
  imported: number;
  duplicates: number;
  invalid: number;
  errors: { rowIndex: number; reason: string }[];
}

/** Bulk import of transcribed legacy service history (memory, not money). */
export async function importCustomerHistoryCsv(
  csv: string,
  mapping: Record<string, string>,
): Promise<HistoryImportResult> {
  const res = await apiFetch(`/import/customer-history`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv, mapping }),
  });
  if (!res.ok) throw new Error(`Import failed (HTTP ${res.status})`);
  return (await res.json()) as HistoryImportResult;
}

export interface VisitLineInput {
  description: string;
  productRef: string | null;
}
export interface VisitInput {
  licensePlate: string;
  happenedAt: string;
  note?: string;
  lines: VisitLineInput[];
}

/** Structured bill-style legacy import (the grouped transcription form). */
export async function importCustomerVisits(visits: VisitInput[]): Promise<HistoryImportResult> {
  const res = await apiFetch(`/import/customer-history`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ visits }),
  });
  if (!res.ok) throw new Error(`Import failed (HTTP ${res.status})`);
  return (await res.json()) as HistoryImportResult;
}

/** How many o-rings of a given size a model uses (basics 3/8"/1/2"/5/8" + special sizes). */
export interface OringEntry {
  size: string;
  qty: number;
}

/** Per-model service notes — a customer-service cheat sheet for a single car model. */
export interface CarModelInfo {
  generationCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  refrigerant: string | null;
  oringUsage: OringEntry[];
  coolantLiters: string | null;
  notes: string | null;
}

export interface CarModelNode extends AttrOption, CarModelInfo {}

export interface CarBrandTree {
  id: string;
  name: string;
  /** Cover image for the storefront's car-brand tile (null → ✦ placeholder). */
  imageKey?: string | null;
  /** Thai / English display names (migration 0060). */
  nameTh?: string | null;
  nameEn?: string | null;
  models: CarModelNode[];
}

export async function fetchCarFitment(): Promise<CarBrandTree[]> {
  const res = await apiFetch(`/car-fitment`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load car fitment (HTTP ${res.status})`);
  return ((await res.json()) as { brands: CarBrandTree[] }).brands;
}

export async function addCarBrand(name: string): Promise<AttrOption> {
  const res = await apiFetch(`/car-fitment/brands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Add failed (HTTP ${res.status})`);
  }
  return (await res.json()) as AttrOption;
}

export async function addCarModel(
  brandId: string,
  name: string,
  yearFrom: number | null = null,
  yearTo: number | null = null,
): Promise<AttrOption> {
  const res = await apiFetch(`/car-fitment/brands/${brandId}/models`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, yearFrom, yearTo }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Add failed (HTTP ${res.status})`);
  }
  return (await res.json()) as AttrOption;
}

export async function deleteCarBrand(id: string): Promise<void> {
  const res = await apiFetch(`/car-fitment/brands/${id}`, { method: "DELETE" });
  // The API answers 409 while product fitments still name this brand — surface it (don't blank them).
  if (res.status === 409) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`${err.error ?? "still in use"} — remove it from those fitments first.`);
  }
  if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
}

export async function deleteCarModel(id: string): Promise<void> {
  const res = await apiFetch(`/car-fitment/models/${id}`, { method: "DELETE" });
  // The API answers 409 while product fitments still name this model — surface it (don't blank them).
  if (res.status === 409) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`${err.error ?? "still in use"} — remove it from those fitments first.`);
  }
  if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
}

export async function updateCarModel(id: string, info: CarModelInfo): Promise<void> {
  const res = await apiFetch(`/car-fitment/models/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(info),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Update failed (HTTP ${res.status})`);
  }
}

export interface ProductDetail {
  product: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    imageKey: string | null;
    shopeeListed: number;
    shopeeItemId: string | null;
    productRef: string;
    category: string | null;
    weightGrams: number;
    /** Parcel size in mm; null until measured. The form shows and takes centimetres. */
    widthMm: number | null;
    lengthMm: number | null;
    heightMm: number | null;
    brandId: string | null;
    brandName: string | null;
    typeId: string | null;
    typeName: string | null;
    usageId: string | null;
    usageName: string | null;
    updatedAt: number | null;
  };
  variantId: string | null;
  barcode: string | null;
  /** Sellable stock — held stock is already excluded. */
  onHand: number;
  /** Net quantity on hold (paused, not for sale). */
  held: number;
  fitments: Fitment[];
  pricing: {
    itemCostSatang: number;
    targetPriceSatang: number;
    onlinePriceSatang: number;
    shopeePriceSatang?: number;
    b2bPriceSatang: number;
    onlineCommissionBp: number;
    taxOnCost: number;
  } | null;
  images: ProductImage[];
}

export async function getProductDetail(id: string): Promise<ProductDetail> {
  const res = await apiFetch(`/products/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load product (HTTP ${res.status})`);
  return (await res.json()) as ProductDetail;
}

export interface FullProductInput {
  /** Set to update a specific product row (edit page; allows renaming the Product ID). Omit on the
   *  Add page, where the save create-or-recovers keyed on the Product ID. */
  id?: string;
  productRef: string;
  name: string;
  description?: string;
  status: string;
  shopeeListed?: boolean;
  shopeeItemId?: string;
  weightGrams?: number;
  widthMm?: number | null;
  lengthMm?: number | null;
  heightMm?: number | null;
  barcode?: string;
  brandName?: string;
  usageName?: string;
  typeName?: string;
  fitments?: Fitment[];
  pricing?: {
    itemCostSatang: number;
    targetPriceSatang: number;
    onlinePriceSatang: number;
    shopeePriceSatang?: number;
    b2bPriceSatang: number;
    onlineCommissionBp: number;
    taxOnCost: boolean;
  } | null;
}

/**
 * Atomic create/recover: writes the whole product (fields + pricing + fitments) in one server-side
 * transaction, so a failure can't leave a half-saved skeleton and lose the rest. Idempotent on the
 * Product ID — re-saving an existing one fills it in. Stock is applied separately (ledger DO).
 */
export async function saveFullProduct(
  input: FullProductInput,
): Promise<{ productId: string; variantId: string; created: boolean }> {
  const res = await apiFetch(`/products/full`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Save failed (HTTP ${res.status})`);
  }
  return (await res.json()) as { productId: string; variantId: string; created: boolean };
}

export async function updateProduct(
  id: string,
  fields: {
    name: string;
    description?: string;
    status: string;
    shopeeListed?: boolean;
    shopeeItemId?: string;
    productRef?: string;
    weightGrams?: number;
    widthMm?: number | null;
    lengthMm?: number | null;
    heightMm?: number | null;
    barcode?: string;
    brandName?: string;
    usageName?: string;
    typeName?: string;
    fitments?: Fitment[];
  },
): Promise<void> {
  const res = await apiFetch(`/products/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Update failed (HTTP ${res.status})`);
  }
}

export async function uploadGalleryImage(productId: string, file: File): Promise<ProductImage> {
  const res = await apiFetch(`/products/${productId}/images`, {
    method: "POST",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Upload failed (HTTP ${res.status})`);
  }
  const out = (await res.json()) as { id: string; imageKey: string; isCover: boolean };
  return { id: out.id, imageKey: out.imageKey, sortOrder: 0, isCover: out.isCover ? 1 : 0 };
}

export async function deleteGalleryImage(productId: string, imageId: string): Promise<void> {
  const res = await apiFetch(`/products/${productId}/images/${imageId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
}

export async function setProductPricing(
  id: string,
  pricing: {
    itemCostSatang: number;
    targetPriceSatang: number;
    onlinePriceSatang: number;
    shopeePriceSatang?: number;
    b2bPriceSatang: number;
    onlineCommissionBp: number;
    taxOnCost: boolean;
  },
): Promise<void> {
  const res = await apiFetch(`/products/${id}/pricing`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(pricing),
  });
  if (!res.ok) throw new Error(`Pricing update failed (HTTP ${res.status})`);
}

export interface OrderImportResult {
  received: number;
  imported: number;
  duplicates: number;
  invalid: number;
  errors: { rowIndex: number; reason: string }[];
}

export async function importShopeeOrdersCsv(
  csv: string,
  mapping: Record<string, string>,
): Promise<OrderImportResult> {
  const res = await apiFetch(`/import/shopee-orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv, mapping }),
  });
  if (!res.ok) throw new Error(`Import failed (HTTP ${res.status})`);
  return (await res.json()) as OrderImportResult;
}

export interface OrderRow {
  id: string;
  channel: string;
  externalOrderId: string;
  orderStatus: string | null;
  paymentStatus: string | null;
  grandTotalSatang: number;
  feeTotalSatang: number;
  shippingFeeSatang: number; // ค่าจัดส่ง (AirPlus; 0 for Shopee/legacy)
  orderCreatedAt: number | null;
  importedAt: number;
  buyerUsername?: string | null; // ชื่อผู้ใช้ (ผู้ซื้อ)
  salesSatang?: number | null; // ราคาสินค้าที่ชำระโดยผู้ซื้อ
  feeBp?: number | null; // ค่าธรรมเนียม (%) as basis points, 321 = 3.21%
  shipTimeMs?: number | null; // เวลาส่งสินค้า
  // Profit = Total − Kira cost of the ordered items. Null until the order's line SKUs are matched to
  // Kira products (Shopee listing SKU must be set to the Kira product code first).
  profitSatang?: number | null;
  carrier?: string | null; // shipping carrier (AirPlus)
  trackingNo?: string | null; // parcel tracking number (AirPlus)
  customerCode?: string | null; // linked storefront customer's code ("AP-…"); null when unlinked
}

export async function fetchOrders(): Promise<OrderRow[]> {
  const res = await apiFetch(`/orders`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load orders (HTTP ${res.status})`);
  return ((await res.json()) as { orders: OrderRow[] }).orders;
}

export async function fetchTermsTemplate(): Promise<string> {
  const res = await apiFetch(`/terms/template`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load template (HTTP ${res.status})`);
  return ((await res.json()) as { template: string }).template;
}

export async function saveTermsTemplate(template: string): Promise<void> {
  const res = await apiFetch(`/terms/template`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ template }),
  });
  if (!res.ok) throw new Error(`Save failed (HTTP ${res.status})`);
}

export interface ShopInfo {
  name: string; // Thai shop name (primary)
  nameEn: string;
  address: string; // Thai address (primary)
  addressEn: string;
  quoteNote: string; // quotation disclaimer
  quoteNoteEn: string;
  qrHeadline: string; // contact-QR headline
  qrHeadlineEn: string;
  qrSubtitle: string; // contact-QR subtitle
  qrSubtitleEn: string;
  paymentMethods: string; // JSON array of PromptPay methods (core parsePaymentMethods); "" = none
  /** Per-profile LINE account (was hardcoded in the storefront). */
  lineUrl: string;
  /** AirPlus: phone + postcode for the parcel sender block and the shipping-fee origin. */
  shipFromPhone: string;
  shipFromPostcode: string;
  logoKey: string | null; // R2 key, served at /img/<key>
  qrKey: string | null;
}

/** Text-only subset persisted via PUT (images are uploaded through their own endpoints). */
export type ShopInfoText = Omit<ShopInfo, "logoKey" | "qrKey">;

export const EMPTY_SHOP_INFO: ShopInfo = {
  name: "",
  nameEn: "",
  address: "",
  addressEn: "",
  quoteNote: "",
  quoteNoteEn: "",
  qrHeadline: "",
  qrHeadlineEn: "",
  qrSubtitle: "",
  qrSubtitleEn: "",
  paymentMethods: "",
  lineUrl: "",
  shipFromPhone: "",
  shipFromPostcode: "",
  logoKey: null,
  qrKey: null,
};

/** Every call is scoped to a business profile — Den Air Service and AirPlus keep separate
 *  settings (own bank account, LINE and logo), so there is no unscoped "the shop". */
export async function fetchShopInfo(profile: ShopProfile): Promise<ShopInfo> {
  const res = await apiFetch(`/shop-info/${profile}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load shop info (HTTP ${res.status})`);
  // Fill any missing keys so the UI stays robust against an API that predates a newer field.
  return { ...EMPTY_SHOP_INFO, ...((await res.json()) as Partial<ShopInfo>) };
}

export async function saveShopInfo(profile: ShopProfile, info: ShopInfoText): Promise<void> {
  const res = await apiFetch(`/shop-info/${profile}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(info),
  });
  if (!res.ok) throw new Error(`Save failed (HTTP ${res.status})`);
}

/** One recorded payment approval (Payment page). Owner reconciles these against the bank account. */
export interface PaymentRow {
  id: string;
  methodLabel: string;
  promptpayId: string;
  amountSatang: number;
  status: string;
  createdAt: number;
  approvedAt: number | null;
  slipRef: string | null;
  confirmedAt: number | null;
}

export interface PaymentsView {
  payments: PaymentRow[];
  /** True when the Worker has SlipOK credentials — enables the Verify-slip action. */
  slipVerifyEnabled: boolean;
}

export async function fetchPayments(): Promise<PaymentsView> {
  const res = await apiFetch(`/payments`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load payments (HTTP ${res.status})`);
  const body = (await res.json()) as { payments: PaymentRow[]; slipVerifyEnabled?: boolean };
  return { payments: body.payments, slipVerifyEnabled: body.slipVerifyEnabled ?? false };
}

/** Verify a scanned bank-slip QR against a payment; upgrades approved → confirmed. */
export async function verifySlipForPayment(
  paymentId: string,
  qrData: string,
): Promise<{ ok: true; ref: string }> {
  const res = await apiFetch(`/payments/${encodeURIComponent(paymentId)}/verify-slip`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ qrData }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Verify failed (HTTP ${res.status})`);
  }
  return (await res.json()) as { ok: true; ref: string };
}

export async function recordPayment(input: {
  methodLabel: string;
  promptpayId: string;
  amountSatang: number;
}): Promise<PaymentRow> {
  const res = await apiFetch(`/payments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Record payment failed (HTTP ${res.status})`);
  return ((await res.json()) as { payment: PaymentRow }).payment;
}

/** Owner reconciliation — mark all listed (uncleared) payments cleared. Records are kept, not deleted. */
export async function clearPayments(): Promise<{ cleared: number }> {
  const res = await apiFetch(`/payments/clear`, { method: "POST" });
  if (!res.ok) throw new Error(`Clear failed (HTTP ${res.status})`);
  return (await res.json()) as { cleared: number };
}

/** Upload the shop logo or contact-QR image (jpeg/png/webp, ≤5MB). Returns the stored R2 key. */
/** Upload a cover image for a product category / car brand (storefront tiles). Replaces any existing
 *  cover. Kinds match the api's /taxonomy-images/:kind/:id route. */
export async function uploadTaxonomyImage(
  kind: "type" | "car-brand",
  id: string,
  file: File,
): Promise<{ key: string; url: string }> {
  const res = await apiFetch(`/taxonomy-images/${kind}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(
      (msg as { error?: string } | null)?.error ?? `Upload failed (HTTP ${res.status})`,
    );
  }
  return (await res.json()) as { key: string; url: string };
}

/** Remove a category / car-brand cover image (the storefront falls back to its ✦ placeholder). */
export async function clearTaxonomyImage(kind: "type" | "car-brand", id: string): Promise<void> {
  const res = await apiFetch(`/taxonomy-images/${kind}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Remove failed (HTTP ${res.status})`);
}

export async function uploadShopImage(
  profile: ShopProfile,
  slot: "logo" | "qr",
  file: File,
): Promise<{ key: string; url: string }> {
  const res = await apiFetch(`/shop-info/${profile}/${slot}`, {
    method: "POST",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);
  return (await res.json()) as { key: string; url: string };
}

/** Absolute URL for an R2 image key, served by the API at /img/:key. */
export function imageUrl(key: string): string {
  return `${apiBase}/img/${key}`;
}

/**
 * URL for a PRIVATE order file (claim photo, payment slip). Unlike {@link imageUrl}, this goes
 * through the same-origin /api/worker proxy so the browser sends the Cloudflare Access session and
 * the API's requireAccess (and super-admin gate for slips) can authorise it. The public /img route
 * would bypass auth entirely, which must never happen for bank slips.
 */
export function privateFileUrl(key: string): string {
  return `/api/worker/file/${key}`;
}

export interface StockRow {
  variantId: string;
  sku: string | null;
  productName: string;
  productRef: string | null;
  onHand: number;
}

export async function fetchStock(): Promise<StockRow[]> {
  const res = await apiFetch(`/stock`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load stock (HTTP ${res.status})`);
  const data = (await res.json()) as { stock: StockRow[] };
  return data.stock;
}

export interface StockMovementRow {
  id: string;
  variantId: string;
  sku: string | null;
  productName: string;
  movementType: string;
  quantityDelta: number;
  quantityAfter: number;
  createdAt: number;
}

export async function fetchStockMovements(): Promise<StockMovementRow[]> {
  const res = await apiFetch(`/stock/movements`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load movements (HTTP ${res.status})`);
  const data = (await res.json()) as { movements: StockMovementRow[] };
  return data.movements;
}

/** One product the owner still owes Shopee a stock update for — the dashboard "Update on Shopee" list. */
export interface ShopeeWorklistItem {
  productId: string;
  productRef: string; // Product ID = SKU (the copy value)
  name: string;
  onHand: number;
  deltaSinceSync: number; // net change since last reconciled — negative = reduced
  lastChangedAt: number;
}

export async function fetchShopeeWorklist(): Promise<ShopeeWorklistItem[]> {
  const res = await apiFetch(`/stock/shopee-worklist`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load Shopee worklist (HTTP ${res.status})`);
  return ((await res.json()) as { items: ShopeeWorklistItem[] }).items;
}

/** Clear done: mark these products reconciled on Shopee, so they leave the worklist until they move again. */
export async function markShopeeSynced(productIds: string[]): Promise<void> {
  const res = await apiFetch(`/stock/shopee-synced`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productIds }),
  });
  if (!res.ok) throw new Error(`Failed to update Shopee sync (HTTP ${res.status})`);
}

/**
 * Send exactly one of `quantityDelta` (a relative receive/write-off) or `countedOnHand` (a
 * stocktake, whose delta the server derives from its own read of the ledger).
 */
export async function adjustStock(
  input: {
    productVariantId: string;
    movementType: string;
    reason?: string;
  } & ({ quantityDelta: number } | { countedOnHand: number }),
): Promise<{ applied: boolean; quantityAfter: number; reason?: string }> {
  const res = await apiFetch(`/stock/adjust`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Adjust failed (HTTP ${res.status})`);
  return (await res.json()) as { applied: boolean; quantityAfter: number; reason?: string };
}

export interface HoldLineInput {
  productVariantId: string;
  /** Box 1 — move this many from sellable into the hold. */
  takeAway: number;
  /** Box 2 — move this many from the hold back into sellable. */
  bringBack: number;
}

export interface HoldLineResult {
  variantId: string;
  applied: boolean;
  reason?: string;
  sellableAfter: number;
  heldAfter: number;
}

/**
 * Move stock between sellable and the hold bucket (Scan here › On hold). Lines are independent:
 * one bad quantity doesn't discard the rest of a scanned batch, so the result is per line.
 */
export async function holdStock(lines: HoldLineInput[]): Promise<HoldLineResult[]> {
  const res = await apiFetch(`/stock/hold`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lines }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Hold failed (HTTP ${res.status})`);
  }
  return ((await res.json()) as { results: HoldLineResult[] }).results;
}

export async function archiveProduct(id: string): Promise<void> {
  const res = await apiFetch(`/products/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Archive failed (HTTP ${res.status})`);
}

export interface BarcodeRow {
  variantId: string;
  productId: string;
  productRef: string;
  productName: string;
  barcode: string | null;
}

export async function fetchBarcodes(): Promise<BarcodeRow[]> {
  const res = await apiFetch(`/barcodes`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load barcodes (HTTP ${res.status})`);
  return ((await res.json()) as { barcodes: BarcodeRow[] }).barcodes;
}

export async function addBarcode(
  productId: string,
  barcodeValue?: string,
): Promise<{ barcodeValue: string; generated: boolean }> {
  const res = await apiFetch(`/products/${productId}/barcode`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ barcodeValue }),
  });
  if (!res.ok) throw new Error(`Add barcode failed (HTTP ${res.status})`);
  return (await res.json()) as { barcodeValue: string; generated: boolean };
}

export interface SaleRow {
  id: string;
  saleNumber: string | null;
  paymentMethod: string | null;
  grandTotalSatang: number;
  taxTotalSatang: number;
  saleStatus: string;
  createdAt: number;
  grossProfitSatang: number;
  saleType: string | null;
  licensePlate: string | null;
  vehicle: string | null;
  channel?: string | null; // "online" | "onsite" — for the Parts subtitle (design exploration)
}

export async function refundSale(
  saleId: string,
): Promise<{ applied: boolean; reason?: string; restockedLines: number }> {
  const res = await apiFetch(`/sales/${saleId}/refund`, { method: "POST" });
  if (!res.ok) throw new Error(`Refund failed (HTTP ${res.status})`);
  return (await res.json()) as { applied: boolean; reason?: string; restockedLines: number };
}

export async function fetchSales(): Promise<SaleRow[]> {
  const res = await apiFetch(`/sales`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load sales (HTTP ${res.status})`);
  const data = (await res.json()) as { sales: SaleRow[] };
  return data.sales;
}

/** A Finance expense — money out tagged to a channel ("onsite" | "airplus"). See migration 0081. */
export interface ExpenseRow {
  id: string;
  channel: string;
  conversion: string;
  amountSatang: number;
  note: string | null;
  occurredAt: number;
  createdAt: number;
}

export async function fetchExpenses(): Promise<ExpenseRow[]> {
  const res = await apiFetch(`/finance/expenses`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load expenses (HTTP ${res.status})`);
  const data = (await res.json()) as { expenses: ExpenseRow[] };
  return data.expenses;
}

export interface CreateExpenseInput {
  channel: string;
  conversion: string;
  amountSatang: number;
  note?: string | null;
  occurredAt: number;
}

export async function createExpense(input: CreateExpenseInput): Promise<ExpenseRow> {
  const res = await apiFetch(`/finance/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as { expense?: ExpenseRow; error?: string };
  if (!res.ok || !data.expense)
    throw new Error(data.error ?? `Failed to save expense (HTTP ${res.status})`);
  return data.expense;
}

export async function updateExpense(id: string, input: CreateExpenseInput): Promise<ExpenseRow> {
  const res = await apiFetch(`/finance/expenses/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as { expense?: ExpenseRow; error?: string };
  if (!res.ok || !data.expense)
    throw new Error(data.error ?? `Failed to update expense (HTTP ${res.status})`);
  return data.expense;
}

export async function deleteExpense(id: string): Promise<void> {
  const res = await apiFetch(`/finance/expenses/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete expense (HTTP ${res.status})`);
}

export interface ImportResult {
  received: number;
  valid: number;
  invalid: number;
  errors: { rowIndex: number; reason: string }[];
}

export async function importProductsCsv(
  csv: string,
  mapping: Record<string, string>,
): Promise<ImportResult> {
  const res = await apiFetch(`/import/products`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv, mapping }),
  });
  if (!res.ok) throw new Error(`Import failed (HTTP ${res.status})`);
  return (await res.json()) as ImportResult;
}

// ── Storefront banners (hero carousel + promo strip) ─────────────────────────────────────────────

export interface BannerRow {
  id: string;
  slot: "hero" | "promo";
  imageKey: string | null;
  linkUrl: string | null;
  sortOrder: number;
  startsAt: number | null; // epoch ms; null = always
  endsAt: number | null;
  status: "active" | "disabled";
  createdAt: number;
}

export async function fetchBanners(): Promise<BannerRow[]> {
  const res = await apiFetch(`/banners`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load banners (HTTP ${res.status})`);
  return ((await res.json()) as { banners: BannerRow[] }).banners;
}

export async function addBanner(input: {
  slot: "hero" | "promo";
  linkUrl?: string;
  sortOrder?: number;
  startsAt?: number | null;
  endsAt?: number | null;
}): Promise<{ id: string }> {
  const res = await apiFetch(`/banners`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Add banner failed (HTTP ${res.status})`);
  }
  return (await res.json()) as { id: string };
}

export async function updateBanner(
  id: string,
  fields: Partial<{
    slot: "hero" | "promo";
    linkUrl: string | null;
    sortOrder: number;
    startsAt: number | null;
    endsAt: number | null;
    status: "active" | "disabled";
  }>,
): Promise<void> {
  const res = await apiFetch(`/banners/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Update banner failed (HTTP ${res.status})`);
  }
}

/** Upload a banner image (raw file body, like uploadShopImage). Returns the stored R2 key. */
export async function uploadBannerImage(
  id: string,
  file: File,
): Promise<{ key: string; url: string }> {
  const res = await apiFetch(`/banners/${encodeURIComponent(id)}/image`, {
    method: "POST",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Upload failed (HTTP ${res.status})`);
  }
  return (await res.json()) as { key: string; url: string };
}

export async function deleteBanner(id: string): Promise<void> {
  const res = await apiFetch(`/banners/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete banner failed (HTTP ${res.status})`);
}

// ── Coupons ──────────────────────────────────────────────────────────────────────────────────────

export interface CouponRow {
  id: string;
  code: string;
  /** Admin-only label (migration 0065); never shown to customers. */
  name: string | null;
  type: "fixed" | "percent";
  value: number; // fixed → satang off; percent → basis points (1000 = 10%)
  minSubtotalSatang: number;
  startsAt: number | null;
  endsAt: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number;
  maxDiscountSatang: number | null;
  status: "active" | "disabled";
  createdAt: number;
}

export type CouponWithUsage = CouponRow & { redemptions: number };

export async function fetchCoupons(): Promise<CouponWithUsage[]> {
  const res = await apiFetch(`/coupons`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load coupons (HTTP ${res.status})`);
  return ((await res.json()) as { coupons: CouponWithUsage[] }).coupons;
}

export async function addCoupon(input: {
  code: string;
  name: string;
  type: "fixed" | "percent";
  value: number;
  minSubtotalSatang?: number;
  startsAt?: number | null;
  endsAt?: number | null;
  maxUses?: number | null;
  maxUsesPerCustomer?: number;
  maxDiscountSatang?: number | null;
}): Promise<{ id: string }> {
  const res = await apiFetch(`/coupons`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Add coupon failed (HTTP ${res.status})`);
  }
  return (await res.json()) as { id: string };
}

export async function updateCoupon(
  id: string,
  fields: Partial<{
    code: string;
    name: string;
    type: "fixed" | "percent";
    value: number;
    minSubtotalSatang: number;
    startsAt: number | null;
    endsAt: number | null;
    maxUses: number | null;
    maxUsesPerCustomer: number;
    maxDiscountSatang: number | null;
    status: "active" | "disabled";
  }>,
): Promise<void> {
  const res = await apiFetch(`/coupons/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Update coupon failed (HTTP ${res.status})`);
  }
}

/** Delete a coupon. The API answers 409 once a coupon has redemptions — disable instead. */
export async function deleteCoupon(id: string): Promise<void> {
  const res = await apiFetch(`/coupons/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.status === 409) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`${err.error ?? "Coupon has been redeemed"} — disable it instead of deleting.`);
  }
  if (!res.ok) throw new Error(`Delete coupon failed (HTTP ${res.status})`);
}

// ── Flash-sale campaigns ─────────────────────────────────────────────────────────────────────────

export interface CampaignPriceRow {
  id: string;
  productVariantId: string;
  productName: string;
  productRef: string;
  basePriceSatang: number;
  campaignPriceSatang: number;
  stockCap: number | null;
  soldCount: number;
}

export interface CampaignRow {
  id: string;
  name: string;
  startsAt: number;
  endsAt: number;
  status: "active" | "disabled";
  createdAt: number;
  prices: CampaignPriceRow[];
}

export async function fetchCampaigns(): Promise<CampaignRow[]> {
  const res = await apiFetch(`/campaigns`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load campaigns (HTTP ${res.status})`);
  return ((await res.json()) as { campaigns: CampaignRow[] }).campaigns;
}

export async function addCampaign(input: {
  name: string;
  startsAt: number;
  endsAt: number;
}): Promise<{ id: string }> {
  const res = await apiFetch(`/campaigns`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Add campaign failed (HTTP ${res.status})`);
  }
  return (await res.json()) as { id: string };
}

export async function updateCampaign(
  id: string,
  fields: Partial<{
    name: string;
    startsAt: number;
    endsAt: number;
    status: "active" | "disabled";
  }>,
): Promise<void> {
  const res = await apiFetch(`/campaigns/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Update campaign failed (HTTP ${res.status})`);
  }
}

export async function deleteCampaign(id: string): Promise<void> {
  const res = await apiFetch(`/campaigns/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete campaign failed (HTTP ${res.status})`);
}

export async function addCampaignPrice(
  campaignId: string,
  input: { productVariantId: string; campaignPriceSatang: number; stockCap?: number },
): Promise<{ id: string }> {
  const res = await apiFetch(`/campaigns/${encodeURIComponent(campaignId)}/prices`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Add campaign price failed (HTTP ${res.status})`);
  }
  return (await res.json()) as { id: string };
}

export async function deleteCampaignPrice(campaignId: string, priceId: string): Promise<void> {
  const res = await apiFetch(
    `/campaigns/${encodeURIComponent(campaignId)}/prices/${encodeURIComponent(priceId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(`Remove campaign price failed (HTTP ${res.status})`);
}

export interface VariantSearchResult {
  variantId: string;
  productId: string;
  name: string;
  productRef: string;
  onlinePriceSatang: number;
}

/** Search sellable variants by name/ref — feeds the campaign "Add product" picker. */
export async function searchVariants(q: string): Promise<VariantSearchResult[]> {
  const res = await apiFetch(`/variant-search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`);
  return ((await res.json()) as { variants: VariantSearchResult[] }).variants;
}

// ── Affiliate tool cards ─────────────────────────────────────────────────────────────────────────

export interface AffiliateItemRow {
  id: string;
  title: string;
  imageKey: string | null;
  priceText: string | null; // display-only, never math
  source: "shopee" | "lazada" | "other";
  targetUrl: string;
  sortOrder: number;
  status: "active" | "disabled";
  createdAt: number;
  categoryId: string | null;
  categoryName: string | null;
  /** 1 = shown on the AirPlus homepage shelf (pinned cards lead it, six at most). */
  pinned: number;
}

export type AffiliateItemWithStats = AffiliateItemRow & { clicks: number };

export interface AffiliateCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export async function fetchAffiliateCategories(): Promise<AffiliateCategory[]> {
  const res = await apiFetch(`/affiliate-categories`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load categories (HTTP ${res.status})`);
  return ((await res.json()) as { categories: AffiliateCategory[] }).categories;
}

/** Create a category (or return the existing one with that name — never a duplicate group). */
export async function addAffiliateCategory(name: string): Promise<{ id: string; name: string }> {
  const res = await apiFetch(`/affiliate-categories`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Create category failed (HTTP ${res.status})`);
  }
  return (await res.json()) as { id: string; name: string };
}

export async function fetchAffiliateItems(): Promise<AffiliateItemWithStats[]> {
  const res = await apiFetch(`/affiliate-items`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load affiliate items (HTTP ${res.status})`);
  return ((await res.json()) as { items: AffiliateItemWithStats[] }).items;
}

export async function addAffiliateItem(input: {
  title: string;
  targetUrl: string;
  priceText?: string;
  source?: "shopee" | "lazada" | "other";
  sortOrder?: number;
  categoryId?: string | null;
  pinned?: boolean;
}): Promise<{ id: string }> {
  const res = await apiFetch(`/affiliate-items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Add item failed (HTTP ${res.status})`);
  }
  return (await res.json()) as { id: string };
}

export async function updateAffiliateItem(
  id: string,
  fields: Partial<{
    title: string;
    targetUrl: string;
    priceText: string | null;
    source: "shopee" | "lazada" | "other";
    sortOrder: number;
    status: "active" | "disabled";
    categoryId: string | null;
    pinned: boolean;
  }>,
): Promise<void> {
  const res = await apiFetch(`/affiliate-items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Update item failed (HTTP ${res.status})`);
  }
}

export async function uploadAffiliateItemImage(
  id: string,
  file: File,
): Promise<{ key: string; url: string }> {
  const res = await apiFetch(`/affiliate-items/${encodeURIComponent(id)}/image`, {
    method: "POST",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Upload failed (HTTP ${res.status})`);
  }
  return (await res.json()) as { key: string; url: string };
}

export async function deleteAffiliateItem(id: string): Promise<void> {
  const res = await apiFetch(`/affiliate-items/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete item failed (HTTP ${res.status})`);
}

/** One order's full detail — the payload behind /orders/:id. Mirrors OrderDetail in apps/api. */
export interface OrderDetail {
  order: {
    id: string;
    channel: string;
    externalOrderId: string;
    orderStatus: string | null;
    paymentStatus: string | null;
    subtotalSatang: number;
    discountTotalSatang: number;
    /** What we billed the customer for delivery. */
    shippingFeeSatang: number;
    /** What our Flash calculator quoted at checkout. */
    shippingAutoSatang: number;
    /** What we offered on a shared-fee order; null means a normal order. */
    shippingOfferSatang: number | null;
    /** What the carrier actually charged. Null until a drop-off is recorded. */
    shippingRealSatang: number | null;
    grandTotalSatang: number;
    /** The stale checkout snapshot. Render `money.profitSatang` instead. */
    profitSatang: number | null;
    orderCreatedAt: number | null;
    importedAt: number;
    buyerUsername: string | null;
    carrier: string | null;
    trackingNo: string | null;
    shipTimeMs: number | null;
    staffNote: string | null;
    /** R2 key of the customer's uploaded bank slip, served super-admin-only via the private route. */
    slipImageKey: string | null;
    /** Customer payout account for a failed-delivery refund. Bank no + name are super-admin-only (null
     *  for other admins); null until the customer submits them on the storefront. */
    refundBankName: string | null;
    refundAccountNo: string | null;
    refundAccountName: string | null;
    /** Full refund amount (= grand total) + when/who, once we have paid the customer back. */
    refundSatang: number | null;
    refundedAt: number | null;
    refundActorEmail: string | null;
    /** R2 key of OUR outgoing transfer slip, served via the private /file route. */
    refundSlipImageKey: string | null;
  };
  /**
   * The two books, derived by the API. Never recomputed here — one of these numbers being different
   * on the list page and the detail page is exactly the bug that deriving centrally prevents.
   */
  money: {
    customerPaidSatang: number;
    goodsAfterDiscountSatang: number;
    itemCostSatang: number;
    shippingShortfallSatang: number | null;
    profitSatang: number | null;
  };
  /** Whether this bounced order needs a refund action now, is already refunded, or is out of scope. */
  refundAction: "needs_refund" | "refunded" | "none";
  customer: {
    id: string;
    customerCode: string | null;
    name: string | null;
    phone: string | null;
    tier: string | null;
    creditScore: number | null;
    orderCount: number;
    /** Completed (delivered) vs incomplete (expired / cancelled-unpaid) order counts. */
    completeCount: number;
    incompleteCount: number;
  } | null;
  address: {
    recipientName: string | null;
    phone: string | null;
    addressLine1: string | null;
    subdistrict: string | null;
    district: string | null;
    province: string | null;
    postalCode: string | null;
  } | null;
  lines: {
    id: string;
    variantId: string;
    name: string | null;
    /** Part brand (DENSO, Valeo…). Null when the product has none set. */
    brand: string | null;
    sku: string | null;
    imageKey: string | null;
    quantity: number;
    unitPriceSatang: number;
    unitCostSatang: number;
    lineTotalSatang: number;
  }[];
  timeline: {
    id: string;
    orderStatus: string | null;
    paymentStatus: string | null;
    event: string;
    actorEmail: string | null;
    note: string | null;
    createdAt: number;
  }[];
  claims: {
    id: string;
    kind: string;
    state: string;
    reasonNote: string | null;
    resolution: string | null;
    refundSatang: number | null;
    mechanicName: string | null;
    mechanicDecidedAt: number | null;
    adminEmail: string | null;
    adminDecidedAt: number | null;
    /** The rejecting reviewer's reason, shown to the customer on a rejected claim. */
    adminNote: string | null;
    /** Who is in charge of this claim, picked from the mechanic list. */
    assigneeName: string | null;
    carrier: string | null;
    trackingNo: string | null;
    /** What we paid the carrier to ship the replacement/return (exchange or rejection). */
    shippingFeeSatang: number | null;
    createdAt: number;
    /** R2 keys of the claim's evidence photos, served via the private /file route. */
    photoKeys: string[];
    lines: { salesOrderLineId: string; quantity: number }[];
    /**
     * Where a replacement ships when the customer chose a DIFFERENT address than the order's own.
     * Null means "same as the order" — the UI falls back to `address`.
     */
    replacementAddress: {
      recipientName: string | null;
      phone: string | null;
      addressLine1: string | null;
      subdistrict: string | null;
      district: string | null;
      province: string | null;
      postalCode: string | null;
    } | null;
  }[];
  /** Whether THIS admin may see slip images (super-admin). Gates the slip preview + Documents actions. */
  viewerIsSuperAdmin: boolean;
  /** This viewer's role — gates the Zone-A actions (claim = super+mechanic; payment/COD = super+admin). */
  viewerRole: "super_admin" | "mechanic" | "admin";
  /** The mechanic list (emails), for the claim assignee dropdown. */
  mechanics: string[];
}

export async function fetchOrderDetail(id: string): Promise<OrderDetail | null> {
  const res = await apiFetch(`/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load order (HTTP ${res.status})`);
  return (await res.json()) as OrderDetail;
}

export async function saveOrderStaffNote(id: string, staffNote: string): Promise<void> {
  const res = await apiFetch(`/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ staffNote }),
  });
  if (!res.ok) throw new Error(`Failed to save note (HTTP ${res.status})`);
}

/**
 * Record a drop-off: carrier, tracking number and what Flash actually charged, in one PATCH.
 *
 * `orderStatus: "shipped"` is not optional garnish. "To ship" is DERIVED from the payment axis, so a
 * write that saves only the three fields leaves the order reading To ship forever and the form never
 * goes away. This is the write that moves it to In transit and puts one entry on the timeline.
 */
export async function saveOrderDropOff(
  id: string,
  input: { carrier: string; trackingNo: string; shippingRealSatang: number },
): Promise<void> {
  const res = await apiFetch(`/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...input, orderStatus: "shipped" }),
  });
  if (!res.ok) {
    // 409 carries the real reason (the order has not been paid for) — surface it verbatim.
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Failed to record drop-off (HTTP ${res.status})`);
  }
}

/**
 * Confirm or reject a bank-transfer slip awaiting review. Confirm settles the order (→ To ship);
 * reject sends it back to pending with a fresh 48h window and requires a reason. Any admin may call
 * this — seeing the slip image is gated separately (super-admin).
 */
export async function reviewOrderPayment(
  id: string,
  decision: "confirm" | "reject",
  reason?: string,
): Promise<void> {
  const res = await apiFetch(`/orders/${encodeURIComponent(id)}/review-payment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision, reason }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Payment review failed (HTTP ${res.status})`);
  }
}

/**
 * Staff decision on a COD order awaiting approval (watch-tier — best/good auto-approve at checkout).
 * Approve settles it as cod_confirmed (→ To ship); deny marks it cod_denied (→ the customer changes
 * payment or cancels). Reuses PATCH /orders/:id, which writes the cod_approved / cod_denied timeline
 * entry.
 */
export async function decideCod(id: string, decision: "approve" | "deny"): Promise<void> {
  const paymentStatus = decision === "approve" ? "cod_confirmed" : "cod_denied";
  const res = await apiFetch(`/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ paymentStatus }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `COD decision failed (HTTP ${res.status})`);
  }
}

/**
 * Record a full refund of a bounced (delivery_failed) order: uploads OUR outgoing transfer slip as
 * the request body and marks the order refunded (restock + timeline handled server-side). Super-admin
 * only — the API enforces it and returns 403 otherwise.
 */
export async function recordRefund(id: string, slip: File): Promise<void> {
  const res = await apiFetch(`/orders/${encodeURIComponent(id)}/refund`, {
    method: "POST",
    headers: { "content-type": slip.type || "image/jpeg" },
    body: slip,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Refund failed (HTTP ${res.status})`);
  }
}

/** Set the shipping fee we offered on a shared-fee order. Null clears it back to a normal order. */
export async function saveOrderShippingOffer(
  id: string,
  shippingOfferSatang: number | null,
): Promise<void> {
  const res = await apiFetch(`/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ shippingOfferSatang }),
  });
  if (!res.ok) throw new Error(`Failed to save offered fee (HTTP ${res.status})`);
}

export async function createOrderClaim(
  orderId: string,
  input: {
    kind: "wrong_item" | "defect";
    reasonNote: string | null;
    lines: { salesOrderLineId: string; quantity: number }[];
  },
): Promise<string> {
  const res = await apiFetch(`/orders/${encodeURIComponent(orderId)}/claims`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json()) as { claimId?: string; error?: string };
  // 422 carries the real reason (a line from another order, too many units) — surface it verbatim
  // rather than a generic failure, because the operator can act on it.
  if (!res.ok) throw new Error(body.error ?? `Failed to raise claim (HTTP ${res.status})`);
  return body.claimId!;
}

export async function transitionOrderClaim(
  claimId: string,
  state: string,
  opts: {
    reason?: string;
    assignee?: string;
    carrier?: string;
    trackingNo?: string;
    shippingFeeSatang?: number;
  } = {},
): Promise<void> {
  const res = await apiFetch(`/claims/${encodeURIComponent(claimId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state, ...opts }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to update claim (HTTP ${res.status})`);
  }
}

/**
 * Record a claim resolved with a refund — the customer chose money back. Uploads OUR outgoing transfer
 * slip (super-admin only, server-enforced) and closes the claim. Mirrors recordRefund's raw-body POST.
 */
export async function recordClaimRefund(claimId: string, slip: File): Promise<void> {
  const res = await apiFetch(`/claims/${encodeURIComponent(claimId)}/refund`, {
    method: "POST",
    headers: { "content-type": slip.type || "image/jpeg" },
    body: slip,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Claim refund failed (HTTP ${res.status})`);
  }
}

/**
 * Ship a REJECTED claim's product back to the customer (out of T&C / misuse → no refund/replacement).
 * Same drop-off shape as the replacement — carrier + tracking + what the carrier charged us.
 */
export async function recordClaimReturnShipment(
  claimId: string,
  input: { carrier: string; trackingNo: string; shippingFeeSatang: number },
): Promise<void> {
  const res = await apiFetch(`/claims/${encodeURIComponent(claimId)}/return-shipment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Return shipment failed (HTTP ${res.status})`);
  }
}

/* ---- AirPlus Insight ---- */

/** The nine raw counts every tile on the Insight page is derived from. */
export interface InsightTotalsRow {
  salesSatang: number;
  profitSatang: number;
  orders: number;
  buyers: number;
  units: number;
  visitors: number;
  productViews: number;
  clicks: number;
  addToCartVisitors: number;
  newAccounts: number;
  failedOrders: number;
  placedOrders: number;
}

export interface InsightSourceRow {
  source: string;
  visitors: number;
  productViews: number;
  clicks: number;
}

export interface InsightProductRow {
  productId: string;
  productRef: string | null;
  name: string;
  imageKey: string | null;
  salesSatang: number;
  profitSatang: number;
  units: number;
  views: number;
  clicks: number;
}

export interface InsightsPayload {
  period: string;
  window: { start: number; end: number };
  comparison: { start: number; end: number };
  totals: InsightTotalsRow;
  previous: InsightTotalsRow;
  series: { buckets: number[]; totals: InsightTotalsRow[] };
  sources: InsightSourceRow[];
  products: InsightProductRow[];
  /** Orders whose cost snapshot is missing, so their profit is excluded from the total. */
  unknownCostOrders: number;
}

export async function fetchInsights(period: string): Promise<InsightsPayload> {
  const res = await apiFetch(`/insights?period=${encodeURIComponent(period)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load insights (HTTP ${res.status})`);
  return (await res.json()) as InsightsPayload;
}
