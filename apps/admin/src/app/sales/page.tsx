"use client";

import { useEffect, useState } from "react";
import {
  fetchSales,
  fetchOrders,
  fetchExpenses,
  createExpense,
  type SaleRow,
  type OrderRow,
  type ExpenseRow,
} from "@/lib/api";
import { operationalStatus } from "@l-shopee/core";
import { formatBahtTrim } from "@/lib/format";
import { inputS } from "@/lib/inputStyles";
import {
  rangeFor,
  summarize,
  totalChannelSales,
  toDateInputValue,
  salesView,
  ordersView,
  growthRatePct,
  expensesInRange,
  sumExpensesForChannel,
  type RangePreset,
  type ChannelSales,
} from "@/lib/salesSummary";
import { PageHeader } from "../PageHeader";
import { NoAccess } from "../NoAccess";
import { useStaffRole } from "../StaffRoleProvider";
import { canViewFinance } from "@l-shopee/core";
import { SalesTable } from "./SalesTable";
import { AirPlusOrders } from "./AirPlusOrders";
import { ExpenseForm } from "./ExpenseForm";

// Matches the Orders page's date picker (owner request), minus the week presets.
const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "custom", label: "Custom..." },
];

const card = {
  // Grow to share the row's full width equally; minWidth 150 keeps them from getting too narrow
  // (they wrap to the next line instead), so a row of cards fills the page rather than sitting small.
  flex: 1,
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "14px 18px",
  minWidth: 150,
  background: "var(--surface)",
} as const;

const right = { textAlign: "right" } as const;

type SalesTab = "summary" | "onsite" | "airplus";

const DAY_MS = 24 * 60 * 60 * 1000;

/** An order's effective sale date: when it was placed, falling back to when it was imported. */
const orderDate = (o: OrderRow) => o.orderCreatedAt ?? o.importedAt;

// Only orders where money has actually moved belong on the finance view (owner): a completed sale
// (money in), a refund (money out), and the two claim resolutions. Anything mid-flight — to ship,
// in transit, pending, cancelled — is not yet a financial event, so it never lands here.
const FINANCE_ORDER_STATUSES = new Set(["complete", "refunded", "claimed", "claim_rejected"]);
const isFinanceOrder = (o: OrderRow): boolean => {
  const st = operationalStatus(o.orderStatus, o.paymentStatus);
  return st != null && FINANCE_ORDER_STATUSES.has(st);
};

export default function SalesPage() {
  const role = useStaffRole();
  const [sales, setSales] = useState<SaleRow[] | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [tab, setTab] = useState<SalesTab>("summary");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    fetchSales()
      .then(setSales)
      .catch((err) => setError((err as Error).message));
    fetchOrders()
      .then(setOrders)
      .catch((err) => setError((err as Error).message));
    fetchExpenses()
      .then(setExpenses)
      .catch((err) => setError((err as Error).message));
  }, []);

  // Filters are per-tab; reset search/type on tab switch (the period persists).
  useEffect(() => {
    setSearch("");
    setTypeFilter("");
  }, [tab]);

  // After the hooks, before anything that renders money. The menu already hides Finance from an
  // admin and a mechanic; this catches a typed address or an old bookmark, so they get a plain
  // answer instead of a page full of failed requests. The API refuses the data regardless.
  if (!role || !canViewFinance(role)) return <NoAccess what="Finance" />;

  if (error) {
    return (
      <main>
        <h1>Finance</h1>
        <p style={{ color: "var(--danger)" }}>Could not load sales: {error}</p>
      </main>
    );
  }

  const range = rangeFor(preset, Date.now(), { start: customStart, end: customEnd });
  // Date inputs always reflect the effective range (endMs is exclusive, so show the last included
  // day); editing one switches to a custom range, seeding the other end if it was empty.
  const fromDisplay = toDateInputValue(range.startMs);
  const toDisplay = toDateInputValue(range.endMs - DAY_MS);
  const editFrom = (v: string) => {
    setCustomStart(v);
    setCustomEnd(customEnd || toDisplay);
    setPreset("custom");
  };
  const editTo = (v: string) => {
    setCustomEnd(v);
    setCustomStart(customStart || fromDisplay);
    setPreset("custom");
  };

  const inRange = (sales ?? []).filter(
    (s) => s.createdAt >= range.startMs && s.createdAt < range.endMs,
  );
  const s = summarize(inRange, range);

  // Expenses (money out) tagged to a channel: folded into net Profit and shown as rows in the
  // channel's table. Not search/type filtered — an expense isn't a sale.
  const onsiteExpenses = expensesInRange(expenses, "onsite", range);
  const airplusExpenses = expensesInRange(expenses, "airplus", range);
  const onsiteExpenseSatang = sumExpensesForChannel(expenses, "onsite", range);
  const airplusExpenseSatang = sumExpensesForChannel(expenses, "airplus", range);

  // Keep the local expenses list in sync after an inline edit / delete (no re-fetch needed).
  const onExpenseEdited = (e: ExpenseRow) =>
    setExpenses((prev) => prev.map((x) => (x.id === e.id ? e : x)));
  const onExpenseDeleted = (id: string) => setExpenses((prev) => prev.filter((x) => x.id !== id));

  // Onsite table/info view: period → search + type filter. Feeds the cards + table.
  const onsiteView = salesView(inRange, { search, status: "", type: typeFilter });
  const onsiteSumm = summarize(onsiteView, range);

  // Growth rate: this period's revenue vs the previous equal-length period (same search/filter).
  const prevRange = {
    startMs: range.startMs - (range.endMs - range.startMs),
    endMs: range.startMs,
  };
  const prevView = salesView(
    (sales ?? []).filter((x) => x.createdAt >= prevRange.startMs && x.createdAt < prevRange.endMs),
    { search, status: "", type: typeFilter },
  );
  const onsiteGrowth = growthRatePct(
    onsiteSumm.revenueSatang,
    summarize(prevView, prevRange).revenueSatang,
  );
  // Format any growth %: no "+"; negatives shown accounting-style, e.g. -5% → "(5%)".
  const fmtGrowth = (pct: number | null) =>
    pct === null
      ? "—"
      : Math.round(pct) < 0
        ? `(${Math.abs(Math.round(pct))}%)`
        : `${Math.round(pct)}%`;

  // AirPlus tab (own single-seller site: no commission, Sales = payout, real profit).
  const airplusInRange = (orders ?? []).filter(
    (o) =>
      o.channel === "airplus" &&
      isFinanceOrder(o) &&
      orderDate(o) >= range.startMs &&
      orderDate(o) < range.endMs,
  );
  const airplusRangeSales = airplusInRange.reduce((sum, o) => sum + (o.salesSatang ?? 0), 0);
  const airplusRangeProfit = airplusInRange.reduce((sum, o) => sum + (o.profitSatang ?? 0), 0);
  const airplusView = ordersView(airplusInRange, { search, status: "" });
  const airplusSales = airplusView.reduce((sum, o) => sum + (o.salesSatang ?? 0), 0);
  const airplusProfit = airplusView.reduce((sum, o) => sum + (o.profitSatang ?? 0), 0);
  // AirPlus growth: this period's revenue vs the previous equal-length period, same filter.
  const airplusPrevInRange = (orders ?? []).filter(
    (o) =>
      o.channel === "airplus" &&
      isFinanceOrder(o) &&
      orderDate(o) >= prevRange.startMs &&
      orderDate(o) < prevRange.endMs,
  );
  const airplusPrevView = ordersView(airplusPrevInRange, { search, status: "" });
  const airplusGrowth = growthRatePct(
    airplusSales,
    airplusPrevView.reduce((sum, o) => sum + (o.salesSatang ?? 0), 0),
  );

  // Group 1 — product sales across channels (roll-up shown in the summary table).
  const channelRows: ChannelSales[] = [
    {
      key: "onsite",
      label: "Den Air Service",
      count: s.salesCount,
      revenueSatang: s.revenueSatang,
      profitSatang: s.grossProfitSatang - onsiteExpenseSatang,
    },
    {
      key: "airplus",
      label: "AirPlus",
      count: airplusInRange.length,
      revenueSatang: airplusRangeSales,
      profitSatang: airplusRangeProfit - airplusExpenseSatang,
    },
  ];
  const channelTotal = totalChannelSales(channelRows);

  // Summary combines both shops (no per-shop filter here). Profit = onsite gross profit + AirPlus
  // profit; growth = combined revenue vs the previous equal-length period.
  const summaryProfit =
    s.grossProfitSatang + airplusRangeProfit - onsiteExpenseSatang - airplusExpenseSatang;
  const onsitePrevRevenue = summarize(
    (sales ?? []).filter((x) => x.createdAt >= prevRange.startMs && x.createdAt < prevRange.endMs),
    prevRange,
  ).revenueSatang;
  const airplusPrevRevenue = airplusPrevInRange.reduce((sum, o) => sum + (o.salesSatang ?? 0), 0);
  const summaryGrowth = growthRatePct(
    channelTotal.revenueSatang,
    onsitePrevRevenue + airplusPrevRevenue,
  );

  const Card = ({ label, value }: { label: string; value: string }) => (
    <div style={card}>
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );

  const TabBtn = ({ id, label }: { id: SalesTab; label: string }) => (
    <button className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
      {label}
    </button>
  );

  const cardsRow = { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 } as const;
  const frameStyle = {
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 18,
    background: "var(--surface)",
  } as const;
  const toolbarStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    marginBottom: 12,
  } as const;

  // The framed toolbar shared by every tab: optional search + status + type, always a date range.
  // A plain function (not a component) so its inputs keep focus while typing.
  const toolbar = (opts: { searchPlaceholder?: string; showType?: boolean }) => (
    <>
      <div style={toolbarStyle}>
        {opts.searchPlaceholder && (
          <input
            className="tbar-input"
            placeholder={opts.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputS, width: 240, maxWidth: "100%", color: "var(--text)" }}
          />
        )}
        {opts.showType && (
          <select
            aria-label="Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ ...inputS, color: typeFilter ? "var(--text)" : "var(--text-faint)" }}
          >
            <option value="">All types</option>
            <option value="parts">Products</option>
            <option value="repair">Service</option>
          </select>
        )}
        <select
          aria-label="Date range"
          value={preset}
          onChange={(e) => setPreset(e.target.value as RangePreset)}
          style={inputS}
        >
          {PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {preset === "custom" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <input
            type="date"
            value={fromDisplay}
            onChange={(e) => editFrom(e.target.value)}
            aria-label="From date"
            style={inputS}
          />
          <span className="muted">–</span>
          <input
            type="date"
            value={toDisplay}
            onChange={(e) => editTo(e.target.value)}
            aria-label="To date"
            style={inputS}
          />
        </div>
      )}
    </>
  );

  return (
    <main>
      <PageHeader title="Finance" subtitle="Product sales by channel." />

      <div className="tabs">
        <TabBtn id="summary" label={`Summary (${channelTotal.count})`} />
        <TabBtn id="onsite" label={`Den Air Service (${s.salesCount})`} />
        <TabBtn id="airplus" label={`AirPlus (${airplusInRange.length})`} />
      </div>

      {sales === null ? (
        <div className="skeleton skeleton-row" style={{ width: "60%" }} />
      ) : (
        <>
          {tab === "summary" && (
            <>
              <div style={cardsRow}>
                <Card label="Revenue" value={formatBahtTrim(channelTotal.revenueSatang)} />
                <Card label="Conversions" value={String(channelTotal.count)} />
                <Card label="Profit" value={formatBahtTrim(summaryProfit)} />
                <Card label="Growth rate" value={fmtGrowth(summaryGrowth)} />
              </div>
              <div style={frameStyle}>
                {toolbar({})}
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Channel</th>
                        <th style={right}>Conversions</th>
                        <th style={right}>Revenue</th>
                        <th style={right}>Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channelRows.map((r) => (
                        <tr key={r.key}>
                          <td>{r.label}</td>
                          <td style={right}>{r.count}</td>
                          <td style={right}>{formatBahtTrim(r.revenueSatang)}</td>
                          <td style={right}>{formatBahtTrim(r.profitSatang)}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 600 }}>
                        <td>Total</td>
                        <td style={right}>{channelTotal.count}</td>
                        <td style={right}>{formatBahtTrim(channelTotal.revenueSatang)}</td>
                        <td style={right}>{formatBahtTrim(channelTotal.profitSatang)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Record an expense (money out) — channel-first; on submit it lands in that channel's
                  table and lowers its net Profit above. Placed under the summary table (owner). */}
              <ExpenseForm
                onSubmit={async (input) => {
                  const created = await createExpense(input);
                  setExpenses((prev) => [created, ...prev]);
                }}
              />
            </>
          )}

          {tab === "onsite" && (
            <>
              {/* Cards reflect the filtered view */}
              <div style={cardsRow}>
                <Card label="Revenue" value={formatBahtTrim(onsiteSumm.revenueSatang)} />
                <Card label="Conversions" value={String(onsiteSumm.salesCount)} />
                <Card
                  label="Profit"
                  value={formatBahtTrim(onsiteSumm.grossProfitSatang - onsiteExpenseSatang)}
                />
                <Card label="Growth rate" value={fmtGrowth(onsiteGrowth)} />
              </div>
              <div style={frameStyle}>
                {toolbar({
                  searchPlaceholder: "Search plate / car / bill / amount…",
                  showType: true,
                })}
                <SalesTable
                  sales={onsiteView}
                  expenses={onsiteExpenses}
                  onExpenseEdited={onExpenseEdited}
                  onExpenseDeleted={onExpenseDeleted}
                />
              </div>
            </>
          )}

          {tab === "airplus" && (
            <>
              <div style={cardsRow}>
                <Card label="Revenue" value={formatBahtTrim(airplusSales)} />
                <Card label="Conversions" value={String(airplusView.length)} />
                <Card label="Profit" value={formatBahtTrim(airplusProfit - airplusExpenseSatang)} />
                <Card label="Growth rate" value={fmtGrowth(airplusGrowth)} />
              </div>
              <div style={frameStyle}>
                {toolbar({
                  searchPlaceholder: "Search order / status / amount…",
                })}
                <AirPlusOrders
                  orders={airplusView}
                  expenses={airplusExpenses}
                  onExpenseEdited={onExpenseEdited}
                  onExpenseDeleted={onExpenseDeleted}
                />
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
