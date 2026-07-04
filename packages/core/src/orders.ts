/**
 * Shopee order-import core (CSV bridge before the live API). Pure functions only.
 *
 * `parseCsv` tokenizes Seller Centre CSV exports; `dedupeOrders` enforces the same uniqueness as the
 * D1 constraint `(channel, external_order_id)`, so re-importing the same file never creates duplicate
 * orders. Both are wrapped by the import endpoint / queue consumer.
 */
import type { Partition } from "./sync";

/** Minimal RFC-4180-style CSV parser: quoted fields, doubled-quote escapes, CRLF or LF rows. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface ImportableOrder {
  channel: string;
  externalOrderId: string;
}

/** @deprecated alias of {@link Partition}. */
export type OrderPartition<T> = Partition<T>;

/** Stable key matching the D1 unique index on (channel, external_order_id). */
export function orderKey(order: ImportableOrder): string {
  // Separate with NUL, which never appears in channel names or order ids, so keys cannot collide.
  return order.channel + String.fromCharCode(0) + order.externalOrderId;
}

/** A single product line on a marketplace order (one row per item in the order export). */
export interface ShopeeOrderLine {
  externalOrderId: string;
  productName: string;
  variationName: string;
  /** SKU Reference No. — the variation-level code (may be blank). */
  externalSku: string;
  /** Parent SKU — the listing-level code, used as a fallback when the variation SKU is blank. */
  parentSku: string;
  quantity: number;
}

export interface StockDeduction {
  variantId: string;
  quantity: number;
}

/** Canonical form for SKU comparison: trimmed + uppercased, so manual entry variance still matches. */
export function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
}

/**
 * Resolve an order line to a Kira variant id via its variation SKU, falling back to the Parent SKU
 * when the variation SKU is blank. `variantBySku` must be keyed by {@link normalizeSku}. Returns null
 * when neither code matches — the caller flags the line rather than guessing.
 */
export function matchLineVariant(
  line: { externalSku: string; parentSku: string },
  variantBySku: Map<string, string>,
): string | null {
  const lookup = (raw: string): string | null => {
    const key = normalizeSku(raw);
    return key ? (variantBySku.get(key) ?? null) : null;
  };
  return lookup(line.externalSku) ?? lookup(line.parentSku);
}

/**
 * Split order lines into stock deductions (matched to a variant, positive quantity) and an unmatched
 * remainder. Unmatched lines are never deducted — they are surfaced for the operator to resolve.
 */
export function planOnlineDeductions(
  lines: ShopeeOrderLine[],
  variantBySku: Map<string, string>,
): { deductions: StockDeduction[]; unmatched: ShopeeOrderLine[] } {
  const deductions: StockDeduction[] = [];
  const unmatched: ShopeeOrderLine[] = [];
  for (const line of lines) {
    const variantId = matchLineVariant(line, variantBySku);
    if (variantId && line.quantity > 0) {
      deductions.push({ variantId, quantity: line.quantity });
    } else {
      unmatched.push(line);
    }
  }
  return { deductions, unmatched };
}

/**
 * Split `incoming` into fresh vs duplicate by (channel, external_order_id), counting both
 * already-imported keys and repeats within this batch as duplicates. Order is preserved.
 */
export function dedupeOrders<T extends ImportableOrder>(
  existingKeys: Iterable<string>,
  incoming: T[],
): Partition<T> {
  const seen = new Set(existingKeys);
  const fresh: T[] = [];
  const duplicates: T[] = [];
  for (const order of incoming) {
    const key = orderKey(order);
    if (seen.has(key)) {
      duplicates.push(order);
    } else {
      seen.add(key);
      fresh.push(order);
    }
  }
  return { fresh, duplicates };
}
