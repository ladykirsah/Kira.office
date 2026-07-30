"use client";

import { useState } from "react";
import type { OrderRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { orderStatusBadge, paymentStatusBadge } from "@/lib/badges";
import { tableText } from "@/lib/tableText";
import { inputS } from "@/lib/inputStyles";
import { dateRange, type DatePreset } from "@/lib/dateRange";
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

  // Summary counts (all-time, not affected by date/tab)
  const codApproval = airplus.filter(
    (o) => o.paymentStatus === "cod" && o.orderStatus === "new",
  ).length;
  const toBeShipped = airplus.filter(
    (o) =>
      (o.paymentStatus === "paid" || o.paymentStatus === "cod_confirmed") &&
      o.orderStatus !== "shipped" &&
      o.orderStatus !== "delivered" &&
      o.orderStatus !== "cancelled" &&
      o.orderStatus !== "expired",
  ).length;
  const inTransit = airplus.filter((o) => o.orderStatus === "shipped").length;
  const returns = airplus.filter(
    (o) => o.orderStatus === "cancelled" && o.paymentStatus === "refunded",
  ).length;

  // Date filter
  const { start: rangeStart, end: rangeEnd } = dateRange(datePreset, now, customFrom, customTo);
  const dateFiltered = airplus.filter((o) => {
    const t = orderDate(o);
    return t >= rangeStart && t <= rangeEnd;
  });

  // Tab filter
  const filterByTab = (list: OrderRow[], t: Tab) => {
    switch (t) {
      case "unpaid":
        return list.filter((o) => o.orderStatus === "new" && o.paymentStatus === "pending");
      case "toship":
        return list.filter(
          (o) =>
            (o.paymentStatus === "paid" || o.paymentStatus === "cod_confirmed") &&
            o.orderStatus !== "shipped" &&
            o.orderStatus !== "delivered" &&
            o.orderStatus !== "cancelled" &&
            o.orderStatus !== "expired",
        );
      case "shipped":
        return list.filter((o) => o.orderStatus === "shipped");
      case "completed":
        return list.filter((o) => o.orderStatus === "delivered");
      case "unfinished":
        return list.filter(
          (o) =>
            o.orderStatus === "cancelled" ||
            o.orderStatus === "expired" ||
            o.paymentStatus === "cod_denied" ||
            o.paymentStatus === "expired",
        );
      default:
        return list;
    }
  };

  // Summary card filter (overrides tab when active)
  const bySummary = (list: OrderRow[]) => {
    switch (summaryFilter) {
      case "cod":
        return list.filter((o) => o.paymentStatus === "cod" && o.orderStatus === "new");
      case "toship":
        return list.filter(
          (o) =>
            (o.paymentStatus === "paid" || o.paymentStatus === "cod_confirmed") &&
            o.orderStatus !== "shipped" &&
            o.orderStatus !== "delivered" &&
            o.orderStatus !== "cancelled" &&
            o.orderStatus !== "expired",
        );
      case "shipped":
        return list.filter((o) => o.orderStatus === "shipped");
      case "returns":
        return list.filter((o) => o.orderStatus === "cancelled" && o.paymentStatus === "refunded");
      default:
        return list;
    }
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

  // Filter dropdown
  if (filterVal) {
    view = view.filter((o) => o.orderStatus === filterVal || o.paymentStatus === filterVal);
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
        <TabBtn id="shipped" label="Shipped" />
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
              <optgroup label="Order status">
                <option value="new">New</option>
                <option value="confirmed">Confirmed</option>
                <option value="packing">Packing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </optgroup>
              <optgroup label="Payment">
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="cod">COD</option>
                <option value="cod_confirmed">COD Approved</option>
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
                  const osBadge = orderStatusBadge(o.orderStatus);
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
