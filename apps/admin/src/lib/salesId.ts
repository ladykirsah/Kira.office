/**
 * Onsite (POS) sales-ID helpers. Format: DAS-YYYY-MM-NNNN
 *   DAS  — Den Air Service
 *   YYYY — 4-digit year, MM — 2-digit month (local time, matching the rest of the app)
 *   NNNN — running number, zero-padded to 4, that RESETS to 0001 each calendar month
 *
 * The POS device mints the next ID at checkout (so it prints on the offline receipt) and syncs it
 * as the canonical onsite_sales.sale_number. Online channels (Shopee) keep their own external id.
 */

const PREFIX = "DAS";

export interface SalesIdParts {
  prefix: string;
  year: number;
  month: number;
  seq: number;
}

const pad = (n: number, width: number): string => String(n).padStart(width, "0");

export function formatSalesId(year: number, month: number, seq: number, prefix = PREFIX): string {
  return `${prefix}-${year}-${pad(month, 2)}-${pad(seq, 4)}`;
}

export function parseSalesId(id: string): SalesIdParts | null {
  const m = /^([A-Za-z]+)-(\d{4})-(\d{2})-(\d+)$/.exec(id);
  if (!m) return null;
  return { prefix: m[1], year: Number(m[2]), month: Number(m[3]), seq: Number(m[4]) };
}

/** The next ID given the last one this device issued (null if none), for the month containing `now`. */
export function nextSalesId(prev: string | null, now: number, prefix = PREFIX): string {
  const d = new Date(now);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const p = prev ? parseSalesId(prev) : null;
  const seq = p && p.year === year && p.month === month ? p.seq + 1 : 1;
  return formatSalesId(year, month, seq, prefix);
}
