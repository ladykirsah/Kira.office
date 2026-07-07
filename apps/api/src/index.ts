import { DurableObject } from "cloudflare:workers";
import {
  computeSaleProfit,
  lineTaxSatang,
  partitionByClientUuid,
  parseCsv,
  parseThaiDateMs,
  mapRows,
  dedupeOrders,
  orderKey,
  resolveProductBarcode,
  type RowError,
  type SaleLineInput,
} from "@l-shopee/core";

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  STOCK_LEDGER: DurableObjectNamespace<StockLedger>;
  IMAGES: R2Bucket;
  /** Optional private bucket for daily DB backups (Phase 6). Falls back to IMAGES when unset. */
  BACKUPS?: R2Bucket;
  /** Shopee sync queue — wired when live Open API access is confirmed (Phase 5). */
  SHOPEE_QUEUE?: Queue;
  /** Set both to enable Cloudflare Access JWT enforcement (defense-in-depth). Unset = open. */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** SlipOK slip-verification credentials — set both to enable Payment auto-confirm. */
  SLIPOK_API_KEY?: string;
  SLIPOK_BRANCH_ID?: string;
  /** Comma-separated browser origins allowed to call this API with credentials (admin UI). */
  ALLOWED_CORS_ORIGINS?: string;
}

export { resolveActor, requireRole, type ActorContext } from "./auth";

interface SyncLine {
  productVariantId?: string | null; // null/absent for service (labour) lines
  lineType?: "part" | "service";
  description?: string; // item name to store on the line / print on the bill
  barcodeValue?: string;
  quantity: number;
  unitPriceSatang: number;
  discountSatang?: number;
  taxSatang?: number;
  unitCostSatang?: number;
}

interface SyncSale {
  clientUuid: string;
  saleNumber?: string;
  paymentMethod?: string;
  saleType?: "parts" | "repair";
  licensePlate?: string;
  vehicle?: string;
  notes?: string;
  lines: SyncLine[];
}

interface SyncConflict {
  productVariantId: string;
  requested: number;
  available: number;
}

export interface SyncValidationError {
  clientUuid: string;
  reason: string;
}

export interface SyncResult {
  applied: number;
  duplicates: number;
  conflicts: SyncConflict[];
  validationErrors: SyncValidationError[];
}

const STATIC_SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
};

export const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "https://app.homeseeker.me",
  "https://homeseeker.me",
];

/** CORS headers for this request — allowlisted origins get credentials; others stay wildcard (no cookies). */
export function buildCorsHeaders(
  request: Request,
  allowedOriginsCsv?: string,
): Record<string, string> {
  const allowlist = (allowedOriginsCsv ?? DEFAULT_CORS_ORIGINS.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get("Origin");
  const shared = {
    ...STATIC_SECURITY_HEADERS,
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, cf-access-jwt-assertion",
    "access-control-max-age": "86400",
  };
  if (origin && allowlist.includes(origin)) {
    return {
      ...shared,
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      Vary: "Origin",
    };
  }
  return { ...shared, "access-control-allow-origin": "*" };
}

/** Per-request response headers (set at the top of fetch()). */
let responseHeaders: Record<string, string> = {
  ...STATIC_SECURITY_HEADERS,
  "access-control-allow-origin": "*",
};

const json = (data: unknown, status = 200): Response =>
  Response.json(data, { status, headers: responseHeaders });

/** Parse a JSON request body; null when malformed/empty — routes turn that into a 400, not a 500. */
const readJson = async <T>(request: Request): Promise<T | null> =>
  (await request.json().catch(() => null)) as T | null;

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

interface AccessClaims {
  email?: string;
  aud?: string | string[];
  exp?: number;
}

/**
 * Verify a Cloudflare Access JWT (Cf-Access-Jwt-Assertion): RS256 signature against the team JWKS,
 * audience and expiry. Throws on any failure. NOTE: the Access application itself (created in the
 * dashboard) is the primary edge gate; this is defense-in-depth and must be confirmed against a real
 * token after the Access app exists.
 */
async function verifyAccessJwt(
  token: string,
  teamDomain: string,
  aud: string,
): Promise<{ email: string | null }> {
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) throw new Error("malformed token");
  const header = JSON.parse(new TextDecoder().decode(base64urlToBytes(h))) as { kid?: string };
  const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(p))) as AccessClaims;

  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new Error("bad audience");
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error("expired");

  const certs = (await (await fetch(`https://${teamDomain}/cdn-cgi/access/certs`)).json()) as {
    keys: JsonWebKey[] & { kid?: string }[];
  };
  const jwk = certs.keys.find((k) => (k as { kid?: string }).kid === header.kid);
  if (!jwk) throw new Error("unknown signing key");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64urlToBytes(sig),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) throw new Error("bad signature");
  return { email: payload.email ?? null };
}

/**
 * Access gate. Returns the authenticated user (email) on success, a 401 Response on failure, or an
 * open `{ email: null }` when Access is not configured (so the API keeps working until the owner
 * creates the Access app and sets ACCESS_TEAM_DOMAIN + ACCESS_AUD).
 */
export async function requireAccess(
  request: Request,
  env: Env,
): Promise<Response | { email: string | null }> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return { email: null };
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return json({ error: "unauthorized" }, 401);
  try {
    return await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
  } catch {
    return json({ error: "unauthorized" }, 401);
  }
}

export interface AuditLogInput {
  actorEmail: string | null;
  method: string;
  path: string;
  entityType?: string | null;
  entityId?: string | null;
  detail?: unknown;
}

/** Persist an append-only audit row for a mutation. Swallows D1 errors so the request still completes. */
export async function writeAuditLog(db: D1Database, input: AuditLogInput): Promise<void> {
  const action = `${input.method} ${input.path.split("?")[0]}`;
  const afterJson = input.detail != null ? JSON.stringify(input.detail) : null;
  try {
    await db
      .prepare(
        `INSERT INTO audit_logs
         (id, actor_email, user_id, action, entity_type, entity_id, before_json, after_json, created_at)
         VALUES (?, ?, NULL, ?, ?, ?, NULL, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        input.actorEmail,
        action,
        input.entityType ?? null,
        input.entityId ?? null,
        afterJson,
        Date.now(),
      )
      .run();
  } catch (err) {
    console.error("audit_log write failed:", err);
  }
}

/** Best-effort entity id from common REST paths (/products/:id, /sales/:id/refund, …). */
export function entityFromPath(pathname: string): {
  entityType: string | null;
  entityId: string | null;
} {
  const product = pathname.match(/^\/products\/([^/]+)/);
  if (product) return { entityType: "product", entityId: product[1] ?? null };
  const sale = pathname.match(/^\/sales\/([^/]+)/);
  if (sale) return { entityType: "sale", entityId: sale[1] ?? null };
  const service = pathname.match(/^\/services\/([^/]+)/);
  if (service) return { entityType: "service", entityId: service[1] ?? null };
  return { entityType: null, entityId: null };
}

/**
 * Per-line gross profit in satang for an on-site sale line: (price·qty − discount − tax) − cost·qty.
 * Tax is the VAT portion the line carries (POS computes it via @l-shopee/core); revenue is ex-VAT.
 */
export function lineGrossProfitSatang(line: SyncLine): number {
  const gross = line.unitPriceSatang * line.quantity;
  const revenueExTax = gross - (line.discountSatang ?? 0) - (line.taxSatang ?? 0);
  const cost = (line.unitCostSatang ?? 0) * line.quantity;
  return revenueExTax - cost;
}

export interface DraftTotals {
  subtotalSatang: number;
  discountTotalSatang: number;
  taxTotalSatang: number;
  grandTotalSatang: number;
}

/** Draft/quotation header totals from its lines. Mirrors the sale path: grand = subtotal − discount. */
export function draftHeaderTotals(lines: SyncLine[]): DraftTotals {
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  for (const l of lines) {
    subtotal += l.unitPriceSatang * l.quantity;
    discount += l.discountSatang ?? 0;
    tax += l.taxSatang ?? 0;
  }
  return {
    subtotalSatang: subtotal,
    discountTotalSatang: discount,
    taxTotalSatang: tax,
    grandTotalSatang: subtotal - discount,
  };
}

/** True when the line deducts stock (a part), not a labour/service line. */
export function isPartLine(line: SyncLine): boolean {
  if (line.lineType === "service") return false;
  return !!line.productVariantId;
}

/** Reject malformed sync lines before any stock or money is touched. */
export function validateSyncLine(line: SyncLine): string | null {
  const qty = line.quantity;
  if (!Number.isInteger(qty) || qty <= 0) {
    return "quantity must be a positive integer";
  }
  if (!Number.isInteger(line.unitPriceSatang) || line.unitPriceSatang < 0) {
    return "unit price must be a non-negative integer (satang)";
  }
  // Bound the client-supplied discount server-side: a discount above the line subtotal would persist
  // a negative line total and negative finance postings (the client clamps, but the server must too).
  const discount = line.discountSatang ?? 0;
  if (!Number.isInteger(discount) || discount < 0) {
    return "discount must be a non-negative integer (satang)";
  }
  if (discount > line.unitPriceSatang * qty) {
    return "discount must not exceed the line subtotal";
  }
  if (line.lineType === "service" && line.productVariantId) {
    return "service lines must not have a product variant";
  }
  if (line.lineType === "part" && !line.productVariantId) {
    return "part lines require a product variant";
  }
  return null;
}

interface VariantTaxProfile {
  variantId: string;
  vatRateBp: number;
  priceIncludesVat: boolean;
  isTaxable: boolean;
}

/** Fill missing taxSatang on part lines from the product tax profile (defaults: 7% inclusive). */
function enrichLineTax(line: SyncLine, taxByVariant: Record<string, VariantTaxProfile>): SyncLine {
  if (line.taxSatang != null || !isPartLine(line)) return line;
  const profile = taxByVariant[line.productVariantId!];
  const taxSatang = lineTaxSatang({
    unitPriceSatang: line.unitPriceSatang,
    quantity: line.quantity,
    discountSatang: line.discountSatang,
    vatRateBp: profile?.vatRateBp ?? 700,
    priceIncludesVat: profile?.priceIncludesVat ?? true,
    isTaxable: profile?.isTaxable ?? true,
  });
  return { ...line, taxSatang };
}

/**
 * Idempotent offline-sale persistence against D1. Dedupes by client_uuid (server-applied + in-batch),
 * applies stock as ledger deltas (blocking oversell, surfaced as conflicts), and writes sale + lines
 * + ledger in one D1 batch. Always invoked through the StockLedger Durable Object so concurrent syncs
 * serialize (single writer); D1's unique index on client_uuid is the backstop against double-counting.
 */
export async function applySyncToDb(db: D1Database, sales: SyncSale[]): Promise<SyncResult> {
  if (sales.length === 0) return { applied: 0, duplicates: 0, conflicts: [], validationErrors: [] };

  const uuids = sales.map((s) => s.clientUuid);
  const existingRows = await db
    .prepare(
      `SELECT client_uuid AS clientUuid FROM onsite_sales WHERE client_uuid IN (${uuids.map(() => "?").join(",")})`,
    )
    .bind(...uuids)
    .all<{ clientUuid: string }>();
  const existing = (existingRows.results ?? []).map((r) => r.clientUuid);
  const { fresh, duplicates } = partitionByClientUuid(existing, sales);
  if (fresh.length === 0) {
    return { applied: 0, duplicates: duplicates.length, conflicts: [], validationErrors: [] };
  }

  const variantIds = [
    ...new Set(fresh.flatMap((s) => s.lines.filter(isPartLine).map((l) => l.productVariantId!))),
  ];
  const available: Record<string, number> = {};
  for (const id of variantIds) available[id] = 0;
  if (variantIds.length > 0) {
    const availRows = await db
      .prepare(
        `SELECT product_variant_id AS variantId, COALESCE(SUM(quantity_delta), 0) AS available
         FROM stock_ledger_entries WHERE product_variant_id IN (${variantIds.map(() => "?").join(",")})
         GROUP BY product_variant_id`,
      )
      .bind(...variantIds)
      .all<{ variantId: string; available: number }>();
    for (const row of availRows.results ?? []) available[row.variantId] = Number(row.available);
  }

  const taxByVariant: Record<string, VariantTaxProfile> = {};
  if (variantIds.length > 0) {
    const taxRows = await db
      .prepare(
        `SELECT v.id AS variantId,
                COALESCE(tp.vat_rate_bp, 700) AS vatRateBp,
                COALESCE(tp.price_includes_vat, 1) AS priceIncludesVat,
                COALESCE(tp.is_taxable, 1) AS isTaxable
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         LEFT JOIN tax_profiles tp ON tp.id = p.tax_profile_id
         WHERE v.id IN (${variantIds.map(() => "?").join(",")})`,
      )
      .bind(...variantIds)
      .all<{
        variantId: string;
        vatRateBp: number;
        priceIncludesVat: number;
        isTaxable: number;
      }>();
    for (const row of taxRows.results ?? []) {
      taxByVariant[row.variantId] = {
        variantId: row.variantId,
        vatRateBp: Number(row.vatRateBp),
        priceIncludesVat: !!row.priceIncludesVat,
        isTaxable: !!row.isTaxable,
      };
    }
  }

  const now = Date.now();
  const statements: D1PreparedStatement[] = [];
  const conflicts: SyncConflict[] = [];
  const validationErrors: SyncValidationError[] = [];
  let applied = 0;

  for (const sale of fresh) {
    let invalidReason: string | null = null;
    for (const line of sale.lines) {
      invalidReason = validateSyncLine(line);
      if (invalidReason) break;
    }
    if (invalidReason) {
      validationErrors.push({ clientUuid: sale.clientUuid, reason: invalidReason });
      continue;
    }

    const enrichedLines = sale.lines.map((l) => enrichLineTax(l, taxByVariant));

    const saleConflicts: SyncConflict[] = [];
    const simAvailable = { ...available };
    for (const line of enrichedLines) {
      if (!isPartLine(line)) continue;
      const vid = line.productVariantId!;
      const current = simAvailable[vid] ?? 0;
      const after = current - line.quantity;
      if (after < 0) {
        saleConflicts.push({
          productVariantId: vid,
          requested: line.quantity,
          available: current,
        });
      } else {
        simAvailable[vid] = after;
      }
    }
    if (saleConflicts.length > 0) {
      conflicts.push(...saleConflicts);
      continue;
    }

    const saleId = crypto.randomUUID();
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    const lineStatements: D1PreparedStatement[] = [];

    for (const line of enrichedLines) {
      if (!isPartLine(line)) {
        subtotal += line.unitPriceSatang * line.quantity;
        discountTotal += line.discountSatang ?? 0;
        taxTotal += line.taxSatang ?? 0;
        lineStatements.push(
          db
            .prepare(
              `INSERT INTO onsite_sale_lines
               (id, onsite_sale_id, product_variant_id, line_type, description, barcode_value, quantity, unit_price_satang, discount_satang, tax_satang, unit_cost_satang, gross_profit_satang)
               VALUES (?, ?, NULL, 'service', ?, NULL, ?, ?, ?, ?, 0, ?)`,
            )
            .bind(
              crypto.randomUUID(),
              saleId,
              line.description ?? null,
              line.quantity,
              line.unitPriceSatang,
              line.discountSatang ?? 0,
              line.taxSatang ?? 0,
              lineGrossProfitSatang(line),
            ),
        );
        continue;
      }

      const vid = line.productVariantId!;
      const current = available[vid] ?? 0;
      const after = current - line.quantity;
      available[vid] = after;
      subtotal += line.unitPriceSatang * line.quantity;
      discountTotal += line.discountSatang ?? 0;
      taxTotal += line.taxSatang ?? 0;

      lineStatements.push(
        db
          .prepare(
            `INSERT INTO onsite_sale_lines
             (id, onsite_sale_id, product_variant_id, line_type, description, barcode_value, quantity, unit_price_satang, discount_satang, tax_satang, unit_cost_satang, gross_profit_satang)
             VALUES (?, ?, ?, 'part', ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            saleId,
            vid,
            line.description ?? null,
            line.barcodeValue ?? null,
            line.quantity,
            line.unitPriceSatang,
            line.discountSatang ?? 0,
            line.taxSatang ?? 0,
            line.unitCostSatang ?? 0,
            lineGrossProfitSatang(line),
          ),
        db
          .prepare(
            `INSERT INTO stock_ledger_entries
             (id, product_variant_id, movement_type, quantity_delta, quantity_after, source_type, source_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            vid,
            "onsite_sale",
            -line.quantity,
            after,
            "onsite_sale",
            saleId,
            now,
          ),
      );
    }

    if (lineStatements.length === 0) continue;

    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO onsite_sales
           (id, client_uuid, sale_number, payment_method, sale_type, license_plate, vehicle, notes, sync_status, subtotal_satang, discount_total_satang, tax_total_satang, grand_total_satang, sale_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          saleId,
          sale.clientUuid,
          sale.saleNumber?.trim() || null,
          sale.paymentMethod ?? null,
          sale.saleType ?? "parts",
          sale.licensePlate?.trim() || null,
          sale.vehicle?.trim() || null,
          sale.notes?.trim() || null,
          "synced",
          subtotal,
          discountTotal,
          taxTotal,
          subtotal - discountTotal,
          "completed",
          now,
        ),
      ...lineStatements,
    );
    applied += 1;
  }

  if (statements.length > 0) await db.batch(statements);
  return { applied, duplicates: duplicates.length, conflicts, validationErrors };
}

/**
 * Stock-ledger Durable Object: the single serialized writer for stock-affecting operations. One
 * instance per shop means concurrent /sync batches (and future online-order applies) are processed
 * one at a time, so oversell races can't occur. See docs/CLOUDFLARE_ARCHITECTURE.md.
 */
export class StockLedger extends DurableObject<Env> {
  async applySync(sales: SyncSale[]): Promise<SyncResult> {
    return applySyncToDb(this.env.DB, sales);
  }

  async applyAdjustment(adj: StockAdjustment): Promise<AdjustmentResult> {
    return applyAdjustmentToDb(this.env.DB, adj);
  }

  async refundSale(saleId: string): Promise<RefundResult> {
    return refundSaleToDb(this.env.DB, saleId);
  }
}

export interface ImportResult {
  /** Data rows seen (excludes the header). */
  received: number;
  /** Rows that mapped to a valid product (re-import is idempotent on the Product ID). */
  valid: number;
  /** Rows skipped for a missing required field. */
  invalid: number;
  errors: RowError[];
}

/**
 * Import products from a CSV (e.g. a Google Sheet export). `mapping` maps fields to header columns;
 * `product_ref` (Product ID) + `name` are required. Idempotent: INSERT OR IGNORE on the unique
 * product_ref, so re-importing the same file does not create duplicates. Variants/barcodes/pricing
 * follow later.
 */
export async function importProducts(
  db: D1Database,
  csv: string,
  mapping: Record<string, string>,
): Promise<ImportResult> {
  const rows = parseCsv(csv);
  const { records, errors } = mapRows(rows, mapping, ["product_ref", "name"]);
  const now = Date.now();
  const statements = records.map((r) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO products (id, product_ref, name, description, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        r["product_ref"] ?? "",
        r["name"] ?? "",
        r["description"] ?? null,
        "active",
        now,
      ),
  );
  if (statements.length > 0) await db.batch(statements);
  return {
    received: Math.max(0, rows.length - 1),
    valid: records.length,
    invalid: errors.length,
    errors,
  };
}

export interface OrderImportResult {
  received: number;
  /** Fresh orders inserted (deduped vs already-imported + in-batch). */
  imported: number;
  duplicates: number;
  invalid: number;
  errors: RowError[];
}

/** Parse a money string ("1,234.50", "฿890") to integer satang; 0 if blank/unparseable. */
export function parseMoneyToSatang(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Parse an order-date string to epoch ms; null if blank/unparseable. Shopee export timestamps
 * ("2026-06-23 13:49", "2026-06-14") are Asia/Bangkok wall-clock with NO offset — a naive
 * Date.parse would interpret them in the runtime's local zone (UTC on Workers → stored 7h off),
 * so naive strings are anchored to +07:00 explicitly. Strings carrying an offset/Z are untouched.
 */
export function parseOrderDateMs(s: string | undefined): number | null {
  if (!s) return null;
  let str = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    str = `${str}T00:00:00+07:00`; // date-only → Bangkok midnight
  } else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(str)) {
    str = `${str.replace(" ", "T")}+07:00`; // naive datetime → Bangkok wall-clock
  }
  const t = Date.parse(str);
  return Number.isFinite(t) ? t : null;
}

/** Parse a fee-rate string like "3.21%" to basis points (321); 0 if blank/unparseable. */
export function parseFeePct(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Import Shopee orders from a Seller Centre CSV export (the bridge before the live v2 API). Required
 * field: `external_order_id`; optional: order_status, payment_status, order_total, order_fee,
 * order_date, plus the enriched order-level columns buyer_username, sales_total (→ Sales; Total is
 * then computed as Sales − fees = the seller's net payout), fee_pct (→ basis points) and ship_date
 * (only captured when the CSV actually has that column). Deduped by (channel,
 * external_order_id) via core.dedupeOrders + an INSERT OR IGNORE on the unique index, so re-importing
 * the same export never creates duplicates.
 */
export async function importShopeeOrders(
  db: D1Database,
  csv: string,
  mapping: Record<string, string>,
): Promise<OrderImportResult> {
  const rows = parseCsv(csv);
  // Optional columns (totals/date/fees) are only mapped when the CSV actually has them, so a minimal
  // export (ids + statuses) still imports without mapRows throwing on a missing column.
  const header = rows[0] ?? [];
  const effectiveMapping: Record<string, string> = {};
  for (const [field, col] of Object.entries(mapping)) {
    if (field === "external_order_id" || header.includes(col)) effectiveMapping[field] = col;
  }
  const { records, errors } = mapRows(rows, effectiveMapping, ["external_order_id"]);
  const incoming = records.map((r) => {
    const feeTotalSatang = parseMoneyToSatang(r["order_fee"]);
    // Sales = what the buyer paid for the product; null when the column isn't mapped.
    const salesSatang = r["sales_total"] != null ? parseMoneyToSatang(r["sales_total"]) : null;
    return {
      channel: "shopee" as const,
      externalOrderId: r["external_order_id"] ?? "",
      orderStatus: r["order_status"] ?? null,
      paymentStatus: r["payment_status"] ?? null,
      // Total = seller net payout = Sales − fees when Sales is present; else the mapped order_total.
      grandTotalSatang:
        salesSatang != null ? salesSatang - feeTotalSatang : parseMoneyToSatang(r["order_total"]),
      feeTotalSatang,
      orderCreatedAt: parseOrderDateMs(r["order_date"]),
      buyerUsername: r["buyer_username"] ?? null,
      salesSatang,
      feeBp: r["fee_pct"] != null ? parseFeePct(r["fee_pct"]) : null,
      shipTimeMs: parseOrderDateMs(r["ship_date"]),
    };
  });

  let existingKeys: string[] = [];
  const ids = incoming.map((o) => o.externalOrderId);
  if (ids.length > 0) {
    const existingRows = await db
      .prepare(
        `SELECT external_order_id AS id FROM sales_orders WHERE channel = 'shopee' AND external_order_id IN (${ids.map(() => "?").join(",")})`,
      )
      .bind(...ids)
      .all<{ id: string }>();
    existingKeys = (existingRows.results ?? []).map((r) =>
      orderKey({ channel: "shopee", externalOrderId: r.id }),
    );
  }

  const { fresh, duplicates } = dedupeOrders(existingKeys, incoming);
  const now = Date.now();
  const statements = fresh.map((o) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO sales_orders
         (id, channel, external_order_id, order_status, payment_status, grand_total_satang, fee_total_satang, order_created_at, imported_at, import_source, buyer_username, sales_satang, fee_bp, ship_time_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        o.channel,
        o.externalOrderId,
        o.orderStatus,
        o.paymentStatus,
        o.grandTotalSatang,
        o.feeTotalSatang,
        o.orderCreatedAt,
        now,
        "csv",
        o.buyerUsername,
        o.salesSatang ?? 0, // sales_satang / fee_bp are NOT NULL DEFAULT 0 (migration 0029):
        o.feeBp ?? 0, // binding NULL fails on real D1 and rolls back the whole batch.
        o.shipTimeMs,
      ),
  );
  if (statements.length > 0) await db.batch(statements);
  return {
    received: Math.max(0, rows.length - 1),
    imported: fresh.length,
    duplicates: duplicates.length,
    invalid: errors.length,
    errors,
  };
}

export interface CustomerImportResult {
  received: number;
  created: number;
  updated: number;
  duplicates: number;
  invalid: number;
  errors: RowError[];
}

/**
 * Bulk upsert of the shop's legacy customer Excel (parsed to CSV client-side), keyed by normalized
 * plate. Same ON CONFLICT/COALESCE contract as upsertCustomerByPlate, with empty cells sent as
 * NULL — so re-importing (or importing a sparser file) can never blank data someone typed into the
 * directory. An in-file repeat of a plate is skipped (first row wins) and counted as a duplicate.
 */
export async function importCustomers(
  db: D1Database,
  csv: string,
  mapping: Record<string, string>,
): Promise<CustomerImportResult> {
  const rows = parseCsv(csv);
  const { records, errors } = mapRows(rows, mapping, ["license_plate"]);

  const seen = new Set<string>();
  const unique: { plate: string; record: Record<string, string> }[] = [];
  let duplicates = 0;
  for (const record of records) {
    const plate = normalizePlate(record["license_plate"] ?? "");
    if (seen.has(plate)) {
      duplicates++;
      continue;
    }
    seen.add(plate);
    unique.push({ plate, record });
  }

  // Which plates already exist (to split created/updated)? D1 caps bound params at 100/query, and
  // a legacy Excel can hold hundreds of rows — chunk the IN lookup.
  const existing = new Set<string>();
  const plates = unique.map((u) => u.plate);
  for (let i = 0; i < plates.length; i += 90) {
    const chunk = plates.slice(i, i + 90);
    const found = await db
      .prepare(
        `SELECT license_plate AS licensePlate FROM customers WHERE license_plate IN (${chunk.map(() => "?").join(",")})`,
      )
      .bind(...chunk)
      .all<{ licensePlate: string }>();
    for (const r of found.results ?? []) existing.add(r.licensePlate);
  }

  const nn = (s: string | undefined) => (s ? s : null); // empty cell → NULL (preserve existing)
  const now = Date.now();
  const statements = unique.map(({ plate, record }) =>
    db
      .prepare(
        `INSERT INTO customers
           (id, license_plate, plate_province, customer_name, phone, car_model, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(license_plate) DO UPDATE SET
           plate_province = COALESCE(excluded.plate_province, customers.plate_province),
           customer_name = COALESCE(excluded.customer_name, customers.customer_name),
           phone = COALESCE(excluded.phone, customers.phone),
           car_model = COALESCE(excluded.car_model, customers.car_model),
           notes = COALESCE(excluded.notes, customers.notes),
           updated_at = excluded.updated_at`,
      )
      .bind(
        crypto.randomUUID(),
        plate,
        nn(record["plate_province"]),
        nn(record["customer_name"]),
        nn(record["phone"]),
        nn(record["car_model"]),
        nn(record["notes"]),
        now,
        now,
      ),
  );
  if (statements.length > 0) await db.batch(statements);

  const created = unique.filter((u) => !existing.has(u.plate)).length;
  return {
    received: Math.max(0, rows.length - 1),
    created,
    updated: unique.length - created,
    duplicates,
    invalid: errors.length,
    errors: errors.slice(0, 500), // `invalid` keeps the true count; a garbage file shouldn't emit MBs of JSON
  };
}

export interface HistoryImportResult {
  received: number;
  imported: number;
  duplicates: number;
  invalid: number;
  errors: RowError[];
}

/**
 * Bulk import of transcribed legacy service history (one row per old paper/Excel bill) — MEMORY,
 * NOT MONEY: entries only show on the car's timeline; they never touch stock, revenue, or bill
 * numbering. Idempotent: the (plate, date, text) unique key + INSERT OR IGNORE make re-imports
 * safe. Each plate also gets a bare directory row so the car appears on the Customers list.
 */
export async function importCustomerHistory(
  db: D1Database,
  csv: string,
  mapping: Record<string, string>,
): Promise<HistoryImportResult> {
  const rows = parseCsv(csv);
  const { records, recordIndices, errors } = mapRows(rows, mapping, [
    "license_plate",
    "happened_at",
    "description",
  ]);

  const seen = new Set<string>();
  const entries: { plate: string; happenedAt: number; description: string }[] = [];
  let duplicates = 0;
  for (let r = 0; r < records.length; r++) {
    const record = records[r]!;
    const plate = normalizePlate(record["license_plate"] ?? "");
    const happenedAt = parseThaiDateMs(record["happened_at"] ?? "");
    if (happenedAt == null) {
      errors.push({
        rowIndex: recordIndices[r]!,
        reason: `unreadable date: "${record["happened_at"]}"`,
      });
      continue;
    }
    const description = record["description"] ?? "";
    const key = `${plate}|${happenedAt}|${description}`;
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    entries.push({ plate, happenedAt, description });
  }

  const now = Date.now();
  const statements = entries.map((e) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO customer_history_entries
           (id, license_plate, happened_at, description, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), e.plate, e.happenedAt, e.description, now),
  );
  // A bare directory row per plate (all-NULL fields; COALESCE keeps anything already saved) so
  // imported cars show on the Customers list before their first Kira bill.
  for (const plate of new Set(entries.map((e) => e.plate))) {
    statements.push(
      db
        .prepare(
          `INSERT INTO customers
             (id, license_plate, plate_province, customer_name, phone, car_model, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(license_plate) DO UPDATE SET
             updated_at = customers.updated_at`,
        )
        .bind(crypto.randomUUID(), plate, null, null, null, null, null, now, now),
    );
  }
  // Real D1 reports meta.changes per statement; an INSERT OR IGNORE suppressed by the UNIQUE key
  // shows 0 — count those as duplicates so a re-import truthfully reports what was written.
  let written = entries.length;
  if (statements.length > 0) {
    const results = await db.batch(statements);
    written = results
      .slice(0, entries.length)
      .reduce(
        (n, r) => n + ((r as { meta?: { changes?: number } }).meta?.changes === 0 ? 0 : 1),
        0,
      );
  }

  errors.sort((a, b) => a.rowIndex - b.rowIndex);
  return {
    received: Math.max(0, rows.length - 1),
    imported: written,
    duplicates: duplicates + (entries.length - written),
    invalid: errors.length,
    errors: errors.slice(0, 500), // `invalid` keeps the true count; a garbage file shouldn't emit MBs of JSON
  };
}

export interface CreateProductInput {
  /** The Product ID (manufacturer/catalog part no.) — the sole product identifier and barcode source. */
  productRef: string;
  name: string;
  description?: string;
  barcode?: string;
}

export interface CreateProductResult {
  productId: string;
  /** null when the product already existed (created=false). */
  variantId: string | null;
  created: boolean;
}

/**
 * Create a product + a default variant (sku = Product ID) and, if a barcode is given, a primary
 * barcode — in one D1 batch. Idempotent: returns the existing product (created=false) if the
 * Product ID is already used, so no orphan variants are produced. Throws on missing Product ID/name.
 */
export async function createProduct(
  db: D1Database,
  input: CreateProductInput,
): Promise<CreateProductResult> {
  const ref = input.productRef.trim();
  const name = input.name.trim();
  if (!ref || !name) throw new Error("productRef and name are required");

  const existing = await db
    .prepare("SELECT id FROM products WHERE product_ref = ?")
    .bind(ref)
    .first<{ id: string }>();
  if (existing) return { productId: existing.id, variantId: null, created: false };

  const productId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  const barcode = input.barcode?.trim();
  const now = Date.now();
  const statements = [
    db
      .prepare(
        `INSERT INTO products (id, product_ref, name, description, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(productId, ref, name, input.description?.trim() || null, "active", now),
    db
      .prepare(
        `INSERT INTO product_variants (id, product_id, sku, barcode_primary, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(variantId, productId, ref, barcode || null, "active", now),
  ];
  if (barcode) {
    statements.push(
      db
        .prepare(
          `INSERT INTO barcodes (id, product_variant_id, barcode_value, is_primary, is_internal_generated, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), variantId, barcode, 1, 0, now),
    );
  }
  await db.batch(statements);
  return { productId, variantId, created: true };
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_GALLERY_IMAGES = 10;

export interface UploadImageResult {
  key: string;
  url: string;
}

export interface GalleryImage {
  id: string;
  imageKey: string;
  url: string;
  isCover: boolean;
}

function validateImage(bytes: ArrayBuffer, contentType: string | null): string {
  if (!contentType || !ALLOWED_IMAGE_TYPES[contentType]) {
    throw new Error("unsupported image type (use jpeg, png or webp)");
  }
  if (bytes.byteLength === 0) throw new Error("empty image");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("image too large (max 5MB)");
  return ALLOWED_IMAGE_TYPES[contentType];
}

/** Editable shop-info text fields, stored one KV key each as `shop:<field>`. Bilingual: a TH key
 *  plus its `*En` counterpart. Image keys (logo/QR) are stored separately on upload, not here. */
export const SHOP_TEXT_FIELDS = [
  "name",
  "nameEn",
  "address",
  "addressEn",
  "quoteNote",
  "quoteNoteEn",
  "qrHeadline",
  "qrHeadlineEn",
  "qrSubtitle",
  "qrSubtitleEn",
  // JSON array of PromptPay methods ({id,label,promptpayId,isDefault}) — the Payment page dropdown.
  // Parsed/normalized by @l-shopee/core paymentMethods; stored verbatim as one KV string.
  "paymentMethods",
] as const;

/** Store the shop logo or contact-QR image in R2 and record its key in KV (one current image per
 *  slot). Validates type + size via the shared image validator. Served back via GET /img/:key. */
export async function storeShopImage(
  bucket: R2Bucket,
  kv: KVNamespace,
  slot: "logo" | "qr",
  bytes: ArrayBuffer,
  contentType: string | null,
): Promise<UploadImageResult> {
  const ext = validateImage(bytes, contentType);
  const key = `shop/${slot}-${crypto.randomUUID()}.${ext}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType: contentType! } });
  await kv.put(slot === "logo" ? "shop:logoKey" : "shop:qrKey", key);
  return { key, url: `/img/${key}` };
}

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

/** Latest UNCLEARED payment approvals — the Payment page's working list of items awaiting the
 *  owner's reconciliation. Cleared (reconciled) rows stay in the table but drop out of this view. */
export async function listPayments(db: D1Database): Promise<PaymentRow[]> {
  const rows = await db
    .prepare(
      `SELECT id, method_label AS methodLabel, promptpay_id AS promptpayId,
              amount_satang AS amountSatang, status, created_at AS createdAt,
              approved_at AS approvedAt, slip_ref AS slipRef, confirmed_at AS confirmedAt
       FROM payments WHERE cleared_at IS NULL ORDER BY created_at DESC LIMIT 100`,
    )
    .all<PaymentRow>();
  return rows.results ?? [];
}

/** Owner reconciliation: mark every uncleared payment as cleared (never deletes — the record is the
 *  anti-cheat trail). Returns how many were cleared. */
export async function clearPayments(db: D1Database): Promise<{ cleared: number }> {
  const res = await db
    .prepare(`UPDATE payments SET cleared_at = ? WHERE cleared_at IS NULL`)
    .bind(Date.now())
    .run();
  return { cleared: res.meta?.changes ?? 0 };
}

export type SlipConfirmResult =
  | { ok: true; ref: string }
  | { ok: false; code: 400 | 404 | 409 | 422 | 501 | 502; error: string };

/** Both SlipOK credentials present? (Unset = the feature stays manual-approve only.) */
export function slipVerificationConfigured(
  env: Pick<Env, "SLIPOK_API_KEY" | "SLIPOK_BRANCH_ID">,
): boolean {
  return Boolean(env.SLIPOK_API_KEY && env.SLIPOK_BRANCH_ID);
}

/** Sanity check for a scanned slip mini-QR payload (bank slips carry a machine-readable QR). */
function looksLikeSlipQr(data: string): boolean {
  const t = data.trim();
  return t.length >= 20 && t.length <= 1000 && !/\s/.test(t);
}

/**
 * SlipOK adapter — the ONLY place that knows the provider's wire format, so a provider change (or
 * an endpoint fix) touches one function. ASSUMPTION (unverified against the live API — the owner
 * hasn't created the SlipOK account yet): POST api.slipok.com/api/line/apikey/{branchId} with
 * x-authorization header, body {data, amount(THB)}; response {success, data:{transRef, amount}}.
 */
async function verifySlipWithSlipOk(
  env: Pick<Env, "SLIPOK_API_KEY" | "SLIPOK_BRANCH_ID">,
  qrData: string,
  expectedAmountSatang: number,
): Promise<
  { ok: true; ref: string; note: string } | { ok: false; code: 422 | 502; error: string }
> {
  let res: Response;
  try {
    res = await fetch(`https://api.slipok.com/api/line/apikey/${env.SLIPOK_BRANCH_ID}`, {
      method: "POST",
      headers: { "x-authorization": env.SLIPOK_API_KEY!, "content-type": "application/json" },
      body: JSON.stringify({ data: qrData, amount: expectedAmountSatang / 100 }),
    });
  } catch {
    return { ok: false, code: 502, error: "slip verification service unreachable" };
  }
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    data?: { transRef?: string; amount?: number };
  } | null;
  if (!body?.success || !body.data?.transRef) {
    return { ok: false, code: 422, error: body?.message ?? "slip rejected by verifier" };
  }
  // Trust but verify: if the provider echoes the slip amount, it must match the payment.
  if (
    typeof body.data.amount === "number" &&
    Math.round(body.data.amount * 100) !== expectedAmountSatang
  ) {
    return {
      ok: false,
      code: 422,
      error: `slip amount ฿${body.data.amount} does not match the payment amount`,
    };
  }
  return { ok: true, ref: body.data.transRef, note: JSON.stringify({ amount: body.data.amount }) };
}

/**
 * Payment auto-confirm: verify a bank-transfer slip QR and upgrade approved → confirmed with the
 * bank's transaction reference stored. ANTI-CHEAT: one slip confirms exactly one payment — a
 * reused slip is refused here AND by the partial unique index on payments.slip_ref.
 */
export async function confirmPaymentWithSlip(
  db: D1Database,
  env: Pick<Env, "SLIPOK_API_KEY" | "SLIPOK_BRANCH_ID">,
  paymentId: string,
  qrData: string,
): Promise<SlipConfirmResult> {
  if (!slipVerificationConfigured(env)) {
    return { ok: false, code: 501, error: "slip verification is not configured" };
  }
  const payment = await db
    .prepare(
      `SELECT id, amount_satang AS amountSatang, status, slip_ref AS slipRef
       FROM payments WHERE id = ?`,
    )
    .bind(paymentId)
    .first<{ id: string; amountSatang: number; status: string; slipRef: string | null }>();
  if (!payment) return { ok: false, code: 404, error: "payment not found" };
  if (payment.status === "confirmed") {
    return { ok: false, code: 409, error: "payment is already confirmed" };
  }
  if (!looksLikeSlipQr(qrData)) {
    return { ok: false, code: 400, error: "that does not look like a slip QR" };
  }

  const verified = await verifySlipWithSlipOk(env, qrData, payment.amountSatang);
  if (!verified.ok) return verified;

  const owner = await db
    .prepare(`SELECT id FROM payments WHERE slip_ref = ?`)
    .bind(verified.ref)
    .first<{ id: string }>();
  if (owner && owner.id !== payment.id) {
    return { ok: false, code: 409, error: "this slip was already used to confirm another payment" };
  }

  await db
    .prepare(
      `UPDATE payments SET status = 'confirmed', slip_ref = ?, confirmed_at = ?, verify_note = ?
       WHERE id = ?`,
    )
    .bind(verified.ref, Date.now(), verified.note, payment.id)
    .run();
  return { ok: true, ref: verified.ref };
}

/** Keep products.image_key pointing at the first gallery image (the cover), or null if none. */
async function syncCoverImage(db: D1Database, productId: string): Promise<void> {
  const first = await db
    .prepare(
      "SELECT image_key AS imageKey FROM product_images WHERE product_id = ? ORDER BY sort_order LIMIT 1",
    )
    .bind(productId)
    .first<{ imageKey: string }>();
  await db
    .prepare("UPDATE products SET image_key = ? WHERE id = ?")
    .bind(first?.imageKey ?? null, productId)
    .run();
}

/** Add an image to a product's gallery (up to MAX_GALLERY_IMAGES). The first one becomes the cover. */
export async function storeGalleryImage(
  db: D1Database,
  bucket: R2Bucket,
  productId: string,
  bytes: ArrayBuffer,
  contentType: string | null,
): Promise<GalleryImage> {
  const ext = validateImage(bytes, contentType);
  const countRow = await db
    .prepare("SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?")
    .bind(productId)
    .first<{ n: number }>();
  const count = countRow?.n ?? 0;
  if (count >= MAX_GALLERY_IMAGES) throw new Error(`max ${MAX_GALLERY_IMAGES} images`);

  const key = `products/${productId}/${crypto.randomUUID()}.${ext}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType: contentType! } });
  const imageId = crypto.randomUUID();
  const isCover = count === 0;
  await db
    .prepare(
      "INSERT INTO product_images (id, product_id, image_key, sort_order, is_cover, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(imageId, productId, key, count, isCover ? 1 : 0, Date.now())
    .run();
  await syncCoverImage(db, productId);
  return { id: imageId, imageKey: key, url: `/img/${key}`, isCover };
}

/** Remove a gallery image, delete its R2 object, and re-sync the cover. */
export async function deleteGalleryImage(
  db: D1Database,
  images: R2Bucket,
  productId: string,
  imageId: string,
): Promise<void> {
  const row = await db
    .prepare("SELECT image_key AS imageKey FROM product_images WHERE id = ? AND product_id = ?")
    .bind(imageId, productId)
    .first<{ imageKey: string }>();
  await db
    .prepare("DELETE FROM product_images WHERE id = ? AND product_id = ?")
    .bind(imageId, productId)
    .run();
  if (row?.imageKey) await images.delete(row.imageKey);
  await syncCoverImage(db, productId);
}

export interface StockAdjustment {
  productVariantId: string;
  quantityDelta: number;
  movementType: string;
  reason?: string;
}

export interface AdjustmentResult {
  variantId: string;
  quantityAfter: number;
  applied: boolean;
  reason?: string;
}

/**
 * Apply a manual stock movement (receive / correction / write-off) as a ledger delta. Rejects a zero
 * delta or one that would drive stock negative. Runs through the StockLedger Durable Object so manual
 * adjustments and sales serialize against the same single writer.
 */
export async function applyAdjustmentToDb(
  db: D1Database,
  adj: StockAdjustment,
): Promise<AdjustmentResult> {
  if (!Number.isInteger(adj.quantityDelta) || adj.quantityDelta === 0) {
    return {
      variantId: adj.productVariantId,
      quantityAfter: 0,
      applied: false,
      reason: "quantityDelta must be a non-zero integer",
    };
  }
  const row = await db
    .prepare(
      "SELECT COALESCE(SUM(quantity_delta), 0) AS onHand FROM stock_ledger_entries WHERE product_variant_id = ?",
    )
    .bind(adj.productVariantId)
    .first<{ onHand: number }>();
  const current = Number(row?.onHand ?? 0);
  const after = current + adj.quantityDelta;
  if (after < 0) {
    return {
      variantId: adj.productVariantId,
      quantityAfter: current,
      applied: false,
      reason: `would go negative (on hand ${current})`,
    };
  }
  await db
    .prepare(
      "INSERT INTO stock_ledger_entries (id, product_variant_id, movement_type, quantity_delta, quantity_after, source_type, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      adj.productVariantId,
      adj.movementType,
      adj.quantityDelta,
      after,
      "manual",
      adj.reason ?? null,
      Date.now(),
    )
    .run();
  return { variantId: adj.productVariantId, quantityAfter: after, applied: true };
}

export interface RefundResult {
  saleId: string;
  applied: boolean;
  restockedLines: number;
  reason?: string;
}

/**
 * Refund/cancel an on-site sale: restock each line (ledger +qty), mark the sale refunded, and write a
 * reversing financial record (negative amount). Idempotent guard against double-refund. Runs through
 * the StockLedger Durable Object so restock serializes with sales.
 */
export async function refundSaleToDb(db: D1Database, saleId: string): Promise<RefundResult> {
  const sale = await db
    .prepare(
      "SELECT id, grand_total_satang AS grandTotalSatang, sale_status AS saleStatus FROM onsite_sales WHERE id = ?",
    )
    .bind(saleId)
    .first<{ id: string; grandTotalSatang: number; saleStatus: string }>();
  if (!sale) return { saleId, applied: false, restockedLines: 0, reason: "sale not found" };
  if (sale.saleStatus === "refunded") {
    return { saleId, applied: false, restockedLines: 0, reason: "already refunded" };
  }

  const linesRes = await db
    .prepare(
      "SELECT product_variant_id AS productVariantId, quantity FROM onsite_sale_lines WHERE onsite_sale_id = ?",
    )
    .bind(saleId)
    .all<{ productVariantId: string | null; quantity: number }>();
  const lines = (linesRes.results ?? []).filter((l) => l.productVariantId);

  const now = Date.now();
  const statements: D1PreparedStatement[] = [];
  for (const line of lines) {
    const row = await db
      .prepare(
        "SELECT COALESCE(SUM(quantity_delta), 0) AS onHand FROM stock_ledger_entries WHERE product_variant_id = ?",
      )
      .bind(line.productVariantId)
      .first<{ onHand: number }>();
    const after = Number(row?.onHand ?? 0) + line.quantity;
    statements.push(
      db
        .prepare(
          "INSERT INTO stock_ledger_entries (id, product_variant_id, movement_type, quantity_delta, quantity_after, source_type, source_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          crypto.randomUUID(),
          line.productVariantId,
          "refund_return",
          line.quantity,
          after,
          "refund",
          saleId,
          now,
        ),
    );
  }
  statements.push(
    db.prepare("UPDATE onsite_sales SET sale_status = 'refunded' WHERE id = ?").bind(saleId),
    db
      .prepare(
        "INSERT INTO financial_records (id, source_type, source_id, record_type, channel, amount_satang, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        "onsite_sale",
        saleId,
        "refund",
        "onsite",
        -sale.grandTotalSatang,
        now,
      ),
  );
  await db.batch(statements);
  return { saleId, applied: true, restockedLines: lines.length };
}

/** On-hand stock per variant (ledger sum) with product info, for the stock screen. */
async function listStock(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT v.id AS variantId, v.sku, p.name AS productName, p.product_ref AS productRef,
            COALESCE(SUM(e.quantity_delta), 0) AS onHand
     FROM product_variants v
     JOIN products p ON p.id = v.product_id
     LEFT JOIN stock_ledger_entries e ON e.product_variant_id = v.id
     GROUP BY v.id
     ORDER BY p.name
     LIMIT 200`,
  ).all();
  return json({ stock: results });
}

/** Recent stock-ledger movements (newest first) with product/variant labels, for the stock screen. */
async function listStockMovements(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.product_variant_id AS variantId, v.sku, p.name AS productName,
            e.movement_type AS movementType, e.quantity_delta AS quantityDelta,
            e.quantity_after AS quantityAfter, e.created_at AS createdAt
     FROM stock_ledger_entries e
     JOIN product_variants v ON v.id = e.product_variant_id
     JOIN products p ON p.id = v.product_id
     ORDER BY e.created_at DESC
     LIMIT 100`,
  ).all();
  return json({ movements: results });
}

const DEFAULT_TERMS_TEMPLATE = [
  "เงื่อนไขและข้อตกลงสินค้า {{product_name}}",
  "ราคา {{price}} บาท (รวมภาษีมูลค่าเพิ่ม)",
  "รับประกันสินค้า {{warranty_days}} วันนับจากวันที่ได้รับสินค้า",
  "ติดต่อร้าน {{shop_name}}",
].join("\n");

/** Thai T&C template, stored in KV. The admin editor renders it via @l-shopee/core/terms. */
async function getTerms(env: Env): Promise<Response> {
  const template = (await env.KV.get("terms:template")) ?? DEFAULT_TERMS_TEMPLATE;
  return json({ template });
}

/** Products with the default variant's price (offline + online), on-hand stock, and Shopee status. */
async function listProducts(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.product_ref AS productRef, p.name, p.status, p.image_key AS imageKey,
            p.shopee_listed AS shopeeListed,
            v.id AS variantId,
            b.name AS brandName,
            t.name AS typeName,
            u.name AS usageName,
            COALESCE(pp.target_price_satang, 0) AS offlinePriceSatang,
            COALESCE(pp.online_price_satang, 0) AS onlinePriceSatang,
            COALESCE(pp.b2b_price_satang, 0) AS b2bPriceSatang,
            COALESCE(pp.item_cost_satang, 0) AS itemCostSatang,
            COALESCE(pp.online_commission_bp, 0) AS onlineCommissionBp,
            COALESCE(pp.tax_on_cost, 0) AS taxOnCost,
            (SELECT GROUP_CONCAT(DISTINCT pf.car_brand) FROM product_fitments pf
               WHERE pf.product_id = p.id AND pf.car_brand IS NOT NULL) AS carBrandsCsv,
            COALESCE(
              (SELECT SUM(quantity_delta) FROM stock_ledger_entries WHERE product_variant_id = v.id),
              0
            ) AS onHand
     FROM products p
     LEFT JOIN brands b ON b.id = p.brand_id
     LEFT JOIN product_types t ON t.id = p.type_id
     LEFT JOIN usage_categories u ON u.id = p.usage_id
     LEFT JOIN product_variants v
       ON v.id = (SELECT id FROM product_variants WHERE product_id = p.id ORDER BY created_at LIMIT 1)
     LEFT JOIN pricing_profiles pp ON pp.product_variant_id = v.id
     ORDER BY p.created_at DESC LIMIT 200`,
  ).all();
  return json({ products: results });
}

export interface SaleExportRow {
  paymentMethod: string | null;
  grandTotalSatang: number;
  taxTotalSatang: number;
  grossProfitSatang: number;
  saleStatus: string;
  createdAt: number;
  saleType: string | null;
  licensePlate: string | null;
  vehicle: string | null;
}

const SALES_SELECT = `SELECT s.id,
        s.sale_number AS saleNumber,
        s.payment_method AS paymentMethod,
        s.grand_total_satang AS grandTotalSatang,
        s.tax_total_satang AS taxTotalSatang,
        s.sale_status AS saleStatus,
        s.created_at AS createdAt,
        s.sale_type AS saleType,
        s.license_plate AS licensePlate,
        s.vehicle AS vehicle,
        COALESCE(
          (SELECT SUM(gross_profit_satang) FROM onsite_sale_lines WHERE onsite_sale_id = s.id),
          0
        ) AS grossProfitSatang
 FROM onsite_sales s
 WHERE s.stage = 'bill'
 ORDER BY s.created_at DESC
 LIMIT 100`;

/** Finance summary: on-site sales revenue/VAT/profit + refund totals (all-time). */
async function financeSummary(env: Env): Promise<Response> {
  const sales = await env.DB.prepare(
    "SELECT COUNT(*) AS salesCount, COALESCE(SUM(grand_total_satang),0) AS revenueSatang, COALESCE(SUM(tax_total_satang),0) AS vatSatang FROM onsite_sales WHERE sale_status = 'completed' AND stage = 'bill'",
  ).first<{ salesCount: number; revenueSatang: number; vatSatang: number }>();
  const profit = await env.DB.prepare(
    "SELECT COALESCE(SUM(l.gross_profit_satang),0) AS grossProfitSatang FROM onsite_sale_lines l JOIN onsite_sales s ON s.id = l.onsite_sale_id WHERE s.sale_status = 'completed' AND s.stage = 'bill'",
  ).first<{ grossProfitSatang: number }>();
  const refunds = await env.DB.prepare(
    "SELECT COUNT(*) AS refundCount, COALESCE(SUM(-amount_satang),0) AS refundedSatang FROM financial_records WHERE record_type = 'refund'",
  ).first<{ refundCount: number; refundedSatang: number }>();
  return json({
    salesCount: sales?.salesCount ?? 0,
    revenueSatang: sales?.revenueSatang ?? 0,
    vatSatang: sales?.vatSatang ?? 0,
    grossProfitSatang: profit?.grossProfitSatang ?? 0,
    refundCount: refunds?.refundCount ?? 0,
    refundedSatang: refunds?.refundedSatang ?? 0,
  });
}

const BACKUP_TABLES = [
  "products",
  "product_variants",
  "barcodes",
  "pricing_profiles",
  "onsite_sales",
  "onsite_sale_lines",
  "stock_ledger_entries",
  "sales_orders",
  "financial_records",
  // Irreplaceable/anti-cheat data added 2026-07: the customer directory, the payment approval
  // trail, the audit log, and hand-transcribed legacy service history.
  "customers",
  "payments",
  "audit_logs",
  "customer_history_entries",
];

/** R2 bucket for logical backups. Uses private BACKUPS binding when provisioned. */
export function backupR2Bucket(env: Env): R2Bucket {
  return env.BACKUPS ?? env.IMAGES;
}

/** Daily logical backup: dump key tables to a dated JSON object in R2. Returns the object key. */
export async function runDailyBackup(env: Env, atMs: number): Promise<string> {
  const dump: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
    dump[table] = results ?? [];
  }
  const key = `backups/${new Date(atMs).toISOString().slice(0, 10)}.json`;
  await backupR2Bucket(env).put(key, JSON.stringify({ exportedAt: atMs, tables: dump }));
  return key;
}

/** Imported sales orders (Shopee CSV bridge), newest first. */
async function listOrders(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, channel, external_order_id AS externalOrderId, order_status AS orderStatus,
            payment_status AS paymentStatus, grand_total_satang AS grandTotalSatang,
            fee_total_satang AS feeTotalSatang, order_created_at AS orderCreatedAt,
            imported_at AS importedAt, buyer_username AS buyerUsername,
            sales_satang AS salesSatang, fee_bp AS feeBp, ship_time_ms AS shipTimeMs,
            carrier, tracking_no AS trackingNo, profit_satang AS profitSatang
     FROM sales_orders ORDER BY imported_at DESC LIMIT 200`,
  ).all();
  return json({ orders: results });
}

/** Recent on-site sales with their aggregated gross profit (for the sales/finance views). */
async function querySales(db: D1Database): Promise<SaleExportRow[]> {
  const { results } = await db.prepare(SALES_SELECT).all<SaleExportRow>();
  return results ?? [];
}

async function listSales(env: Env): Promise<Response> {
  return json({ sales: await querySales(env.DB) });
}

// ── On-site drafts & quotations ────────────────────────────────────────────────────────────────
// A draft/quotation is a work-in-progress cart stored server-side so any POS device can reopen it.
// It is a NO-MONEY document: no stock check, no ledger, no financial record. Stock and revenue only
// move when it is finalized to a bill via the normal checkout (/sync) path. See @l-shopee/core
// onsiteDoc for the stage rules.
export interface DraftInput {
  draftId: string;
  clientUuid?: string;
  stage: "draft" | "quotation";
  saleNumber?: string | null; // QT… for a quotation (client-minted); null for a bare draft
  saleType?: "parts" | "repair";
  licensePlate?: string | null;
  vehicle?: string | null;
  notes?: string | null;
  lines: SyncLine[];
}

export type SaveDraftResult =
  | { ok: true; draftId: string; totals: DraftTotals }
  | { ok: false; error: string };

/** Persist a draft/quotation and REPLACE its lines. No stock, no ledger — pure cart storage. */
export async function saveDraftToDb(db: D1Database, draft: DraftInput): Promise<SaveDraftResult> {
  if (draft.stage !== "draft" && draft.stage !== "quotation") {
    return { ok: false, error: "stage must be 'draft' or 'quotation'" };
  }
  for (const line of draft.lines) {
    const reason = validateSyncLine(line);
    if (reason) return { ok: false, error: reason };
  }
  const totals = draftHeaderTotals(draft.lines);
  const id = draft.draftId;
  const now = Date.now();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO onsite_sales
           (id, client_uuid, sale_number, sale_type, license_plate, vehicle, notes, sync_status,
            subtotal_satang, discount_total_satang, tax_total_satang, grand_total_satang,
            sale_status, stage, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, 'open', ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           sale_number = excluded.sale_number,
           sale_type = excluded.sale_type,
           license_plate = excluded.license_plate,
           vehicle = excluded.vehicle,
           notes = excluded.notes,
           subtotal_satang = excluded.subtotal_satang,
           discount_total_satang = excluded.discount_total_satang,
           tax_total_satang = excluded.tax_total_satang,
           grand_total_satang = excluded.grand_total_satang,
           stage = excluded.stage`,
      )
      .bind(
        id,
        draft.clientUuid ?? id,
        draft.saleNumber?.trim() || null,
        draft.saleType ?? "parts",
        draft.licensePlate?.trim() || null,
        draft.vehicle?.trim() || null,
        draft.notes?.trim() || null,
        totals.subtotalSatang,
        totals.discountTotalSatang,
        totals.taxTotalSatang,
        totals.grandTotalSatang,
        draft.stage,
        now,
      ),
    db.prepare(`DELETE FROM onsite_sale_lines WHERE onsite_sale_id = ?`).bind(id),
    ...draft.lines.map((l) =>
      db
        .prepare(
          `INSERT INTO onsite_sale_lines
             (id, onsite_sale_id, product_variant_id, line_type, description, barcode_value, quantity,
              unit_price_satang, discount_satang, tax_satang, unit_cost_satang, gross_profit_satang)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          l.productVariantId ?? null,
          isPartLine(l) ? "part" : "service",
          l.description ?? null,
          l.barcodeValue ?? null,
          l.quantity,
          l.unitPriceSatang,
          l.discountSatang ?? 0,
          l.taxSatang ?? 0,
          l.unitCostSatang ?? 0,
          lineGrossProfitSatang(l),
        ),
    ),
  ];
  await db.batch(statements);
  return { ok: true, draftId: id, totals };
}

/** Open drafts + quotations (newest first) with their lines, so a POS device can reopen them. */
export async function listOpenDrafts(db: D1Database): Promise<unknown[]> {
  const heads = await db
    .prepare(
      `SELECT id, client_uuid AS clientUuid, sale_number AS saleNumber, sale_type AS saleType,
              license_plate AS licensePlate, vehicle, notes, stage,
              grand_total_satang AS grandTotalSatang, created_at AS createdAt
       FROM onsite_sales WHERE stage IN ('draft', 'quotation')
       ORDER BY created_at DESC LIMIT 100`,
    )
    .all<{ id: string }>();
  const rows = heads.results ?? [];
  const ids = rows.map((r) => r.id);
  const byDraft = new Map<string, unknown[]>();
  if (ids.length > 0) {
    const lines = await db
      .prepare(
        `SELECT onsite_sale_id AS onsiteSaleId, product_variant_id AS productVariantId,
                line_type AS lineType, description, barcode_value AS barcodeValue, quantity,
                unit_price_satang AS unitPriceSatang, discount_satang AS discountSatang,
                tax_satang AS taxSatang, unit_cost_satang AS unitCostSatang
         FROM onsite_sale_lines WHERE onsite_sale_id IN (${ids.map(() => "?").join(",")})`,
      )
      .bind(...ids)
      .all<{ onsiteSaleId: string }>();
    for (const l of lines.results ?? []) {
      const list = byDraft.get(l.onsiteSaleId) ?? [];
      list.push(l);
      byDraft.set(l.onsiteSaleId, list);
    }
  }
  return rows.map((r) => ({ ...r, lines: byDraft.get(r.id) ?? [] }));
}

/** Delete a draft/quotation and its lines. The stage guard makes it impossible to delete a bill. */
export async function deleteDraftFromDb(db: D1Database, id: string): Promise<{ ok: true }> {
  await db.batch([
    db.prepare(`DELETE FROM onsite_sale_lines WHERE onsite_sale_id = ?`).bind(id),
    db
      .prepare(`DELETE FROM onsite_sales WHERE id = ? AND stage IN ('draft', 'quotation')`)
      .bind(id),
  ]);
  return { ok: true };
}

/** One on-site sale (bill/quotation/draft) with its lines — the data source for reprint. */
export async function getOnsiteSale(db: D1Database, id: string): Promise<unknown | null> {
  const header = await db
    .prepare(
      `SELECT id, sale_number AS saleNumber, sale_type AS saleType, license_plate AS licensePlate,
              vehicle, notes, payment_method AS paymentMethod, stage, sale_status AS saleStatus,
              subtotal_satang AS subtotalSatang, discount_total_satang AS discountTotalSatang,
              tax_total_satang AS taxTotalSatang, grand_total_satang AS grandTotalSatang,
              created_at AS createdAt
       FROM onsite_sales WHERE id = ?`,
    )
    .bind(id)
    .first();
  if (!header) return null;
  const lines = await db
    .prepare(
      `SELECT product_variant_id AS productVariantId, line_type AS lineType, description,
              barcode_value AS barcodeValue, quantity, unit_price_satang AS unitPriceSatang,
              discount_satang AS discountSatang, tax_satang AS taxSatang,
              unit_cost_satang AS unitCostSatang
       FROM onsite_sale_lines WHERE onsite_sale_id = ?`,
    )
    .bind(id)
    .all();
  return { ...header, lines: lines.results ?? [] };
}

// ── Customers (directory keyed by car plate) ────────────────────────────────────────────────────
/** Canonical plate key: trimmed, internal whitespace collapsed to a single space. */
export function normalizePlate(plate: string): string {
  return plate.trim().replace(/\s+/g, " ");
}

export interface CustomerUpsert {
  licensePlate: string;
  plateProvince?: string | null;
  customerName?: string | null;
  phone?: string | null;
  carModel?: string | null;
  notes?: string | null;
}

/**
 * Upsert a customer/car by plate. Auto-created from plated sales; the owner fills name/phone later.
 * Provided fields overwrite; omitted (null) fields are LEFT ALONE (never blanks an existing name/phone).
 */
export async function upsertCustomerByPlate(
  db: D1Database,
  input: CustomerUpsert,
): Promise<{ ok: true; licensePlate: string } | { ok: false; error: string }> {
  const plate = normalizePlate(input.licensePlate ?? "");
  if (!plate) return { ok: false, error: "license plate is required" };
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO customers
         (id, license_plate, plate_province, customer_name, phone, car_model, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(license_plate) DO UPDATE SET
         plate_province = COALESCE(excluded.plate_province, customers.plate_province),
         customer_name = COALESCE(excluded.customer_name, customers.customer_name),
         phone = COALESCE(excluded.phone, customers.phone),
         car_model = COALESCE(excluded.car_model, customers.car_model),
         notes = COALESCE(excluded.notes, customers.notes),
         updated_at = excluded.updated_at`,
    )
    .bind(
      crypto.randomUUID(),
      plate,
      input.plateProvince ?? null,
      input.customerName ?? null,
      input.phone ?? null,
      input.carModel ?? null,
      input.notes ?? null,
      now,
      now,
    )
    .run();
  return { ok: true, licensePlate: plate };
}

/**
 * The customer/car list — the UNION of the directory (so an imported customer appears before its
 * first bill) and billed plates (so a car appears as soon as it has a bill, even with no directory
 * row). Bill stats come from a grouped LEFT JOIN; directory-only rows get billCount 0 and sort
 * after recently billed cars. `q` matches plate, phone, name, vehicle, or car model (empty = all).
 */
export async function searchCustomers(db: D1Database, q: string): Promise<unknown[]> {
  const term = `%${q.trim()}%`;
  const rows = await db
    .prepare(
      `SELECT x.license_plate AS licensePlate,
              b.vehicle AS vehicle,
              c.customer_name AS customerName, c.phone AS phone, c.car_model AS carModel,
              COALESCE(b.billCount, 0) AS billCount, b.lastVisitAt AS lastVisitAt
       FROM (SELECT license_plate FROM customers
             UNION
             SELECT license_plate FROM onsite_sales
             WHERE stage = 'bill' AND license_plate IS NOT NULL AND license_plate <> '') x
       LEFT JOIN customers c ON c.license_plate = x.license_plate
       LEFT JOIN (SELECT license_plate, MAX(vehicle) AS vehicle, COUNT(*) AS billCount,
                         MAX(created_at) AS lastVisitAt
                  FROM onsite_sales
                  WHERE stage = 'bill' AND license_plate IS NOT NULL AND license_plate <> ''
                  GROUP BY license_plate) b ON b.license_plate = x.license_plate
       WHERE (? = '' OR x.license_plate LIKE ? OR c.phone LIKE ? OR c.customer_name LIKE ?
              OR b.vehicle LIKE ? OR c.car_model LIKE ?)
       ORDER BY COALESCE(b.lastVisitAt, 0) DESC, x.license_plate
       LIMIT 100`,
    )
    .bind(q.trim(), term, term, term, term, term)
    .all();
  return rows.results ?? [];
}

/** One car: directory info + its bill history and open quotations (each with lines), for the page. */
export async function getCustomerDetail(db: D1Database, plate: string): Promise<unknown> {
  const customer = await db
    .prepare(
      `SELECT license_plate AS licensePlate, plate_province AS plateProvince,
              customer_name AS customerName, phone, car_model AS carModel, notes
       FROM customers WHERE license_plate = ?`,
    )
    .bind(normalizePlate(plate))
    .first();
  const salesRows = await db
    .prepare(
      `SELECT id, sale_number AS saleNumber, stage, created_at AS createdAt,
              subtotal_satang AS subtotalSatang, discount_total_satang AS discountTotalSatang,
              tax_total_satang AS taxTotalSatang, grand_total_satang AS grandTotalSatang,
              notes, vehicle
       FROM onsite_sales
       WHERE license_plate = ? AND stage IN ('bill', 'quotation')
       ORDER BY created_at DESC LIMIT 200`,
    )
    .bind(plate)
    .all<{ id: string; stage: string; vehicle: string | null }>();
  const sales = salesRows.results ?? [];
  const ids = sales.map((s) => s.id);
  const byId = new Map<string, unknown[]>();
  if (ids.length > 0) {
    // productRef (the Product ID) rides along on product lines: same-brand parts interchange
    // across car models, so only the ID says WHICH part was actually installed on this car.
    const lines = await db
      .prepare(
        `SELECT l.onsite_sale_id AS onsiteSaleId, l.description, l.line_type AS lineType,
                l.quantity, l.unit_price_satang AS unitPriceSatang,
                l.discount_satang AS discountSatang, p.product_ref AS productRef
         FROM onsite_sale_lines l
         LEFT JOIN product_variants v ON v.id = l.product_variant_id
         LEFT JOIN products p ON p.id = v.product_id
         WHERE l.onsite_sale_id IN (${ids.map(() => "?").join(",")})`,
      )
      .bind(...ids)
      .all<{ onsiteSaleId: string }>();
    for (const l of lines.results ?? []) {
      const arr = byId.get(l.onsiteSaleId) ?? [];
      arr.push(l);
      byId.set(l.onsiteSaleId, arr);
    }
  }
  const withLines = sales.map((s) => ({ ...s, lines: byId.get(s.id) ?? [] }));
  // Transcribed legacy service history (paper/Excel era) — shown on the same timeline, but these
  // are memory-only rows: no totals, no reprint, never in Sales.
  const legacy = await db
    .prepare(
      `SELECT id, happened_at AS happenedAt, description
       FROM customer_history_entries WHERE license_plate = ?
       ORDER BY happened_at DESC LIMIT 500`,
    )
    .bind(normalizePlate(plate))
    .all();
  return {
    customer: customer ?? null,
    vehicle: sales[0]?.vehicle ?? null,
    history: withLines.filter((s) => s.stage === "bill"),
    quotations: withLines.filter((s) => s.stage === "quotation"),
    legacy: legacy.results ?? [],
  };
}

const csvCell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const thb = (satang: number): string => (satang / 100).toFixed(2);

/** Render sales as accounting CSV (THB). Pure + tested; served by GET /sales/export.csv. */
export function salesToCsv(rows: SaleExportRow[]): string {
  const header = "date,payment_method,total_thb,vat_thb,gross_profit_thb,status";
  const lines = rows.map((r) =>
    [
      new Date(r.createdAt).toISOString(),
      csvCell(r.paymentMethod ?? ""),
      thb(r.grandTotalSatang),
      thb(r.taxTotalSatang),
      thb(r.grossProfitSatang),
      csvCell(r.saleStatus),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export interface BarcodeLookup {
  barcode: string;
  variantId: string;
  productId: string;
  productRef: string;
  name: string;
}

/** Resolve a scanned barcode to its variant + product (for the POS). Returns null if unknown. */
export async function lookupBarcode(db: D1Database, code: string): Promise<BarcodeLookup | null> {
  const row = await db
    .prepare(
      `SELECT b.barcode_value AS barcode,
              v.id AS variantId,
              p.id AS productId,
              p.product_ref AS productRef,
              p.name AS name
       FROM barcodes b
       JOIN product_variants v ON v.id = b.product_variant_id
       JOIN products p ON p.id = v.product_id
       WHERE b.barcode_value = ?
       LIMIT 1`,
    )
    .bind(code)
    .first<BarcodeLookup>();
  return row ?? null;
}

/** EAN-13 check digit for the first 12 digits (odd positions ×1, even ×3). Pure + tested. */
export function ean13CheckDigit(digits12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = digits12.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

export interface AddBarcodeResult {
  barcodeValue: string;
  generated: boolean;
  variantId: string | null;
}

/**
 * Add a barcode to a product's default variant. A provided/scanned manufacturer code is kept as-is;
 * when none is given the barcode is *derived from the product's Product ID* (the owner's policy — see
 * @l-shopee/core resolveProductBarcode). A product with neither a code nor a Product ID gets no
 * barcode (no-op) rather than a random one.
 */
export async function addBarcodeToProduct(
  db: D1Database,
  productId: string,
  providedValue?: string,
): Promise<AddBarcodeResult> {
  const variant = await db
    .prepare(
      "SELECT id, barcode_primary AS barcodePrimary FROM product_variants WHERE product_id = ? ORDER BY created_at LIMIT 1",
    )
    .bind(productId)
    .first<{ id: string; barcodePrimary: string | null }>();
  if (!variant) return { barcodeValue: "", generated: false, variantId: null };

  const provided = providedValue?.trim() ?? "";
  const refRow = await db
    .prepare("SELECT product_ref AS productRef FROM products WHERE id = ? LIMIT 1")
    .bind(productId)
    .first<{ productRef: string | null }>();
  const productRef = refRow?.productRef?.trim() ?? "";
  // No provided code and no Product ID to derive from → nothing to make.
  if (!provided && !productRef)
    return { barcodeValue: "", generated: false, variantId: variant.id };

  const generated = !provided;
  const barcodeValue = resolveProductBarcode({ productId: productRef, scannedBarcode: provided });
  const now = Date.now();
  const statements = [
    db
      .prepare(
        "INSERT INTO barcodes (id, product_variant_id, barcode_value, is_primary, is_internal_generated, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        variant.id,
        barcodeValue,
        variant.barcodePrimary ? 0 : 1,
        generated ? 1 : 0,
        now,
      ),
  ];
  if (!variant.barcodePrimary) {
    statements.push(
      db
        .prepare("UPDATE product_variants SET barcode_primary = ? WHERE id = ?")
        .bind(barcodeValue, variant.id),
    );
  }
  await db.batch(statements);
  return { barcodeValue, generated, variantId: variant.id };
}

/** Variants with their primary barcode + product info, for the barcode-management screen. */
async function listBarcodes(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT v.id AS variantId, p.id AS productId, p.product_ref AS productRef,
            p.name AS productName, v.barcode_primary AS barcode
     FROM product_variants v JOIN products p ON p.id = v.product_id
     ORDER BY p.name LIMIT 500`,
  ).all();
  return json({ barcodes: results });
}

export interface ProductImageRow {
  id: string;
  imageKey: string;
  sortOrder: number;
  isCover: number;
}

export interface Fitment {
  carBrand: string | null;
  carModel: string | null;
  yearFrom: number | null;
  yearTo: number | null;
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
    targetPriceSatang: number; // on-site B2C price
    onlinePriceSatang: number; // online default price
    b2bPriceSatang: number; // on-site B2B price
    onlineCommissionBp: number; // Shopee commission, basis points
    taxOnCost: number; // 1 = add 7% VAT to the cost base
  } | null;
  images: ProductImageRow[];
}

/** Product detail for the edit screen: the product, its default variant + barcode, pricing, gallery. */
export async function getProductDetail(db: D1Database, id: string): Promise<ProductDetail | null> {
  const product = await db
    .prepare(
      `SELECT p.id, p.product_ref AS productRef, p.name, p.description, p.status, p.image_key AS imageKey,
              p.shopee_listed AS shopeeListed, p.shopee_item_id AS shopeeItemId,
              p.category, p.weight_grams AS weightGrams,
              p.brand_id AS brandId, b.name AS brandName,
              p.type_id AS typeId, t.name AS typeName,
              p.usage_id AS usageId, u.name AS usageName,
              p.updated_at AS updatedAt
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN product_types t ON t.id = p.type_id
       LEFT JOIN usage_categories u ON u.id = p.usage_id
       WHERE p.id = ?`,
    )
    .bind(id)
    .first<ProductDetail["product"]>();
  if (!product) return null;
  const variant = await db
    .prepare(
      "SELECT id, barcode_primary AS barcode FROM product_variants WHERE product_id = ? ORDER BY created_at LIMIT 1",
    )
    .bind(id)
    .first<{ id: string; barcode: string | null }>();
  let pricing: ProductDetail["pricing"] = null;
  if (variant) {
    pricing =
      (await db
        .prepare(
          "SELECT item_cost_satang AS itemCostSatang, target_price_satang AS targetPriceSatang, online_price_satang AS onlinePriceSatang, b2b_price_satang AS b2bPriceSatang, online_commission_bp AS onlineCommissionBp, tax_on_cost AS taxOnCost FROM pricing_profiles WHERE product_variant_id = ? ORDER BY active_from DESC LIMIT 1",
        )
        .bind(variant.id)
        .first<NonNullable<ProductDetail["pricing"]>>()) ?? null;
  }
  let onHand = 0;
  if (variant) {
    const row = await db
      .prepare(
        "SELECT COALESCE(SUM(quantity_delta), 0) AS onHand FROM stock_ledger_entries WHERE product_variant_id = ?",
      )
      .bind(variant.id)
      .first<{ onHand: number }>();
    onHand = Number(row?.onHand ?? 0);
  }
  const { results: images } = await db
    .prepare(
      "SELECT id, image_key AS imageKey, sort_order AS sortOrder, is_cover AS isCover FROM product_images WHERE product_id = ? ORDER BY sort_order",
    )
    .bind(id)
    .all<ProductImageRow>();
  const { results: fitments } = await db
    .prepare(
      "SELECT car_brand AS carBrand, car_model AS carModel, year_from AS yearFrom, year_to AS yearTo FROM product_fitments WHERE product_id = ? ORDER BY sort_order, created_at",
    )
    .bind(id)
    .all<Fitment>();
  return {
    product,
    variantId: variant?.id ?? null,
    barcode: variant?.barcode ?? null,
    onHand,
    fitments,
    pricing,
    images,
  };
}

/** Update editable product fields. Name + status are required (validated at the route). */
export async function updateProduct(
  db: D1Database,
  id: string,
  fields: {
    name: string;
    description?: string;
    status: string;
    shopeeListed?: boolean;
    shopeeItemId?: string;
    productRef?: string;
    category?: string;
    weightGrams?: number;
    brandId?: string | null;
    typeId?: string | null;
    usageId?: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      "UPDATE products SET name = ?, description = ?, status = ?, shopee_listed = ?, shopee_item_id = ?, product_ref = ?, category = ?, weight_grams = ?, brand_id = ?, type_id = ?, usage_id = ?, updated_at = ? WHERE id = ?",
    )
    .bind(
      fields.name.trim(),
      fields.description?.trim() || null,
      fields.status,
      fields.shopeeListed ? 1 : 0,
      fields.shopeeItemId?.trim() || null,
      fields.productRef?.trim() || null,
      fields.category?.trim() || null,
      Math.max(0, Math.round(fields.weightGrams ?? 0)),
      fields.brandId ?? null,
      fields.typeId ?? null,
      fields.usageId ?? null,
      Date.now(),
      id,
    )
    .run();
}

export interface AttrOption {
  id: string;
  name: string;
}

// Whitelist of attribute kinds → their table. Table names come from this literal map only (never
// from request input), so interpolating them into SQL is safe.
const ATTR_TABLE: Record<string, string> = {
  brand: "brands",
  type: "product_types",
  usage: "usage_categories",
  car_brand: "car_brands",
  car_model: "car_models",
};

/** All managed attribute lists for the product + fitment dropdowns. */
export async function listAttributes(db: D1Database): Promise<{
  brands: AttrOption[];
  types: AttrOption[];
  usages: AttrOption[];
  carBrands: AttrOption[];
  carModels: AttrOption[];
}> {
  const q = (table: string) =>
    db.prepare(`SELECT id, name FROM ${table} ORDER BY sort_order, name`).all<AttrOption>();
  const [brands, types, usages, carBrands, carModels] = await Promise.all([
    q("brands"),
    q("product_types"),
    q("usage_categories"),
    q("car_brands"),
    q("car_models"),
  ]);
  return {
    brands: brands.results ?? [],
    types: types.results ?? [],
    usages: usages.results ?? [],
    carBrands: carBrands.results ?? [],
    carModels: carModels.results ?? [],
  };
}

/** Find an option by name (case-insensitive) or create it. Returns the option. */
export async function addAttribute(
  db: D1Database,
  table: string,
  name: string,
): Promise<AttrOption> {
  const n = name.trim();
  if (!n) throw new Error("name is required");
  const existing = await db
    .prepare(`SELECT id, name FROM ${table} WHERE name = ? COLLATE NOCASE`)
    .bind(n)
    .first<AttrOption>();
  if (existing) return existing;
  const optionId = crypto.randomUUID();
  await db
    .prepare(`INSERT INTO ${table} (id, name, sort_order, created_at) VALUES (?, ?, 0, ?)`)
    .bind(optionId, n, Date.now())
    .run();
  return { id: optionId, name: n };
}

/** Remove an option. Products still referencing it simply show a blank value. */
export async function deleteAttribute(db: D1Database, table: string, id: string): Promise<void> {
  await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
}

export interface ServiceRow {
  id: string;
  name: string;
  nameEn: string;
  basePriceSatang: number;
}

/** Repair/labour services offered at the counter (managed list with a base price). */
export async function listServices(db: D1Database): Promise<ServiceRow[]> {
  const { results } = await db
    .prepare(
      "SELECT id, name, name_en AS nameEn, base_price_satang AS basePriceSatang FROM services ORDER BY sort_order, name",
    )
    .all<ServiceRow>();
  return results ?? [];
}

/** Add a service (name + base price in satang). Idempotent on name (case-insensitive). */
export async function addService(
  db: D1Database,
  name: string,
  nameEn: string,
  basePriceSatang: number,
): Promise<ServiceRow> {
  const n = name.trim();
  if (!n) throw new Error("name is required");
  const en = nameEn.trim();
  const price = Math.max(0, Math.round(basePriceSatang || 0));
  const existing = await db
    .prepare("SELECT id FROM services WHERE name = ? COLLATE NOCASE")
    .bind(n)
    .first<{ id: string }>();
  if (existing) {
    await db
      .prepare("UPDATE services SET name_en = ?, base_price_satang = ? WHERE id = ?")
      .bind(en, price, existing.id)
      .run();
    return { id: existing.id, name: n, nameEn: en, basePriceSatang: price };
  }
  const sid = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO services (id, name, name_en, base_price_satang, sort_order, created_at) VALUES (?, ?, ?, ?, 0, ?)",
    )
    .bind(sid, n, en, price, Date.now())
    .run();
  return { id: sid, name: n, nameEn: en, basePriceSatang: price };
}

/** Update a service's name and/or base price. */
export async function updateService(
  db: D1Database,
  id: string,
  fields: { name: string; nameEn: string; basePriceSatang: number },
): Promise<void> {
  await db
    .prepare("UPDATE services SET name = ?, name_en = ?, base_price_satang = ? WHERE id = ?")
    .bind(
      fields.name.trim(),
      fields.nameEn.trim(),
      Math.max(0, Math.round(fields.basePriceSatang || 0)),
      id,
    )
    .run();
}

export async function deleteService(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM services WHERE id = ?").bind(id).run();
}

/** Resolve a typed/selected attribute value to an option id (creating it if new); null when empty. */
export async function resolveAttribute(
  db: D1Database,
  table: string,
  name: string | null | undefined,
): Promise<string | null> {
  const n = (name ?? "").trim();
  if (!n) return null;
  return (await addAttribute(db, table, n)).id;
}

/** A car model plus its service notes, as returned in the fitment tree. */
export interface CarModelNode extends AttrOption, CarModelInfo {}

export interface CarBrandTree {
  id: string;
  name: string;
  models: CarModelNode[];
}

/** Car brands with their models nested — for the fitment dropdowns and the Car fitment settings. */
export async function listCarFitment(db: D1Database): Promise<{ brands: CarBrandTree[] }> {
  const [brands, models] = await Promise.all([
    db.prepare("SELECT id, name FROM car_brands ORDER BY sort_order, name").all<AttrOption>(),
    db
      .prepare(
        "SELECT id, name, car_brand_id AS carBrandId, generation_code AS generationCode, year_from AS yearFrom, year_to AS yearTo, refrigerant, oring_usage AS oringUsage, coolant_liters AS coolantLiters, notes FROM car_models ORDER BY sort_order, name",
      )
      .all<{
        id: string;
        name: string;
        carBrandId: string | null;
        generationCode: string | null;
        yearFrom: number | null;
        yearTo: number | null;
        refrigerant: string | null;
        oringUsage: string | null;
        coolantLiters: string | null;
        notes: string | null;
      }>(),
  ]);
  const byBrand = new Map<string, CarModelNode[]>();
  for (const m of models.results ?? []) {
    if (!m.carBrandId) continue;
    const node: CarModelNode = {
      id: m.id,
      name: m.name,
      generationCode: m.generationCode ?? null,
      yearFrom: m.yearFrom ?? null,
      yearTo: m.yearTo ?? null,
      refrigerant: m.refrigerant ?? null,
      oringUsage: parseOringUsage(m.oringUsage),
      coolantLiters: m.coolantLiters ?? null,
      notes: m.notes ?? null,
    };
    const list = byBrand.get(m.carBrandId);
    if (list) list.push(node);
    else byBrand.set(m.carBrandId, [node]);
  }
  return {
    brands: (brands.results ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      models: byBrand.get(b.id) ?? [],
    })),
  };
}

/**
 * Find-or-create a car model (a generation) under a brand. A model is identified by name + era
 * (year range), so the same name can exist once per generation. When no era is given we match on
 * name alone (era-agnostic) — used to grow the list from typed product fitments without duplicating.
 */
export async function addCarModel(
  db: D1Database,
  brandId: string,
  name: string,
  yearFrom: number | null = null,
  yearTo: number | null = null,
): Promise<AttrOption> {
  const n = name.trim();
  if (!n) throw new Error("name is required");
  const yf = Number.isFinite(yearFrom) ? yearFrom : null;
  const yt = Number.isFinite(yearTo) ? yearTo : null;
  const hasEra = yf != null || yt != null;
  const existing = hasEra
    ? await db
        .prepare(
          "SELECT id, name FROM car_models WHERE car_brand_id = ? AND name = ? COLLATE NOCASE AND year_from IS ? AND year_to IS ?",
        )
        .bind(brandId, n, yf, yt)
        .first<AttrOption>()
    : await db
        .prepare(
          "SELECT id, name FROM car_models WHERE car_brand_id = ? AND name = ? COLLATE NOCASE",
        )
        .bind(brandId, n)
        .first<AttrOption>();
  if (existing) return existing;
  const optionId = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO car_models (id, name, sort_order, car_brand_id, year_from, year_to, created_at) VALUES (?, ?, 0, ?, ?, ?, ?)",
    )
    .bind(optionId, n, brandId, yf, yt, Date.now())
    .run();
  return { id: optionId, name: n };
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

/** Parse the stored o-ring JSON into clean {size, qty} rows; tolerant of null/garbage. */
function parseOringUsage(raw: string | null | undefined): OringEntry[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e) => e && typeof e.size === "string" && Number.isFinite(e.qty))
      .map((e) => ({ size: e.size, qty: e.qty }));
  } catch {
    return [];
  }
}

/** Save a car model's service notes. Blank text → null; years coerced to integers (or null). */
export async function updateCarModel(
  db: D1Database,
  id: string,
  info: CarModelInfo,
): Promise<void> {
  const text = (v: string | null | undefined) => {
    const s = (v ?? "").trim();
    return s || null;
  };
  const year = (v: number | null | undefined) => (Number.isFinite(v) ? v : null);
  // Keep only rows with a real size and a finite amount; null the column when none remain.
  const oring = (Array.isArray(info.oringUsage) ? info.oringUsage : [])
    .map((e) => ({ size: (e?.size ?? "").trim(), qty: Number(e?.qty) }))
    .filter((e) => e.size && Number.isFinite(e.qty))
    .map((e) => ({ size: e.size, qty: Math.round(e.qty) }));
  const oringJson = oring.length ? JSON.stringify(oring) : null;
  await db
    .prepare(
      "UPDATE car_models SET generation_code = ?, year_from = ?, year_to = ?, refrigerant = ?, oring_usage = ?, coolant_liters = ?, notes = ? WHERE id = ?",
    )
    .bind(
      text(info.generationCode),
      year(info.yearFrom),
      year(info.yearTo),
      text(info.refrigerant),
      oringJson,
      text(info.coolantLiters),
      text(info.notes),
      id,
    )
    .run();
}

/** Delete a car brand and all of its models. */
export async function deleteCarBrand(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM car_models WHERE car_brand_id = ?").bind(id),
    db.prepare("DELETE FROM car_brands WHERE id = ?").bind(id),
  ]);
}

/**
 * Replace a product's vehicle fitments. Find-or-creates each car brand/model so the managed lists
 * grow from typed values; empty rows are skipped. Years are integers (the second may be null).
 */
export async function setProductFitments(
  db: D1Database,
  productId: string,
  fitments: Fitment[],
): Promise<void> {
  for (const f of fitments) {
    const brandName = f.carBrand?.trim();
    if (!brandName) continue;
    const brandId = (await addAttribute(db, "car_brands", brandName)).id;
    if (f.carModel?.trim()) await addCarModel(db, brandId, f.carModel);
  }
  const now = Date.now();
  const statements: D1PreparedStatement[] = [
    db.prepare("DELETE FROM product_fitments WHERE product_id = ?").bind(productId),
  ];
  fitments.forEach((f, i) => {
    const brand = f.carBrand?.trim() || null;
    const model = f.carModel?.trim() || null;
    const yearFrom = Number.isFinite(f.yearFrom) ? f.yearFrom : null;
    const yearTo = Number.isFinite(f.yearTo) ? f.yearTo : null;
    if (!brand && !model && yearFrom == null && yearTo == null) return; // skip blank rows
    statements.push(
      db
        .prepare(
          "INSERT INTO product_fitments (id, product_id, car_brand, car_model, year_from, year_to, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(crypto.randomUUID(), productId, brand, model, yearFrom, yearTo, i, now),
    );
  });
  await db.batch(statements);
}

/**
 * Set a variant's primary barcode and make it scannable. Upserts the barcodes table (ignoring a
 * value already taken globally) so POS lookup finds it. Empty value is a no-op.
 */
export async function setVariantBarcode(
  db: D1Database,
  variantId: string,
  value: string,
): Promise<void> {
  const v = value.trim();
  if (!v) return;
  await db.batch([
    db.prepare("UPDATE product_variants SET barcode_primary = ? WHERE id = ?").bind(v, variantId),
    db
      .prepare(
        "INSERT INTO barcodes (id, product_variant_id, barcode_value, is_primary, is_internal_generated, created_at) VALUES (?, ?, ?, 1, 0, ?) ON CONFLICT(barcode_value) DO NOTHING",
      )
      .bind(crypto.randomUUID(), variantId, v, Date.now()),
  ]);
}

/** Soft-delete a product (status='archived') — preserves sales history + FKs. */
export async function archiveProduct(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE products SET status = 'archived' WHERE id = ?").bind(id).run();
}

export interface VariantPricing {
  itemCostSatang: number;
  targetPriceSatang: number; // on-site B2C price
  onlinePriceSatang: number; // online default price
  b2bPriceSatang: number; // on-site B2B price
  onlineCommissionBp: number; // Shopee commission, basis points
  taxOnCost: boolean; // add 7% VAT to the cost base
}

/** Persist a variant's pricing (replaces any prior profile). Amounts in satang. */
export async function setVariantPricing(
  db: D1Database,
  variantId: string,
  p: VariantPricing,
): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM pricing_profiles WHERE product_variant_id = ?").bind(variantId),
    db
      .prepare(
        "INSERT INTO pricing_profiles (id, product_variant_id, item_cost_satang, target_price_satang, online_price_satang, b2b_price_satang, online_commission_bp, tax_on_cost, active_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        variantId,
        p.itemCostSatang,
        p.targetPriceSatang,
        p.onlinePriceSatang,
        p.b2bPriceSatang,
        p.onlineCommissionBp,
        p.taxOnCost ? 1 : 0,
        Date.now(),
      ),
  ]);
}

/**
 * Minimal api Worker — a thin HTTP shell over @l-shopee/core + D1. Stock writes route through the
 * StockLedger Durable Object (serialized single writer). Grows into Hono routing, the Shopee adapter,
 * and Queues/Cron. See docs/CLOUDFLARE_ARCHITECTURE.md.
 */
const worker = {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    responseHeaders = buildCorsHeaders(request, env.ALLOWED_CORS_ORIGINS);
    const url = new URL(request.url);

    // CORS preflight — answer before auth (preflights carry no credentials).
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: responseHeaders });
    }

    // Health + image serving stay public; everything else passes the Access gate (a no-op until
    // ACCESS_TEAM_DOMAIN + ACCESS_AUD are set). Mutations are audit-logged with the Access user.
    if (url.pathname === "/health") {
      return json({ ok: true, service: "kiraoffice-api" });
    }

    // Friendly root, so hitting the API host directly isn't a bare 404. The admin UI is a separate
    // app on its own origin (port 3000 in local dev). Public — no data here.
    if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
      const adminUrl =
        url.hostname === "localhost" ? "http://localhost:3000" : "https://app.homeseeker.me";
      const body = `<!doctype html><meta charset="utf-8"><title>kiraoffice API</title>
<body style="font-family:system-ui;max-width:34rem;margin:4rem auto;padding:0 1rem;color:#1f2430;line-height:1.6">
<h1 style="color:#bf3c1d;margin-bottom:.25rem">kiraoffice API</h1>
<p>This is the back-office <strong>API</strong> (health, products, sync…) — not the admin interface.</p>
<p>Open the admin UI at <a href="${adminUrl}" style="color:#bf3c1d">${adminUrl}</a>.</p>
<p style="color:#566071">API health: <a href="/health" style="color:#566071">/health</a></p>`;
      return new Response(body, {
        status: 200,
        headers: { ...responseHeaders, "content-type": "text/html; charset=utf-8" },
      });
    }

    const isPublic = url.pathname.startsWith("/img/");
    let userEmail: string | null = null;
    if (!isPublic) {
      const gate = await requireAccess(request, env);
      if (gate instanceof Response) return gate;
      userEmail = gate.email;
    }
    if (request.method !== "GET") {
      const entity = entityFromPath(url.pathname);
      await writeAuditLog(env.DB, {
        actorEmail: userEmail,
        method: request.method,
        path: url.pathname,
        entityType: entity.entityType,
        entityId: entity.entityId,
      });
    }

    if (url.pathname === "/pricing/preview" && request.method === "POST") {
      const line = await readJson<SaleLineInput>(request);
      // Validate before computing — a missing price/quantity would silently return NaN profit.
      if (!line || typeof line.unitPrice !== "number" || typeof line.quantity !== "number") {
        return json({ error: "unitPrice and quantity are required numbers" }, 400);
      }
      return json(computeSaleProfit(line));
    }

    if (url.pathname === "/products" && request.method === "GET") {
      return listProducts(env);
    }

    if (url.pathname === "/sales" && request.method === "GET") {
      return listSales(env);
    }

    if (url.pathname === "/onsite/drafts" && request.method === "GET") {
      return json({ drafts: await listOpenDrafts(env.DB) });
    }
    if (url.pathname === "/onsite/drafts" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as Partial<DraftInput>;
      if (!body.draftId || !Array.isArray(body.lines)) {
        return json({ ok: false, error: "draftId and lines are required" }, 400);
      }
      const result = await saveDraftToDb(env.DB, body as DraftInput);
      return json(result, result.ok ? 200 : 400);
    }
    const draftDelete = url.pathname.match(/^\/onsite\/drafts\/([^/]+)$/);
    if (draftDelete && request.method === "DELETE") {
      return json(await deleteDraftFromDb(env.DB, decodeURIComponent(draftDelete[1]!)));
    }
    const saleGet = url.pathname.match(/^\/onsite\/sales\/([^/]+)$/);
    if (saleGet && request.method === "GET") {
      const sale = await getOnsiteSale(env.DB, decodeURIComponent(saleGet[1]!));
      return sale ? json({ sale }) : json({ error: "not found" }, 404);
    }
    if (url.pathname === "/customers" && request.method === "GET") {
      return json({ customers: await searchCustomers(env.DB, url.searchParams.get("q") ?? "") });
    }
    if (url.pathname === "/customers/by-plate" && request.method === "PUT") {
      const body = (await request.json().catch(() => ({}))) as Partial<CustomerUpsert>;
      if (!body.licensePlate) return json({ ok: false, error: "licensePlate required" }, 400);
      const result = await upsertCustomerByPlate(env.DB, body as CustomerUpsert);
      return json(result, result.ok ? 200 : 400);
    }
    const customerGet = url.pathname.match(/^\/customers\/([^/]+)$/);
    if (customerGet && request.method === "GET") {
      return json(await getCustomerDetail(env.DB, decodeURIComponent(customerGet[1]!)));
    }

    // Payment approvals — the Payment page records each PromptPay take here (anti-cheat trail).
    if (url.pathname === "/payments" && request.method === "GET") {
      return json({
        payments: await listPayments(env.DB),
        slipVerifyEnabled: slipVerificationConfigured(env),
      });
    }

    {
      const verify = url.pathname.match(/^\/payments\/([^/]+)\/verify-slip$/);
      if (verify && request.method === "POST") {
        const body = await readJson<{ qrData?: string }>(request);
        if (!body) return json({ error: "invalid JSON body" }, 400);
        const out = await confirmPaymentWithSlip(
          env.DB,
          env,
          decodeURIComponent(verify[1]!),
          body.qrData ?? "",
        );
        if (!out.ok) return json({ error: out.error }, out.code);
        return json(out);
      }
    }
    if (url.pathname === "/payments/clear" && request.method === "POST") {
      return json(await clearPayments(env.DB));
    }
    if (url.pathname === "/payments" && request.method === "POST") {
      const body = await readJson<{
        methodLabel?: string;
        promptpayId?: string;
        amountSatang?: number;
      }>(request);
      const label = body?.methodLabel?.trim();
      const account = body?.promptpayId?.trim();
      if (!label || !account || !Number.isInteger(body?.amountSatang) || body!.amountSatang! <= 0) {
        return json(
          { error: "methodLabel, promptpayId and a positive integer amountSatang are required" },
          400,
        );
      }
      const now = Date.now();
      const payment = {
        id: crypto.randomUUID(),
        methodLabel: label,
        promptpayId: account,
        amountSatang: body!.amountSatang!,
        status: "approved",
        createdAt: now,
        approvedAt: now,
      };
      await env.DB.prepare(
        `INSERT INTO payments (id, method_label, promptpay_id, amount_satang, status, created_at, approved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          payment.id,
          payment.methodLabel,
          payment.promptpayId,
          payment.amountSatang,
          payment.status,
          payment.createdAt,
          payment.approvedAt,
        )
        .run();
      return json({ payment }, 201);
    }

    if (url.pathname === "/stock" && request.method === "GET") {
      return listStock(env);
    }

    if (url.pathname === "/stock/movements" && request.method === "GET") {
      return listStockMovements(env);
    }

    if (url.pathname === "/terms/template" && request.method === "GET") {
      return getTerms(env);
    }
    if (url.pathname === "/terms/template" && request.method === "PUT") {
      const body = await readJson<{ template?: string }>(request);
      if (!body) return json({ error: "invalid JSON body" }, 400);
      await env.KV.put("terms:template", body.template ?? "");
      return json({ ok: true });
    }

    // Shop identity (name + address) — shown on bills and labels.
    if (url.pathname === "/shop-info" && request.method === "GET") {
      const [texts, logoKey, qrKey] = await Promise.all([
        Promise.all(SHOP_TEXT_FIELDS.map((f) => env.KV.get(`shop:${f}`))),
        env.KV.get("shop:logoKey"),
        env.KV.get("shop:qrKey"),
      ]);
      const out: Record<string, string | null> = {};
      SHOP_TEXT_FIELDS.forEach((f, i) => (out[f] = texts[i] ?? ""));
      out.logoKey = logoKey; // null when unset
      out.qrKey = qrKey;
      return json(out);
    }
    if (url.pathname === "/shop-info" && request.method === "PUT") {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      await Promise.all(
        SHOP_TEXT_FIELDS.map((f) => env.KV.put(`shop:${f}`, String(body[f] ?? "").trim())),
      );
      return json({ ok: true });
    }
    if (
      (url.pathname === "/shop-info/logo" || url.pathname === "/shop-info/qr") &&
      request.method === "POST"
    ) {
      const slot = url.pathname.endsWith("/logo") ? "logo" : "qr";
      const bytes = await request.arrayBuffer();
      try {
        const out = await storeShopImage(
          env.IMAGES,
          env.KV,
          slot,
          bytes,
          request.headers.get("content-type"),
        );
        return json(out, 201);
      } catch (err) {
        return json({ error: (err as Error).message }, 400);
      }
    }

    if (url.pathname === "/stock/adjust" && request.method === "POST") {
      const body = await readJson<Partial<StockAdjustment>>(request);
      if (!body?.productVariantId || typeof body.quantityDelta !== "number") {
        return json({ error: "productVariantId and quantityDelta are required" }, 400);
      }
      const stub = env.STOCK_LEDGER.get(env.STOCK_LEDGER.idFromName("default"));
      return json(
        await stub.applyAdjustment({
          productVariantId: body.productVariantId,
          quantityDelta: body.quantityDelta,
          movementType: body.movementType ?? "correction",
          reason: body.reason,
        }),
      );
    }

    const refundMatch = url.pathname.match(/^\/sales\/([^/]+)\/refund$/);
    if (refundMatch && request.method === "POST") {
      const stub = env.STOCK_LEDGER.get(env.STOCK_LEDGER.idFromName("default"));
      return json(await stub.refundSale(refundMatch[1]!));
    }

    if (url.pathname === "/sales/export.csv" && request.method === "GET") {
      const csv = salesToCsv(await querySales(env.DB));
      return new Response(csv, {
        headers: {
          ...responseHeaders,
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="sales.csv"',
        },
      });
    }

    const barcodeLookup = url.pathname.match(/^\/products\/by-barcode\/(.+)$/);
    if (barcodeLookup && request.method === "GET") {
      const found = await lookupBarcode(env.DB, decodeURIComponent(barcodeLookup[1]!));
      return found ? json(found) : json({ error: "barcode not found" }, 404);
    }

    // Duplicate-identifier check (Add product): does any product — active OR not — already use this
    // Product ID / barcode / Shopee ID? Returns the matching product, or null.
    if (url.pathname === "/products/identifier-check" && request.method === "GET") {
      const kind = url.searchParams.get("kind");
      const value = (url.searchParams.get("value") ?? "").trim();
      if (!value) return json({ match: null });
      let match: unknown = null;
      if (kind === "ref") {
        match = await env.DB.prepare(
          "SELECT id, name, product_ref AS productRef, status FROM products WHERE product_ref = ? COLLATE NOCASE LIMIT 1",
        )
          .bind(value)
          .first();
      } else if (kind === "shopee") {
        match = await env.DB.prepare(
          "SELECT id, name, product_ref AS productRef, status FROM products WHERE shopee_item_id = ? COLLATE NOCASE LIMIT 1",
        )
          .bind(value)
          .first();
      } else if (kind === "barcode") {
        match = await env.DB.prepare(
          "SELECT p.id, p.name, p.product_ref AS productRef, p.status FROM barcodes b JOIN product_variants v ON v.id = b.product_variant_id JOIN products p ON p.id = v.product_id WHERE b.barcode_value = ? LIMIT 1",
        )
          .bind(value)
          .first();
      } else {
        return json({ error: "bad kind" }, 400);
      }
      return json({ match: match ?? null });
    }

    if (url.pathname === "/barcodes" && request.method === "GET") {
      return listBarcodes(env);
    }

    // Managed part-attribute lists (brand / car system / part name) for the dropdowns + settings.
    if (url.pathname === "/attributes" && request.method === "GET") {
      return json(await listAttributes(env.DB));
    }
    const attrAdd = url.pathname.match(/^\/attributes\/([^/]+)$/);
    if (attrAdd && request.method === "POST") {
      const table = ATTR_TABLE[attrAdd[1]!];
      if (!table) return json({ error: "unknown attribute kind" }, 404);
      const body = (await request.json().catch(() => ({}))) as { name?: string };
      if (!body?.name?.trim()) return json({ error: "name is required" }, 400);
      return json(await addAttribute(env.DB, table, body.name), 201);
    }
    const attrDel = url.pathname.match(/^\/attributes\/([^/]+)\/([^/]+)$/);
    if (attrDel && request.method === "DELETE") {
      const table = ATTR_TABLE[attrDel[1]!];
      if (!table) return json({ error: "unknown attribute kind" }, 404);
      await deleteAttribute(env.DB, table, attrDel[2]!);
      return json({ ok: true });
    }

    // Repair/labour services (managed list with a base price).
    if (url.pathname === "/services" && request.method === "GET") {
      return json({ services: await listServices(env.DB) });
    }
    if (url.pathname === "/services" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        name?: string;
        nameEn?: string;
        basePriceSatang?: number;
      };
      if (!body?.name?.trim()) return json({ error: "name is required" }, 400);
      if (!body.basePriceSatang || body.basePriceSatang <= 0)
        return json({ error: "basePriceSatang must be greater than 0" }, 400);
      return json(
        await addService(env.DB, body.name, body.nameEn ?? "", body.basePriceSatang),
        201,
      );
    }
    const serviceById = url.pathname.match(/^\/services\/([^/]+)$/);
    if (serviceById && request.method === "PATCH") {
      const body = (await request.json().catch(() => ({}))) as {
        name?: string;
        nameEn?: string;
        basePriceSatang?: number;
      };
      if (!body?.name?.trim()) return json({ error: "name is required" }, 400);
      if (!body.basePriceSatang || body.basePriceSatang <= 0)
        return json({ error: "basePriceSatang must be greater than 0" }, 400);
      await updateService(env.DB, serviceById[1]!, {
        name: body.name,
        nameEn: body.nameEn ?? "",
        basePriceSatang: body.basePriceSatang,
      });
      return json({ ok: true });
    }
    if (serviceById && request.method === "DELETE") {
      await deleteService(env.DB, serviceById[1]!);
      return json({ ok: true });
    }

    // Car fitment taxonomy: brands with nested models (one brand → many models).
    if (url.pathname === "/car-fitment" && request.method === "GET") {
      return json(await listCarFitment(env.DB));
    }
    const cfModelAdd = url.pathname.match(/^\/car-fitment\/brands\/([^/]+)\/models$/);
    if (cfModelAdd && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        name?: string;
        yearFrom?: number | null;
        yearTo?: number | null;
      };
      if (!body?.name?.trim()) return json({ error: "name is required" }, 400);
      return json(
        await addCarModel(
          env.DB,
          cfModelAdd[1]!,
          body.name,
          body.yearFrom ?? null,
          body.yearTo ?? null,
        ),
        201,
      );
    }
    const cfBrandAdd = url.pathname.match(/^\/car-fitment\/brands$/);
    if (cfBrandAdd && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { name?: string };
      if (!body?.name?.trim()) return json({ error: "name is required" }, 400);
      return json(await addAttribute(env.DB, "car_brands", body.name), 201);
    }
    const cfBrandDel = url.pathname.match(/^\/car-fitment\/brands\/([^/]+)$/);
    if (cfBrandDel && request.method === "DELETE") {
      await deleteCarBrand(env.DB, cfBrandDel[1]!);
      return json({ ok: true });
    }
    const cfModelDel = url.pathname.match(/^\/car-fitment\/models\/([^/]+)$/);
    if (cfModelDel && request.method === "DELETE") {
      await deleteAttribute(env.DB, "car_models", cfModelDel[1]!);
      return json({ ok: true });
    }
    const cfModelUpd = url.pathname.match(/^\/car-fitment\/models\/([^/]+)$/);
    if (cfModelUpd && request.method === "PATCH") {
      const body = (await request.json().catch(() => ({}))) as Partial<CarModelInfo>;
      await updateCarModel(env.DB, cfModelUpd[1]!, {
        generationCode: body.generationCode ?? null,
        yearFrom: body.yearFrom ?? null,
        yearTo: body.yearTo ?? null,
        refrigerant: body.refrigerant ?? null,
        oringUsage: Array.isArray(body.oringUsage) ? body.oringUsage : [],
        coolantLiters: body.coolantLiters ?? null,
        notes: body.notes ?? null,
      });
      return json({ ok: true });
    }

    const addBarcode = url.pathname.match(/^\/products\/([^/]+)\/barcode$/);
    if (addBarcode && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { barcodeValue?: string };
      const out = await addBarcodeToProduct(env.DB, addBarcode[1]!, body.barcodeValue);
      return out.variantId ? json(out, 201) : json({ error: "product or variant not found" }, 404);
    }

    const productPricing = url.pathname.match(/^\/products\/([^/]+)\/pricing$/);
    if (productPricing && request.method === "PUT") {
      const body = await readJson<{
        itemCostSatang?: number;
        targetPriceSatang?: number;
        onlinePriceSatang?: number;
        b2bPriceSatang?: number;
        onlineCommissionBp?: number;
        taxOnCost?: boolean;
      }>(request);
      // Reject (don't coalesce) a malformed body — the ?? 0 fallbacks below would zero all pricing.
      if (!body) return json({ error: "invalid JSON body" }, 400);
      const detail = await getProductDetail(env.DB, productPricing[1]!);
      if (!detail?.variantId) return json({ error: "product or variant not found" }, 404);
      await setVariantPricing(env.DB, detail.variantId, {
        itemCostSatang: body.itemCostSatang ?? 0,
        targetPriceSatang: body.targetPriceSatang ?? 0,
        onlinePriceSatang: body.onlinePriceSatang ?? 0,
        b2bPriceSatang: body.b2bPriceSatang ?? 0,
        onlineCommissionBp: body.onlineCommissionBp ?? 0,
        taxOnCost: body.taxOnCost ?? false,
      });
      return json({ ok: true });
    }

    const productById = url.pathname.match(/^\/products\/([^/]+)$/);
    if (productById && request.method === "GET") {
      const detail = await getProductDetail(env.DB, productById[1]!);
      return detail ? json(detail) : json({ error: "not found" }, 404);
    }
    if (productById && request.method === "PATCH") {
      const body = await readJson<{
        name?: string;
        description?: string;
        status?: string;
        shopeeListed?: boolean;
        shopeeItemId?: string;
        productRef?: string;
        weightGrams?: number;
        barcode?: string;
        brandName?: string;
        usageName?: string;
        typeName?: string;
        fitments?: Fitment[];
      }>(request);
      if (!body?.name || !body?.status) {
        return json({ error: "name and status are required" }, 400);
      }
      // Creatable dropdowns: resolve typed/selected names to option ids (creating new ones), and
      // compose a human-readable category (brand · system · part) for the list/search view.
      const brandId = await resolveAttribute(env.DB, "brands", body.brandName);
      const usageId = await resolveAttribute(env.DB, "usage_categories", body.usageName);
      const typeId = await resolveAttribute(env.DB, "product_types", body.typeName);
      const category =
        [body.brandName, body.usageName, body.typeName]
          .map((s) => s?.trim())
          .filter(Boolean)
          .join(" · ") || undefined;
      await updateProduct(env.DB, productById[1]!, {
        name: body.name,
        description: body.description,
        status: body.status,
        shopeeListed: body.shopeeListed,
        shopeeItemId: body.shopeeItemId,
        productRef: body.productRef,
        category,
        weightGrams: body.weightGrams,
        brandId,
        typeId,
        usageId,
      });
      if (typeof body.barcode === "string") {
        const variant = await env.DB.prepare(
          "SELECT id FROM product_variants WHERE product_id = ? ORDER BY created_at LIMIT 1",
        )
          .bind(productById[1]!)
          .first<{ id: string }>();
        if (variant) await setVariantBarcode(env.DB, variant.id, body.barcode);
      }
      if (Array.isArray(body.fitments)) {
        await setProductFitments(env.DB, productById[1]!, body.fitments);
      }
      return json({ ok: true });
    }
    if (productById && request.method === "DELETE") {
      await archiveProduct(env.DB, productById[1]!);
      return json({ ok: true });
    }

    // Gallery: add an image (POST) up to 10, or remove one (DELETE /products/:id/images/:imageId).
    const galleryItem = url.pathname.match(/^\/products\/([^/]+)\/images\/([^/]+)$/);
    if (galleryItem && request.method === "DELETE") {
      await deleteGalleryImage(env.DB, env.IMAGES, galleryItem[1]!, galleryItem[2]!);
      return json({ ok: true });
    }
    const gallery = url.pathname.match(/^\/products\/([^/]+)\/images$/);
    if (gallery && request.method === "POST") {
      const bytes = await request.arrayBuffer();
      try {
        const out = await storeGalleryImage(
          env.DB,
          env.IMAGES,
          gallery[1]!,
          bytes,
          request.headers.get("content-type"),
        );
        return json(out, 201);
      } catch (err) {
        return json({ error: (err as Error).message }, 400);
      }
    }

    if (url.pathname.startsWith("/img/") && request.method === "GET") {
      const key = decodeURIComponent(url.pathname.slice("/img/".length));
      // This route is public (auth-exempt) so <img> tags work. The IMAGES bucket also holds the
      // daily full-DB backup (backups/*.json) — restrict public reads to the image namespaces only,
      // never serve anything else, so a guessable key can't leak the backup or other objects.
      if (!/^(products|shop)\//.test(key)) {
        return new Response("Not found", { status: 404, headers: responseHeaders });
      }
      const obj = await env.IMAGES.get(key);
      if (!obj) return new Response("Not found", { status: 404, headers: responseHeaders });
      return new Response(obj.body, {
        headers: {
          ...responseHeaders,
          "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (url.pathname === "/products" && request.method === "POST") {
      const body = await readJson<Partial<CreateProductInput>>(request);
      if (!body?.productRef || !body?.name) {
        return json({ error: "productRef and name are required" }, 400);
      }
      return json(await createProduct(env.DB, body as CreateProductInput), 201);
    }

    if (url.pathname === "/import/products" && request.method === "POST") {
      const body = await readJson<{ csv?: string; mapping?: Record<string, string> }>(request);
      if (!body) return json({ error: "invalid JSON body" }, 400);
      return json(await importProducts(env.DB, body.csv ?? "", body.mapping ?? {}));
    }

    if (url.pathname === "/orders" && request.method === "GET") {
      return listOrders(env);
    }

    if (url.pathname === "/finance/summary" && request.method === "GET") {
      return financeSummary(env);
    }

    if (url.pathname === "/import/shopee-orders" && request.method === "POST") {
      const body = await readJson<{ csv?: string; mapping?: Record<string, string> }>(request);
      if (!body) return json({ error: "invalid JSON body" }, 400);
      return json(await importShopeeOrders(env.DB, body.csv ?? "", body.mapping ?? {}));
    }

    if (url.pathname === "/import/customers" && request.method === "POST") {
      const body = await readJson<{ csv?: string; mapping?: Record<string, string> }>(request);
      if (!body) return json({ error: "invalid JSON body" }, 400);
      if (!body.mapping?.["license_plate"]) {
        return json({ error: "the license-plate column must be mapped" }, 400);
      }
      return json(await importCustomers(env.DB, body.csv ?? "", body.mapping));
    }

    if (url.pathname === "/import/customer-history" && request.method === "POST") {
      const body = await readJson<{ csv?: string; mapping?: Record<string, string> }>(request);
      if (!body) return json({ error: "invalid JSON body" }, 400);
      const missing = ["license_plate", "happened_at", "description"].find(
        (f) => !body.mapping?.[f],
      );
      if (missing) return json({ error: `the ${missing} column must be mapped` }, 400);
      return json(await importCustomerHistory(env.DB, body.csv ?? "", body.mapping!));
    }

    if (url.pathname === "/sync" && request.method === "POST") {
      const body = await readJson<{ sales?: SyncSale[] }>(request);
      if (!body) return json({ error: "invalid JSON body" }, 400);
      const ledger = env.STOCK_LEDGER.get(env.STOCK_LEDGER.idFromName("default"));
      return json(await ledger.applySync(body.sales ?? []));
    }

    return new Response("Not Found", { status: 404, headers: responseHeaders });
  },

  // Cron (see wrangler.jsonc triggers.crons): daily D1→R2 backup. The Shopee periodic order pull
  // hooks in here once SHOPEE_* creds are configured (gated on managed-seller API eligibility).
  async scheduled(
    controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const key = await runDailyBackup(env, controller.scheduledTime);
    console.log(`backup: wrote ${key}`);
  },
} satisfies ExportedHandler<Env>;

/**
 * Top-level error boundary. Any error that escapes a route (a malformed body, a D1 batch failure, a
 * Durable Object rejection) is turned into a logged JSON 500 with CORS headers — instead of a bare
 * 500 with no body and no server-side log line, which leaves a persistent failure undiagnosable.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await worker.fetch(request, env, ctx);
    } catch (err) {
      const { pathname } = new URL(request.url);
      console.error(`[api] ${request.method} ${pathname} failed:`, err);
      return json({ error: "internal error" }, 500);
    }
  },
  scheduled: worker.scheduled,
} satisfies ExportedHandler<Env>;
