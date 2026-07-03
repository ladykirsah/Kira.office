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
  lastVisitAt: number;
}

export interface CustomerSaleLine {
  onsiteSaleId?: string;
  description: string | null;
  lineType: string;
  quantity: number;
  unitPriceSatang: number;
}

export interface CustomerSale {
  id: string;
  saleNumber: string | null;
  stage: string;
  createdAt: number;
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

export async function adjustStock(input: {
  productVariantId: string;
  quantityDelta: number;
  movementType: string;
  reason?: string;
}): Promise<{ applied: boolean; quantityAfter: number; reason?: string }> {
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
