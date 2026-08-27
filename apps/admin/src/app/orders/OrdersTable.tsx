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
  summaryCardFromKey,
  type OrderSummaryCard,
} from "@/lib/orderSummaryCards";
import {
  summaryCard,
  summaryCardActive,
  summaryLabel,
  summaryNumber,
  summaryNumberColor,
} from "@/lib/summaryCardStyles";
import { OPERATIONAL_STATUSES, operationalStatus, operationalStatusLabel } from "@l-shopee/core";
import { OrderActionsMenu } from "./OrderActionsMenu";

import type { OrderTab } from "@/lib/orderTabs";
import { useT } from "../LangProvider";

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

/** Written once: the `th` reads them wide, every `td` carries the matching one as `data-label`,
 *  which the phone prints beside the value once the table becomes cards. They cannot drift. */
const COLUMN = {
  order: { th: "ออเดอร์", en: "Order" },
  customer: { th: "ลูกค้า", en: "Customer" },
  total: { th: "ยอดรวม", en: "Total" },
  status: { th: "สถานะ", en: "Status" },
  action: { th: "จัดการ", en: "Action" },
};

export function OrdersTable({
  orders,
  initialCardKey = null,
}: {
  orders: OrderRow[];
  /** A `?card=` deep-link from the dashboard: opens the table already on that card's filter, the same
   *  view clicking the card here produces. An unknown/absent key just leaves the default All view. */
  initialCardKey?: string | null;
}) {
  const initialCard = summaryCardFromKey(initialCardKey);
  const t = useT();
  const [tab, setTab] = useState<Tab>(initialCard ? initialCard.tab : "all");
  // Mirror toggleSummary's landing exactly: a whole-tab card needs no separate filter (its tab IS it),
  // and the date range widens to all-time so an all-time count doesn't open onto an empty Today.
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>(
    initialCard && !cardIsWholeTab(initialCard) ? initialCard.key : null,
  );
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [filterVal, setFilterVal] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>(initialCard ? "all" : "today");
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

  // Summary card filter (overrides tab when active). A card counts a SET of statuses — Pending groups
  // two, Refund several — and clicking it shows exactly that set, so the table can never disagree with
  // the number printed on the card. The sets live in lib/orderSummaryCards, where tests hold them
  // disjoint and inside the tab each card opens.
  const bySummary = (list: OrderRow[]) => {
    const card = ORDER_SUMMARY_CARDS.find((c) => c.key === summaryFilter);
    if (!card) return list;
    return list.filter((o) => {
      const s = operationalStatus(o.orderStatus, o.paymentStatus);
      return s != null && card.statuses.includes(s);
    });
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
  const tabLabel = (id: Tab) =>
    t(id === "all" ? { th: "ทั้งหมด", en: "All" } : ORDER_TAB_LABELS[id]);

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
        <div style={summaryLabel}>{t(orderSummaryCardLabel(card))}</div>
        <div style={{ ...summaryNumber, color: summaryNumberColor(value, card.activeColor) }}>
          {value}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Summary cards. The same `.stat-grid` the dashboard uses — four across on a wide screen,
          two by two on a phone, where a quarter of the width is narrower than the words in the
          labels and "รอดำเนินการ" breaks over two lines (owner, 27 Aug 2026). summaryCardStyles.ts
          already keeps the two frames from drifting; the grid around them belongs in one place for
          the same reason. Only the bottom margin is this page's own. */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {/* Rendered from the card table rather than four hand-written blocks, so a card's label,
            the statuses it counts and the tab it opens cannot be edited apart from each other. */}
        {ORDER_SUMMARY_CARDS.map((card) => (
          <SCard key={card.key} card={card} value={countOf(...card.statuses)} />
        ))}
      </div>

      {/* Tabs — same as ProductsTable */}
      <div className="tabs">
        {/* Labels come from ORDER_TAB_LABELS; the `shipped` id stays internal while it reads
            "In transit", matching the Status pill and the summary card. */}
        <TabBtn id="all" />
        <TabBtn id="unpaid" />
        <TabBtn id="pending" />
        <TabBtn id="toship" />
        <TabBtn id="shipped" />
        <TabBtn id="completed" />
        <TabBtn id="cancelfail" />
        <TabBtn id="refundclaim" />
      </div>

      {/* Frame — same as ProductsTable */}
      <div style={frameStyle}>
        <div style={toolbarStyle}>
          <input
            className="tbar-input"
            placeholder={t({
              th: "ค้นหาเลขออเดอร์ ชื่อ เบอร์โทร…",
              en: "Search order ID, name, phone...",
            })}
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
            aria-label={t({ th: "เรียงตาม", en: "Sort by" })}
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
            <option value="">{t({ th: "เรียงตาม…", en: "Sort by..." })}</option>
            <option value="status">{t({ th: "สถานะ", en: "Status" })}</option>
            <option value="payment">{t({ th: "การชำระเงิน", en: "Payment" })}</option>
          </select>
          {sortBy && (
            <select
              aria-label={t({ th: "กรอง", en: "Filter" })}
              value={filterVal}
              onChange={(e) => setFilterVal(e.target.value)}
              style={{
                ...inputS,
                color: filterVal ? "var(--text)" : "var(--text-faint)",
                fontWeight: filterVal ? 500 : 400,
              }}
            >
              <option value="">{t({ th: "กรอง…", en: "Filter..." })}</option>
              {/* Offer the same seven the Status column shows — filtering by a raw order_status the
                  column never displays would be filtering by an invisible field. */}
              <optgroup label={t({ th: "สถานะ", en: "Status" })}>
                {OPERATIONAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {operationalStatusLabel(s)}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t({ th: "การชำระเงิน", en: "Payment" })}>
                <option value="pending">{t({ th: "รอชำระเงิน", en: "Pending" })}</option>
                <option value="paid">{t({ th: "ชำระแล้ว", en: "Paid" })}</option>
                <option value="cod">{t({ th: "เก็บเงินปลายทาง", en: "COD" })}</option>
                <option value="cod_confirmed">
                  {t({ th: "อนุมัติเก็บปลายทาง", en: "COD Approved" })}
                </option>
                <option value="cod_collected">
                  {t({ th: "เก็บเงินแล้ว", en: "COD Collected" })}
                </option>
                <option value="cod_denied">
                  {t({ th: "ปฏิเสธเก็บปลายทาง", en: "COD Denied" })}
                </option>
                <option value="refunded">{t({ th: "คืนเงินแล้ว", en: "Refunded" })}</option>
              </optgroup>
            </select>
          )}
          <select
            aria-label={t({ th: "ช่วงวันที่", en: "Date range" })}
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            style={{
              ...inputS,
              color: datePreset !== "all" ? "var(--text)" : "var(--text-faint)",
              fontWeight: datePreset !== "all" ? 500 : 400,
            }}
          >
            <option value="all">{t({ th: "ทั้งหมด", en: "All time" })}</option>
            <option value="today">{t({ th: "วันนี้", en: "Today" })}</option>
            <option value="7d">{t({ th: "7 วันล่าสุด", en: "Last 7 days" })}</option>
            <option value="30d">{t({ th: "30 วันล่าสุด", en: "Last 30 days" })}</option>
            <option value="month">{t({ th: "เดือนนี้", en: "This month" })}</option>
            <option value="lastmonth">{t({ th: "เดือนก่อน", en: "Last month" })}</option>
            <option value="custom">{t({ th: "กำหนดเอง…", en: "Custom..." })}</option>
          </select>
        </div>
        {datePreset === "custom" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
              {t({ th: "ตั้งแต่", en: "From" })}
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
            {airplus.length === 0
              ? t({ th: "ยังไม่มีออเดอร์ AirPlus", en: "No AirPlus orders yet." })
              : t({ th: "ไม่มีออเดอร์ที่ตรงกับที่เลือก", en: "No orders match." })}
          </div>
        ) : (
          <div className="list-cards-scroll">
            <table className="list-cards">
              <thead>
                <tr>
                  <th>{t(COLUMN.order)}</th>
                  <th>{t(COLUMN.customer)}</th>
                  <th>{t(COLUMN.total)}</th>
                  <th>{t(COLUMN.status)}</th>
                  <th align="left">{t(COLUMN.action)}</th>
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
                      <td data-label={t(COLUMN.customer)}>
                        <div style={{ fontWeight: 700, ...tableText.body2 }}>
                          {o.customerCode || <span className="muted">—</span>}
                        </div>
                        <div style={tableText.subtitle}>
                          {o.buyerUsername || <span className="muted">—</span>}
                        </div>
                      </td>
                      <td data-label={t(COLUMN.total)}>
                        <div style={{ fontWeight: 700, ...tableText.body2 }}>
                          {formatBahtTrim(o.grandTotalSatang)}
                        </div>
                        <div style={tableText.subtitle}>{t(psBadge.label)}</div>
                      </td>
                      <td data-label={t(COLUMN.status)}>
                        <span className={`pill ${osBadge.pill}`}>{t(osBadge.label)}</span>
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
