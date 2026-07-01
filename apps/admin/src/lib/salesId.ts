/**
 * Onsite (POS) sales-ID helpers. Format: DASyyyymm-ddnnn   (e.g. DAS202607-01001)
 *   DAS       — Den Air Service
 *   yyyy mm   — 4-digit year + 2-digit month (local time, matching the rest of the app)
 *   dd        — 2-digit day of month
 *   nnn       — running number, zero-padded to 3, that RESETS to 001 each day
 *
 * The POS device mints the next ID at checkout (so it prints on the offline receipt) and syncs it
 * as the canonical onsite_sales.sale_number. Online channels (Shopee) keep their own external id.
 */

const PREFIX = "DAS";

export interface SalesIdParts {
  prefix: string;
  year: number;
  month: number;
  day: number;
  seq: number;
}

const pad = (n: number, width: number): string => String(n).padStart(width, "0");

export function formatSalesId(
  year: number,
  month: number,
  day: number,
  seq: number,
  prefix = PREFIX,
): string {
  return `${prefix}${year}${pad(month, 2)}-${pad(day, 2)}${pad(seq, 3)}`;
}

export function parseSalesId(id: string): SalesIdParts | null {
  const m = /^([A-Za-z]+)(\d{4})(\d{2})-(\d{2})(\d+)$/.exec(id);
  if (!m) return null;
  return {
    prefix: m[1],
    year: Number(m[2]),
    month: Number(m[3]),
    day: Number(m[4]),
    seq: Number(m[5]),
  };
}

/** The next ID given the last one this device issued (null if none), for the day containing `now`. */
export function nextSalesId(prev: string | null, now: number, prefix = PREFIX): string {
  const d = new Date(now);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const p = prev ? parseSalesId(prev) : null;
  const sameDay = p && p.year === year && p.month === month && p.day === day;
  const seq = sameDay ? p.seq + 1 : 1;
  return formatSalesId(year, month, day, seq, prefix);
}

/**
 * The highest-numbered id issued for the day containing `now`, or null if none match — used to seed
 * a fresh POS device's counter from the server's history so it continues past backfilled numbers.
 */
export function latestSalesIdForDay(
  ids: readonly (string | null | undefined)[],
  now: number,
): string | null {
  const d = new Date(now);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  let best: { id: string; seq: number } | null = null;
  for (const id of ids) {
    if (!id) continue;
    const p = parseSalesId(id);
    if (!p || p.year !== year || p.month !== month || p.day !== day) continue;
    if (!best || p.seq > best.seq) best = { id, seq: p.seq };
  }
  return best ? best.id : null;
}
