"use client";

import { useEffect, useState } from "react";
import {
  importShopeeOrdersCsv,
  fetchOrders,
  type OrderImportResult,
  type OrderRow,
} from "@/lib/api";
import { orderStatusPill, paymentPill } from "@/lib/badges";
import { formatBahtTrim, formatUpdatedAt } from "@/lib/format";
import { tableText } from "@/lib/tableText";
import { AutoPill } from "../AutoPill";
import { PageHeader } from "../PageHeader";
import { TableFrame } from "../TableFrame";

/** A timestamp cell in the shared "date (body2) over time (subtitle)" pattern; — when absent. */
function dateTimeCell(ms: number | null) {
  if (!ms)
    return (
      <td style={{ whiteSpace: "nowrap", ...tableText.body2 }}>
        <span className="muted">—</span>
      </td>
    );
  const [date, time] = formatUpdatedAt(ms).split(" · ");
  return (
    <td style={{ whiteSpace: "nowrap" }}>
      <div style={tableText.body2}>{date}</div>
      <div style={tableText.subtitle}>{time}</div>
    </td>
  );
}

const PLACEHOLDER =
  "external_order_id,order_status,payment_status,order_fee,order_date,buyer_username,sales_total,fee_pct,ship_date\n" +
  "2406ABCDEF,paid,paid,105.00,2026-06-14,shopper99,1450.00,7.24,2026-06-16\n";

export default function OrdersPage() {
  const [csv, setCsv] = useState(PLACEHOLDER);
  const [result, setResult] = useState<OrderImportResult | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setOrders(await fetchOrders());
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    setBusy(true);
    setMsg("Importing…");
    setResult(null);
    try {
      const out = await importShopeeOrdersCsv(csv, {
        external_order_id: "external_order_id",
        order_status: "order_status",
        payment_status: "payment_status",
        order_total: "order_total",
        order_fee: "order_fee",
        order_date: "order_date",
        buyer_username: "buyer_username",
        sales_total: "sales_total",
        fee_pct: "fee_pct",
        ship_date: "ship_date",
      });
      setResult(out);
      setMsg("");
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <PageHeader
        title="Shopee orders (CSV import)"
        subtitle={
          <>
            Paste a Seller Centre order export (header row required). Required column:{" "}
            <code>external_order_id</code>. Optional: <code>order_status</code>,{" "}
            <code>payment_status</code>, <code>order_fee</code>, <code>order_date</code>,{" "}
            <code>buyer_username</code>, <code>sales_total</code>, <code>fee_pct</code>,{" "}
            <code>ship_date</code> — each captured only when the column is present. When{" "}
            <code>sales_total</code> is given, Total is stored as the net payout (Sales − fees).
            Re-importing is safe — duplicates are skipped.
          </>
        }
      />
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={8}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
      />
      <div style={{ marginTop: 8 }}>
        <button className="btn-primary" onClick={run} disabled={busy}>
          Import
        </button>{" "}
        <small style={{ color: "var(--danger)" }}>{msg}</small>
      </div>
      {result && (
        <p style={{ marginTop: 12 }}>
          Received <strong>{result.received}</strong> · imported <strong>{result.imported}</strong>{" "}
          · duplicates <strong>{result.duplicates}</strong> · invalid{" "}
          <strong>{result.invalid}</strong>
        </p>
      )}

      <h2 style={{ marginTop: 20 }}>Imported orders ({orders.length})</h2>
      {orders.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🧾</div>No orders imported yet.
        </div>
      ) : (
        <TableFrame>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Channel</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Order date</th>
                <th>Imported</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td style={tableText.body2}>{o.externalOrderId}</td>
                  <td style={tableText.body2}>
                    <span className="pill soft">{o.channel}</span>
                  </td>
                  <td style={{ textAlign: "right", ...tableText.body2 }}>
                    {o.grandTotalSatang ? (
                      formatBahtTrim(o.grandTotalSatang)
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={tableText.body2}>
                    {o.orderStatus ? (
                      <AutoPill className={`pill ${orderStatusPill(o.orderStatus)}`}>
                        {o.orderStatus}
                      </AutoPill>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={tableText.body2}>
                    {o.paymentStatus ? (
                      <span className={`pill ${paymentPill(o.paymentStatus)}`}>
                        {o.paymentStatus}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  {dateTimeCell(o.orderCreatedAt)}
                  {dateTimeCell(o.importedAt)}
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      )}
    </main>
  );
}
