"use client";

import { useState } from "react";
import type { OrderRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { operationalStatusBadge, paymentStatusBadge } from "@/lib/badges";
import { tableText } from "@/lib/tableText";
import { inputS } from "@/lib/inputStyles";
import { dateRange, type DatePreset } from "@/lib/dateRange";
import { ORDER_TAB_LABELS, ORDER_TAB_STATUSES } from "@/lib/orderTabs";
import {
  ORDER_SUMMARY_CARDS,
  cardIsWholeTab,
  orderSummaryCardLabel,
  type OrderSummaryCard,
} from "@/lib/orderSummaryCards";
import { OPERATIONAL_STATUSES, operationalStatus, operationalStatusLabel } from "@l-shopee/core";
import { OrderActionsMenu } from "./OrderActionsMenu";

import type { OrderTab } from "@/lib/orderTabs";

type Tab = "all" | OrderTab;
/** Derived from the card table so the two can never list different keys. */
type SummaryFilter = OrderSummaryCard["key"] | null;

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

  // Summary counts, deliberately ALL-TIME and unaffected by the date range or the tab: they answer
  // "what is outstanding", and a parcel ordered three days ago still needs sending. Clicking a card
  // widens the date range to match, so the number and the table it opens always agree.
  const countOf = (...want: string[]) =>
    airplus.filter((o) => {
      const s = operationalStatus(o.orderStatus, o.paymentStatus);
      return s != null && want.includes(s);
    }).length;

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
    if (t === "all") return list;
    return list.filter((o) => is(o, ...ORDER_TAB_STATUSES[t]));
  };

  // Summary card filter (overrides tab when active). Each card maps to one operational status — the
  // same status the Filter dropdown offers — so clicking a card cannot show a different set from the
  // number printed on it. The mapping and its labels live in lib/orderSummaryCards, with tests
  // holding the owner's rule that a card matching a tab's label IS that tab.
  const bySummary = (list: OrderRow[]) => {
    const card = ORDER_SUMMARY_CARDS.find((c) => c.key === summaryFilter);
    if (!card) return list;
    return list.filter((o) => operationalStatus(o.orderStatus, o.paymentStatus) === card.status);
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

  // Label from the same table the summary cards read, so "same label ⇒ same page" is enforced by
  // there being one label. "All" is not a status filter, so it is the only one written here.
  const tabLabel = (id: Tab) => (id === "all" ? "All" : ORDER_TAB_LABELS[id]);

  const TabBtn = ({ id }: { id: Tab }) => (
    <button
      className={tab === id && !summaryFilter ? "tab active" : "tab"}
      onClick={() => {
        setTab(id);
        setSummaryFilter(null);
      }}
    >
      {tabLabel(id)} ({tabCount(id)})
    </button>
  );

  /**
   * A card is a shortcut, so clicking it has to actually show the orders it counted.
   *
   * Two things make that true. It lands on the tab that contains the status — for To ship and In
   * transit that IS the tab, and for the two slices it is the tab they sit inside, so deselecting the
   * card leaves you somewhere sensible instead of back on whatever tab you came from. And it widens
   * the date range: the counts are all-time on purpose (a parcel ordered three days ago still needs
   * sending), so with the default Today range a card reading 1 would open an empty table.
   */
  const toggleSummary = (card: OrderSummaryCard) => {
    if (summaryFilter === card.key) {
      setSummaryFilter(null);
      return;
    }
    setSummaryFilter(cardIsWholeTab(card) ? null : card.key);
    setTab(card.tab);
    setDatePreset("all");
  };

  const SCard = ({ card, value }: { card: OrderSummaryCard; value: number }) => {
    // A whole-tab card has no separate filter to be "on" — being on its tab IS being on it.
    const active = cardIsWholeTab(card)
      ? tab === card.tab && !summaryFilter
      : summaryFilter === card.key;
    return (
      <div
        style={active ? summaryCardActive : summaryCard}
        onClick={() => toggleSummary(card)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSummary(card);
          }
        }}
      >
        <div style={summaryLabel}>{orderSummaryCardLabel(card)}</div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            marginTop: 2,
            color: value > 0 ? card.activeColor : "var(--text-faint)",
          }}
        >
          {value}
        </div>
      </div>
    );
  };

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
        {/* Rendered from the card table rather than four hand-written blocks, so a card's label,
            its status and the tab it opens cannot be edited apart from each other. */}
        {ORDER_SUMMARY_CARDS.map((card) => (
          <SCard key={card.key} card={card} value={countOf(card.status)} />
        ))}
      </div>

      {/* Tabs — same as ProductsTable */}
      <div className="tabs">
        {/* Labels come from ORDER_TAB_LABELS; the `shipped` id stays internal while it reads
            "In transit", matching the Status pill and the summary card. */}
        <TabBtn id="all" />
        <TabBtn id="unpaid" />
        <TabBtn id="toship" />
        <TabBtn id="shipped" />
        <TabBtn id="completed" />
        <TabBtn id="unfinished" />
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
                        {/* The order code links to the detail page, same target as the row's View
                            action — mirrors the product-name link on the Products table. */}
                        <a
                          href={`/orders/${o.id}`}
                          title={o.externalOrderId}
                          style={{
                            fontWeight: 700,
                            ...tableText.body2,
                            display: "block",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {o.externalOrderId}
                        </a>
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
