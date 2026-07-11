"use client";

import { Fragment, useState } from "react";
import { updateAirPlusOrder, type OrderRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { airplusStatusBadge } from "@/lib/badges";
import { tableText } from "@/lib/tableText";
import { inputS } from "@/lib/inputStyles";
import { useToast } from "../ToastProvider";
import { TableFrame } from "../TableFrame";

const dateTH = (ms: number) => new Date(ms).toLocaleDateString("th-TH");
const mono = { fontFamily: "var(--font-mono, monospace)" } as const;

// The storefront's order-status vocabulary (Thai — these are the stored values the badge maps).
const ORDER_STATUSES = [
  "ใหม่",
  "รอชำระเงิน",
  "ชำระแล้ว",
  "กำลังจัดส่ง",
  "สำเร็จ",
  "ยกเลิก",
  "คืนเงิน",
] as const;
const PAYMENT_STATUSES = ["รอชำระเงิน", "ชำระแล้ว", "เก็บเงินปลายทาง"] as const;
const CARRIERS = ["Flash Express", "Kerry Express", "J&T Express", "ไปรษณีย์ไทย", "DHL"] as const;

const fieldCol = { display: "flex", flexDirection: "column", gap: 4 } as const;
const fieldLabel = { fontSize: 12, color: "var(--text-muted)" } as const;

/** Inline fulfillment editor for one order — status / payment / carrier / tracking, then Save. */
function OrderEditor({
  order,
  onSaved,
  onCancel,
}: {
  order: OrderRow;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const toast = useToast();
  const currentStatus = order.orderStatus ?? "";
  const isPreset = (ORDER_STATUSES as readonly string[]).includes(currentStatus);
  const [statusSel, setStatusSel] = useState(isPreset ? currentStatus : "");
  // Free-text override — wins over the select when non-empty (for one-off statuses).
  const [statusOverride, setStatusOverride] = useState(isPreset ? "" : currentStatus);
  const [payment, setPayment] = useState(order.paymentStatus ?? "");
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [trackingNo, setTrackingNo] = useState(order.trackingNo ?? "");
  const [busy, setBusy] = useState(false);

  const effectiveStatus = statusOverride.trim() || statusSel;
  const dirty =
    effectiveStatus !== currentStatus ||
    payment !== (order.paymentStatus ?? "") ||
    carrier.trim() !== (order.carrier ?? "") ||
    trackingNo.trim() !== (order.trackingNo ?? "");

  async function save() {
    setBusy(true);
    try {
      const fields: Parameters<typeof updateAirPlusOrder>[1] = {};
      if (effectiveStatus !== currentStatus) fields.orderStatus = effectiveStatus;
      if (payment !== (order.paymentStatus ?? "")) fields.paymentStatus = payment;
      if (carrier.trim() !== (order.carrier ?? "")) fields.carrier = carrier.trim();
      if (trackingNo.trim() !== (order.trackingNo ?? "")) fields.trackingNo = trackingNo.trim();
      await updateAirPlusOrder(order.id, fields);
      toast("Order updated", "success");
      await onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  // Keep an off-vocabulary stored payment status selectable so it isn't silently lost.
  const paymentOptions: string[] = [...PAYMENT_STATUSES];
  if (payment && !paymentOptions.includes(payment)) paymentOptions.unshift(payment);

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={fieldCol}>
        <span style={fieldLabel}>Order status</span>
        <select
          aria-label="Order status"
          value={statusSel}
          onChange={(e) => {
            setStatusSel(e.target.value);
            setStatusOverride("");
          }}
          style={inputS}
        >
          <option value="">—</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div style={fieldCol}>
        <span style={fieldLabel}>Custom status (overrides)</span>
        <input
          value={statusOverride}
          onChange={(e) => setStatusOverride(e.target.value)}
          placeholder="Free text…"
          style={{ ...inputS, width: 150 }}
        />
      </div>
      <div style={fieldCol}>
        <span style={fieldLabel}>Payment</span>
        <select
          aria-label="Payment status"
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
          style={inputS}
        >
          <option value="">—</option>
          {paymentOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div style={fieldCol}>
        <span style={fieldLabel}>Carrier</span>
        <input
          list="airplus-carriers"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          placeholder="Flash Express…"
          style={{ ...inputS, width: 150 }}
        />
        <datalist id="airplus-carriers">
          {CARRIERS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div style={fieldCol}>
        <span style={fieldLabel}>Tracking no.</span>
        <input
          value={trackingNo}
          onChange={(e) => setTrackingNo(e.target.value)}
          placeholder="TH1234567890"
          style={{ ...inputS, ...mono, width: 170 }}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={!dirty || busy}
          onClick={save}
        >
          Save
        </button>
        <button type="button" className="btn-sm" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * AirPlus orders (the owner's own single-seller site) — the sales numbers plus inline fulfillment
 * editing: order/payment status, carrier and tracking number per row.
 */
export function AirPlusOrders({
  orders,
  onChanged,
}: {
  orders: OrderRow[];
  /** Called after a successful edit so the parent can re-fetch the orders list. */
  onChanged?: () => void | Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">☁️</div>No AirPlus orders in this period.
      </div>
    );
  }
  return (
    <TableFrame>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Sales</th>
            <th>Profit</th>
            <th>Carrier</th>
            <th>Date</th>
            <th>Status</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const badge = airplusStatusBadge(o.orderStatus);
            const editing = editingId === o.id;
            return (
              <Fragment key={o.id}>
                <tr>
                  {/* Order ID + username */}
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ ...tableText.body2, ...mono }}>{o.externalOrderId}</div>
                    {o.buyerUsername && <div style={tableText.subtitle}>{o.buyerUsername}</div>}
                  </td>
                  {/* Sales = what the customer paid (no commission → seller keeps it) */}
                  <td>
                    {o.salesSatang != null ? (
                      formatBahtTrim(o.salesSatang)
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  {/* Profit = Sales − cost (own site, known cost) */}
                  <td>
                    {o.profitSatang != null ? (
                      formatBahtTrim(o.profitSatang)
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  {/* Carrier tag + tracking no. */}
                  <td style={{ whiteSpace: "nowrap" }}>
                    {o.carrier ? (
                      <span className="pill off">{o.carrier}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                    {o.trackingNo && (
                      <div style={{ ...tableText.subtitle, ...mono, marginTop: 4 }}>
                        {o.trackingNo}
                      </div>
                    )}
                  </td>
                  {/* Ordered date + shipped date */}
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={tableText.body2}>{dateTH(o.orderCreatedAt ?? o.importedAt)}</div>
                    <div style={tableText.subtitle}>
                      {o.shipTimeMs ? `→ ${dateTH(o.shipTimeMs)}` : "—"}
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${badge.pill}`}>{badge.label}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn-sm"
                      onClick={() => setEditingId(editing ? null : o.id)}
                    >
                      {editing ? "Close" : "Edit"}
                    </button>
                  </td>
                </tr>
                {editing && (
                  <tr>
                    <td colSpan={7}>
                      <OrderEditor
                        order={o}
                        onCancel={() => setEditingId(null)}
                        onSaved={async () => {
                          setEditingId(null);
                          await onChanged?.();
                        }}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </TableFrame>
  );
}
