/** Typed client for the kiraoffice API Worker. */
import { apiFetch, apiBase } from "./apiFetch";
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
  onHand: number;
}

export async function fetchProducts(): Promise<ProductRow[]> {
  const res = await apiFetch(`/products`, { cache: "no-store" });
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

export async function addAttribute(kind: AttrKind, name: string): Promise<AttrOption> {
  const res = await apiFetch(`/attributes/${kind}`, {
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

export async function deleteAttribute(kind: AttrKind, id: string): Promise<void> {
  const res = await apiFetch(`/attributes/${kind}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
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
  if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
}

export async function deleteCarModel(id: string): Promise<void> {
  const res = await apiFetch(`/car-fitment/models/${id}`, { method: "DELETE" });
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
  onHand: number;
  fitments: Fitment[];
  pricing: {
    itemCostSatang: number;
    targetPriceSatang: number;
    onlinePriceSatang: number;
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
  logoKey: null,
  qrKey: null,
};

export async function fetchShopInfo(): Promise<ShopInfo> {
  const res = await apiFetch(`/shop-info`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load shop info (HTTP ${res.status})`);
  // Fill any missing keys so the UI stays robust against an older API (name/address only).
  return { ...EMPTY_SHOP_INFO, ...((await res.json()) as Partial<ShopInfo>) };
}

export async function saveShopInfo(info: ShopInfoText): Promise<void> {
  const res = await apiFetch(`/shop-info`, {
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
export async function uploadShopImage(
  slot: "logo" | "qr",
  file: File,
): Promise<{ key: string; url: string }> {
  const res = await apiFetch(`/shop-info/${slot}`, {
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

// ── AirPlus order fulfillment ────────────────────────────────────────────────────────────────────

/** Patch an AirPlus order's fulfillment fields; returns the updated row. */
export async function updateAirPlusOrder(
  id: string,
  fields: {
    orderStatus?: string;
    paymentStatus?: string;
    carrier?: string;
    trackingNo?: string;
  },
): Promise<OrderRow> {
  const res = await apiFetch(`/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Update order failed (HTTP ${res.status})`);
  }
  return ((await res.json()) as { order: OrderRow }).order;
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
  type: "fixed" | "percent";
  value: number; // fixed → satang off; percent → basis points (1000 = 10%)
  minSubtotalSatang: number;
  startsAt: number | null;
  endsAt: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number;
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
  type: "fixed" | "percent";
  value: number;
  minSubtotalSatang?: number;
  startsAt?: number | null;
  endsAt?: number | null;
  maxUses?: number | null;
  maxUsesPerCustomer?: number;
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
    type: "fixed" | "percent";
    value: number;
    minSubtotalSatang: number;
    startsAt: number | null;
    endsAt: number | null;
    maxUses: number | null;
    maxUsesPerCustomer: number;
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
}

export type AffiliateItemWithStats = AffiliateItemRow & { clicks: number };

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
