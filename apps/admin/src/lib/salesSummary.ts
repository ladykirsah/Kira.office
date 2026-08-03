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

export type RangePreset =
  "all" | "today" | "7d" | "30d" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "custom";

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
    // Orders-style rolling windows, so the Finance date picker matches the Orders page.
    case "all":
      return { startMs: 0, endMs: now };
    case "7d":
      return { startMs: addDays(now, -7), endMs: now };
    case "30d":
      return { startMs: addDays(now, -30), endMs: now };
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
  profitSatang: number;
}

/** Total count + revenue + profit across the product-sales channels — the summary Total row. */
export function totalChannelSales(rows: ChannelSales[]): {
  count: number;
  revenueSatang: number;
  profitSatang: number;
} {
  return rows.reduce(
    (t, r) => ({
      count: t.count + r.count,
      revenueSatang: t.revenueSatang + r.revenueSatang,
      profitSatang: t.profitSatang + r.profitSatang,
    }),
    { count: 0, revenueSatang: 0, profitSatang: 0 },
  );
}

/** The money fields an order row carries; OrderRow (lib/api) is structurally assignable. */
export interface OrderMoney {
  salesSatang?: number | null;
  profitSatang?: number | null;
}

/** Σ sales + Σ profit across order rows (null → 0) — the AirPlus table's Total row. */
export function sumOrderMoney(orders: OrderMoney[]): {
  salesSatang: number;
  profitSatang: number;
} {
  return orders.reduce<{ salesSatang: number; profitSatang: number }>(
    (t, o) => ({
      salesSatang: t.salesSatang + (o.salesSatang ?? 0),
      profitSatang: t.profitSatang + (o.profitSatang ?? 0),
    }),
    { salesSatang: 0, profitSatang: 0 },
  );
}

/** The money fields an on-site sale row carries; SaleRow (lib/api) is structurally assignable. */
export interface SaleMoney {
  grandTotalSatang: number;
  grossProfitSatang: number;
}

/** Σ grandTotal + Σ grossProfit across sale rows — the Den Air Service table's Total row. */
export function sumSaleMoney(sales: SaleMoney[]): { salesSatang: number; profitSatang: number } {
  return sales.reduce<{ salesSatang: number; profitSatang: number }>(
    (t, s) => ({
      salesSatang: t.salesSatang + s.grandTotalSatang,
      profitSatang: t.profitSatang + s.grossProfitSatang,
    }),
    { salesSatang: 0, profitSatang: 0 },
  );
}

/** A logged expense (money out) tagged to a channel; ExpenseRow (lib/api) is structurally assignable. */
export interface ExpenseLike {
  channel: string;
  amountSatang: number;
  occurredAt: number;
}

/** A channel's expenses whose date falls in [startMs, endMs) — the rows its table shows this period. */
export function expensesInRange<T extends ExpenseLike>(
  expenses: T[],
  channel: string,
  range: Range,
): T[] {
  return expenses.filter(
    (e) => e.channel === channel && e.occurredAt >= range.startMs && e.occurredAt < range.endMs,
  );
}

/** Σ amount (satang) of a channel's in-range expenses — subtracted from that channel's Profit. */
export function sumExpensesForChannel(
  expenses: ExpenseLike[],
  channel: string,
  range: Range,
): number {
  return expensesInRange(expenses, channel, range).reduce((s, e) => s + e.amountSatang, 0);
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
  saleType?: string | null; // "parts" (Products) | "repair" (Service)
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
 * The Onsite table/info/CSV view: free-text search + a direct status filter ("" = all). Drives the
 * cards, the table, and the CSV export together.
 */
export function salesView<T extends SaleSearchable>(
  sales: T[],
  opts: { search: string; status: string; type?: string },
): T[] {
  return sales.filter(
    (s) =>
      matchesSalesSearch(s, opts.search) &&
      (opts.status === "" || s.saleStatus === opts.status) &&
      (!opts.type || s.saleType === opts.type),
  );
}

/** Fields the online-orders table searches over. */
export interface OrderSearchable {
  externalOrderId: string;
  orderStatus: string | null;
  paymentStatus: string | null;
  grandTotalSatang: number;
}

/** True if the query appears in the order id, status, payment, or paid amount (baht). Empty = all. */
export function matchesOrderSearch(order: OrderSearchable, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const baht = (order.grandTotalSatang / 100).toFixed(2);
  return [order.externalOrderId, order.orderStatus, order.paymentStatus, baht]
    .filter((f): f is string => Boolean(f))
    .some((f) => f.toLowerCase().includes(q));
}

/** The online-orders view: free-text search + a direct order-status filter ("" = all). */
export function ordersView<T extends OrderSearchable>(
  orders: T[],
  opts: { search: string; status: string },
): T[] {
  return orders.filter(
    (o) =>
      matchesOrderSearch(o, opts.search) && (opts.status === "" || o.orderStatus === opts.status),
  );
}

/**
 * Period-over-period growth %, e.g. this-period revenue vs the previous equal-length period.
 * Returns null when there is no baseline (previous 0 but current > 0) so the UI can show "—".
 */
export function growthRatePct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
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
