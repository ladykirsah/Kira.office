/** Typed client for the kiraoffice API Worker. */
export const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "https://api.homeseeker.me";

export interface ProductRow {
  id: string;
  productCode: string;
  name: string;
  status: string;
  imageKey: string | null;
  shopeeListed: number;
  offlinePriceSatang: number;
  onlinePriceSatang: number;
  onHand: number;
}

export async function uploadProductImage(
  productId: string,
  file: File,
): Promise<{ key: string; url: string }> {
  const res = await fetch(`${apiBase}/products/${productId}/image`, {
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

export async function fetchProducts(): Promise<ProductRow[]> {
  const res = await fetch(`${apiBase}/products`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load products (HTTP ${res.status})`);
  const data = (await res.json()) as { products: ProductRow[] };
  return data.products;
}

export interface CreateProductInput {
  productCode: string;
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
  const res = await fetch(`${apiBase}/products`, {
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
  productCode: string;
  name: string;
}

export async function lookupBarcode(code: string): Promise<BarcodeLookup | null> {
  const res = await fetch(`${apiBase}/products/by-barcode/${encodeURIComponent(code)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lookup failed (HTTP ${res.status})`);
  return (await res.json()) as BarcodeLookup;
}

export interface ProductDetail {
  product: {
    id: string;
    productCode: string;
    name: string;
    description: string | null;
    status: string;
    imageKey: string | null;
    shopeeListed: number;
  };
  variantId: string | null;
  pricing: {
    itemCostSatang: number;
    targetPriceSatang: number;
    onlinePriceSatang: number;
  } | null;
}

export async function getProductDetail(id: string): Promise<ProductDetail> {
  const res = await fetch(`${apiBase}/products/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load product (HTTP ${res.status})`);
  return (await res.json()) as ProductDetail;
}

export async function updateProduct(
  id: string,
  fields: { name: string; description?: string; status: string; shopeeListed?: boolean },
): Promise<void> {
  const res = await fetch(`${apiBase}/products/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Update failed (HTTP ${res.status})`);
  }
}

export async function setProductPricing(
  id: string,
  pricing: { itemCostSatang: number; targetPriceSatang: number; onlinePriceSatang: number },
): Promise<void> {
  const res = await fetch(`${apiBase}/products/${id}/pricing`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(pricing),
  });
  if (!res.ok) throw new Error(`Pricing update failed (HTTP ${res.status})`);
}

export interface BarcodeRow {
  variantId: string;
  productId: string;
  productCode: string;
  productName: string;
  barcode: string | null;
}

export async function fetchBarcodes(): Promise<BarcodeRow[]> {
  const res = await fetch(`${apiBase}/barcodes`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load barcodes (HTTP ${res.status})`);
  return ((await res.json()) as { barcodes: BarcodeRow[] }).barcodes;
}

export async function addBarcode(
  productId: string,
  barcodeValue?: string,
): Promise<{ barcodeValue: string; generated: boolean }> {
  const res = await fetch(`${apiBase}/products/${productId}/barcode`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ barcodeValue }),
  });
  if (!res.ok) throw new Error(`Add barcode failed (HTTP ${res.status})`);
  return (await res.json()) as { barcodeValue: string; generated: boolean };
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
  const res = await fetch(`${apiBase}/import/shopee-orders`, {
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
  importedAt: number;
}

export async function fetchOrders(): Promise<OrderRow[]> {
  const res = await fetch(`${apiBase}/orders`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load orders (HTTP ${res.status})`);
  return ((await res.json()) as { orders: OrderRow[] }).orders;
}

export async function fetchTermsTemplate(): Promise<string> {
  const res = await fetch(`${apiBase}/terms/template`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load template (HTTP ${res.status})`);
  return ((await res.json()) as { template: string }).template;
}

export async function saveTermsTemplate(template: string): Promise<void> {
  const res = await fetch(`${apiBase}/terms/template`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ template }),
  });
  if (!res.ok) throw new Error(`Save failed (HTTP ${res.status})`);
}

export interface FinanceSummary {
  salesCount: number;
  revenueSatang: number;
  vatSatang: number;
  grossProfitSatang: number;
  refundCount: number;
  refundedSatang: number;
}

export async function fetchFinanceSummary(): Promise<FinanceSummary> {
  const res = await fetch(`${apiBase}/finance/summary`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load finance summary (HTTP ${res.status})`);
  return (await res.json()) as FinanceSummary;
}

export interface StockRow {
  variantId: string;
  sku: string | null;
  productName: string;
  productCode: string;
  onHand: number;
}

export async function fetchStock(): Promise<StockRow[]> {
  const res = await fetch(`${apiBase}/stock`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load stock (HTTP ${res.status})`);
  return ((await res.json()) as { stock: StockRow[] }).stock;
}

export async function adjustStock(input: {
  productVariantId: string;
  quantityDelta: number;
  movementType: string;
  reason?: string;
}): Promise<{ applied: boolean; quantityAfter: number; reason?: string }> {
  const res = await fetch(`${apiBase}/stock/adjust`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Adjust failed (HTTP ${res.status})`);
  return (await res.json()) as { applied: boolean; quantityAfter: number; reason?: string };
}

export async function archiveProduct(id: string): Promise<void> {
  const res = await fetch(`${apiBase}/products/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Archive failed (HTTP ${res.status})`);
}

export interface SaleRow {
  id: string;
  paymentMethod: string | null;
  grandTotalSatang: number;
  taxTotalSatang: number;
  saleStatus: string;
  createdAt: number;
  grossProfitSatang: number;
}

export async function refundSale(
  saleId: string,
): Promise<{ applied: boolean; reason?: string; restockedLines: number }> {
  const res = await fetch(`${apiBase}/sales/${saleId}/refund`, { method: "POST" });
  if (!res.ok) throw new Error(`Refund failed (HTTP ${res.status})`);
  return (await res.json()) as { applied: boolean; reason?: string; restockedLines: number };
}

export async function fetchSales(): Promise<SaleRow[]> {
  const res = await fetch(`${apiBase}/sales`, { cache: "no-store" });
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
  const res = await fetch(`${apiBase}/import/products`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv, mapping }),
  });
  if (!res.ok) throw new Error(`Import failed (HTTP ${res.status})`);
  return (await res.json()) as ImportResult;
}
