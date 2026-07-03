/**
 * Sales-summary helpers for the Sales dashboard (formerly the standalone Finance page).
 *
 * The 5 summary cards are computed client-side from the sales list — every field a sale row
 * carries (createdAt, grandTotalSatang, taxTotalSatang, grossProfitSatang, saleStatus) is enough
 * to reproduce the API's /finance/summary exactly:
 *   - completed sales → revenue (Σ grandTotal), VAT (Σ taxTotal), profit (Σ grossProfit), count
 *   - refunded sales  → refundCount, refundedSatang (Σ grandTotal; a refund reverses the full total)
 *
 * Date math is in the viewer's local time, matching formatUpdatedAt (a Bangkok shopkeeper's browser
 * is in Bangkok). Ranges are half-open [startMs, endMs); a refunded sale is counted in the period it
 * was sold, since createdAt is the only timestamp on the row.
 */

export type RangePreset = "today" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "custom";

/** The minimal shape summarize() needs; SaleRow (lib/api) is structurally assignable. */
export interface SaleLike {
  createdAt: number;
  grandTotalSatang: number;
  taxTotalSatang: number;
  grossProfitSatang: number;
  saleStatus: string;
}

/** Half-open millisecond window [startMs, endMs). */
export interface Range {
  startMs: number;
  endMs: number;
}

export interface SalesSummary {
  salesCount: number;
  revenueSatang: number;
  vatSatang: number;
  grossProfitSatang: number;
  refundCount: number;
  refundedSatang: number;
}

const startOfDay = (t: number): number => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const addDays = (t: number, n: number): number => {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
};

/** Sunday-anchored (Thai calendar) start of the week containing t, at local midnight. */
const startOfWeek = (t: number): number => {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() - d.getDay()); // getDay(): 0 = Sunday
  return d.getTime();
};

const startOfMonth = (t: number): number => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};

/** Parse "YYYY-MM-DD" as a local calendar date; null if empty/malformed. */
const parseLocalDate = (s?: string): number | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
};

export function rangeFor(
  preset: RangePreset,
  now: number,
  custom?: { start?: string; end?: string },
): Range {
  switch (preset) {
    case "today": {
      const s = startOfDay(now);
      return { startMs: s, endMs: addDays(s, 1) };
    }
    case "thisWeek": {
      const s = startOfWeek(now);
      return { startMs: s, endMs: addDays(s, 7) };
    }
    case "lastWeek": {
      const thisWeek = startOfWeek(now);
      return { startMs: addDays(thisWeek, -7), endMs: thisWeek };
    }
    case "thisMonth": {
      const d = new Date(now);
      return {
        startMs: startOfMonth(now),
        endMs: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
      };
    }
    case "lastMonth": {
      const d = new Date(now);
      return {
        startMs: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(),
        endMs: startOfMonth(now),
      };
    }
    case "custom": {
      const start = parseLocalDate(custom?.start);
      const end = parseLocalDate(custom?.end);
      return {
        startMs: start ?? startOfDay(now),
        endMs: end != null ? addDays(end, 1) : addDays(startOfDay(now), 1),
      };
    }
  }
}

/** One row of the product-sales summary table (one per channel). */
export interface ChannelSales {
  key: string;
  label: string;
  count: number;
  revenueSatang: number;
}

/** Total count + revenue across the product-sales channels — the summary table's Total row. */
export function totalChannelSales(rows: ChannelSales[]): { count: number; revenueSatang: number } {
  return rows.reduce(
    (t, r) => ({ count: t.count + r.count, revenueSatang: t.revenueSatang + r.revenueSatang }),
    { count: 0, revenueSatang: 0 },
  );
}

/** Local YYYY-MM-DD for a timestamp — the value shape an <input type="date"> expects. */
export function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Fields the Onsite table searches over. */
export interface SaleSearchable {
  saleNumber: string | null;
  vehicle: string | null;
  licensePlate: string | null;
  grandTotalSatang: number;
  saleStatus: string;
}

/** True if the query appears in the bill ID, car model, plate, or paid amount (baht). Empty = all. */
export function matchesSalesSearch(sale: SaleSearchable, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const baht = (sale.grandTotalSatang / 100).toFixed(2);
  return [sale.saleNumber, sale.vehicle, sale.licensePlate, baht]
    .filter((f): f is string => Boolean(f))
    .some((f) => f.toLowerCase().includes(q));
}

/**
 * The Onsite table/info/CSV view: free-text search, then (when sorting by Status) an optional status
 * filter, then sort by status. Mirrors the Products toolbar's linked sort+filter.
 */
export function salesView<T extends SaleSearchable>(
  sales: T[],
  opts: { search: string; sortBy: string; filterVal: string },
): T[] {
  let out = sales.filter((s) => matchesSalesSearch(s, opts.search));
  if (opts.sortBy === "status") {
    if (opts.filterVal) out = out.filter((s) => s.saleStatus === opts.filterVal);
    out = [...out].sort((a, b) => a.saleStatus.localeCompare(b.saleStatus));
  }
  return out;
}

export function summarize(sales: SaleLike[], range: Range): SalesSummary {
  const out: SalesSummary = {
    salesCount: 0,
    revenueSatang: 0,
    vatSatang: 0,
    grossProfitSatang: 0,
    refundCount: 0,
    refundedSatang: 0,
  };
  for (const s of sales) {
    if (s.createdAt < range.startMs || s.createdAt >= range.endMs) continue;
    if (s.saleStatus === "refunded") {
      out.refundCount += 1;
      out.refundedSatang += s.grandTotalSatang;
    } else if (s.saleStatus === "completed") {
      out.salesCount += 1;
      out.revenueSatang += s.grandTotalSatang;
      out.vatSatang += s.taxTotalSatang;
      out.grossProfitSatang += s.grossProfitSatang;
    }
  }
  return out;
}
