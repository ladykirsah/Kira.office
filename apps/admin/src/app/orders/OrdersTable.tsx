"use client";

import { useState } from "react";
import type { OrderRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { operationalStatusBadge, paymentStatusBadge } from "@/lib/badges";
import { tableText } from "@/lib/tableText";
import { inputS } from "@/lib/inputStyles";
import { dateRange, type DatePreset } from "@/lib/dateRange";
import { OPERATIONAL_STATUSES, operationalStatus, operationalStatusLabel } from "@l-shopee/core";
import { OrderActionsMenu } from "./OrderActionsMenu";

type Tab = "all" | "unpaid" | "toship" | "shipped" | "completed" | "unfinished";
type SummaryFilter = "cod" | "toship" | "shipped" | "returns" | null;

function orderDate(o: OrderRow): number {
  return o.orderCreatedAt ?? o.importedAt;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} · ${hh}:${min}`;
}

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

const summaryCard = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "12px 14px",
  cursor: "pointer",
  transition: "border-color 0.15s",
} as const;

const summaryCardActive = {
  ...summaryCard,
  borderColor: "var(--primary)",
  background: "var(--primary-faint)",
} as const;

const summaryLabel = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
} as const;

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>(null);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [filterVal, setFilterVal] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const now = Date.now();
  const airplus = orders.filter((o) => o.channel === "airplus");

  // Summary counts (all-time, not affected by date/tab). Same derived status as the column and the
  // tabs — the Returns card used to look for cancelled+refunded, which is not what a return is and
  // would have missed every real one.
  const countOf = (...want: string[]) =>
    airplus.filter((o) => {
      const s = operationalStatus(o.orderStatus, o.paymentStatus);
      return s != null && want.includes(s);
    }).length;

  const codApproval = countOf("cod_pending");
  const toBeShipped = countOf("to_ship");
  const inTransit = countOf("in_transit");
  const returns = countOf("return");

  // Date filter
  const { start: rangeStart, end: rangeEnd } = dateRange(datePreset, now, customFrom, customTo);
  const dateFiltered = airplus.filter((o) => {
    const t = orderDate(o);
    return t >= rangeStart && t <= rangeEnd;
  });

  // Tab filter, keyed off the SAME derived status the Status column shows. Previously each tab
  // repeated its own multi-condition predicate, which meant a new order_status (delivery_failed,
  // returned) showed as Fail/Return in the column while the Unfinished tab silently ignored it and
  // under-counted. One source of truth removes that whole class of drift.
  const filterByTab = (list: OrderRow[], t: Tab) => {
    const is = (o: OrderRow, ...want: string[]) => {
      const s = operationalStatus(o.orderStatus, o.paymentStatus);
      return s != null && want.includes(s);
    };
    switch (t) {
      case "unpaid":
        return list.filter((o) => is(o, "unpaid"));
      case "toship":
        return list.filter((o) => is(o, "to_ship"));
      case "shipped":
        return list.filter((o) => is(o, "in_transit"));
      case "completed":
        return list.filter((o) => is(o, "complete"));
      case "unfinished":
        // Everything that ended badly: cancel, COD denied, payment expired, failed delivery — plus
        // returns and claims.
        return list.filter((o) => is(o, "fail", "return"));
      default:
        return list;
    }
  };

  // Summary card filter (overrides tab when active). Each card maps to one operational status, so
  // clicking a card cannot show a different set from the number printed on it.
  const CARD_STATUS: Record<Exclude<SummaryFilter, null>, string> = {
    cod: "cod_pending",
    toship: "to_ship",
    shipped: "in_transit",
    returns: "return",
  };
  const bySummary = (list: OrderRow[]) => {
    if (!summaryFilter) return list;
    const want = CARD_STATUS[summaryFilter];
    return list.filter((o) => operationalStatus(o.orderStatus, o.paymentStatus) === want);
  };

  let view = summaryFilter ? bySummary(dateFiltered) : filterByTab(dateFiltered, tab);

  // Search
  const s = q.trim().toLowerCase();
  if (s) {
    view = view.filter(
      (o) =>
        o.externalOrderId.toLowerCase().includes(s) ||
        (o.buyerUsername ?? "").toLowerCase().includes(s),
    );
  }

  // Sort
  if (sortBy === "status") {
    view = [...view].sort((a, b) => (a.orderStatus ?? "").localeCompare(b.orderStatus ?? ""));
  } else if (sortBy === "payment") {
    view = [...view].sort((a, b) => (a.paymentStatus ?? "").localeCompare(b.paymentStatus ?? ""));
  }

  // Filter dropdown. Status options are the seven operational states, so match on the DERIVED value
  // — comparing against o.orderStatus would never hit "unpaid" or "cod_pending", which are not
  // order_status values at all.
  if (filterVal) {
    view = view.filter(
      (o) =>
        operationalStatus(o.orderStatus, o.paymentStatus) === filterVal ||
        o.paymentStatus === filterVal,
    );
  }

  // Tab counts (date-filtered)
  const tabCount = (t: Tab) => filterByTab(dateFiltered, t).length;

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button
      className={tab === id && !summaryFilter ? "tab active" : "tab"}
      onClick={() => {
        setTab(id);
        setSummaryFilter(null);
      }}
    >
      {label} ({tabCount(id)})
    </button>
  );

  const toggleSummary = (key: SummaryFilter) => {
    if (summaryFilter === key) {
      setSummaryFilter(null);
    } else {
      setSummaryFilter(key);
    }
  };

  const SCard = ({
    label,
    value,
    color,
    filterKey,
  }: {
    label: string;
    value: number;
    color: string;
    filterKey: SummaryFilter;
  }) => (
    <div
      style={summaryFilter === filterKey ? summaryCardActive : summaryCard}
      onClick={() => toggleSummary(filterKey)}
    >
      <div style={summaryLabel}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color }}>{value}</div>
    </div>
  );

  return (
    <>
      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <SCard
          label="COD approval"
          value={codApproval}
          color={codApproval > 0 ? "var(--warn)" : "var(--text-faint)"}
          filterKey="cod"
        />
        <SCard
          label="To be shipped"
          value={toBeShipped}
          color={toBeShipped > 0 ? "#2563eb" : "var(--text-faint)"}
          filterKey="toship"
        />
        <SCard
          label="In transit"
          value={inTransit}
          color={inTransit > 0 ? "#2563eb" : "var(--text-faint)"}
          filterKey="shipped"
        />
        <SCard
          label="Returns"
          value={returns}
          color={returns > 0 ? "var(--danger)" : "var(--text-faint)"}
          filterKey="returns"
        />
      </div>

      {/* Tabs — same as ProductsTable */}
      <div className="tabs">
        <TabBtn id="all" label="All" />
        <TabBtn id="unpaid" label="Unpaid" />
        <TabBtn id="toship" label="To ship" />
        {/* Label matches the Status pill and the summary card; the `shipped` id stays internal. */}
        <TabBtn id="shipped" label="In transit" />
        <TabBtn id="completed" label="Completed" />
        <TabBtn id="unfinished" label="Unfinished" />
      </div>

      {/* Frame — same as ProductsTable */}
      <div style={frameStyle}>
        <div style={toolbarStyle}>
          <input
            className="tbar-input"
            placeholder="Search order ID, name, phone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              ...inputS,
              width: 240,
              maxWidth: "100%",
              color: "var(--text)",
              fontWeight: 500,
            }}
          />
          <select
            aria-label="Sort by"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              if (!e.target.value) setFilterVal("");
            }}
            style={{
              ...inputS,
              color: sortBy ? "var(--text)" : "var(--text-faint)",
              fontWeight: sortBy ? 500 : 400,
            }}
          >
            <option value="">Sort by...</option>
            <option value="status">Status</option>
            <option value="payment">Payment</option>
          </select>
          {sortBy && (
            <select
              aria-label="Filter"
              value={filterVal}
              onChange={(e) => setFilterVal(e.target.value)}
              style={{
                ...inputS,
                color: filterVal ? "var(--text)" : "var(--text-faint)",
                fontWeight: filterVal ? 500 : 400,
              }}
            >
              <option value="">Filter...</option>
              {/* Offer the same seven the Status column shows — filtering by a raw order_status the
                  column never displays would be filtering by an invisible field. */}
              <optgroup label="Status">
                {OPERATIONAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {operationalStatusLabel(s)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Payment">
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="cod">COD</option>
                <option value="cod_confirmed">COD Approved</option>
                <option value="cod_collected">COD Collected</option>
                <option value="cod_denied">COD Denied</option>
                <option value="refunded">Refunded</option>
              </optgroup>
            </select>
          )}
          <select
            aria-label="Date range"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            style={{
              ...inputS,
              color: datePreset !== "all" ? "var(--text)" : "var(--text-faint)",
              fontWeight: datePreset !== "all" ? 500 : 400,
            }}
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
            <option value="lastmonth">Last month</option>
            <option value="custom">Custom...</option>
          </select>
        </div>
        {datePreset === "custom" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
              From
            </label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={inputS}
            />
            <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>To</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={inputS}
            />
          </div>
        )}

        {view.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🧾</div>
            {airplus.length === 0 ? "No AirPlus orders yet." : "No orders match."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th align="left">Action</th>
                </tr>
              </thead>
              <tbody>
                {view.map((o) => {
                  // Status shows the owner's seven operational states, which need BOTH axes: a
                  // new+pending order waits on the customer, new+cod waits on the owner's COD
                  // approval, and both have order_status 'new'.
                  const osBadge = operationalStatusBadge(o.orderStatus, o.paymentStatus);
                  const psBadge = paymentStatusBadge(o.paymentStatus);
                  return (
                    <tr key={o.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700, ...tableText.body2 }}>
                          {o.externalOrderId}
                        </div>
                        <div style={tableText.subtitle}>{formatDate(orderDate(o))}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, ...tableText.body2 }}>
                          {o.customerCode || <span className="muted">—</span>}
                        </div>
                        <div style={tableText.subtitle}>
                          {o.buyerUsername || <span className="muted">—</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, ...tableText.body2 }}>
                          {formatBahtTrim(o.grandTotalSatang)}
                        </div>
                        <div style={tableText.subtitle}>{psBadge.label}</div>
                      </td>
                      <td>
                        <span className={`pill ${osBadge.pill}`}>{osBadge.label}</span>
                      </td>
                      <td>
                        <OrderActionsMenu orderId={o.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
