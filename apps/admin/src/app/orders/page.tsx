"use client";

import { useEffect, useState } from "react";
import {
  importShopeeOrdersCsv,
  fetchOrders,
  type OrderImportResult,
  type OrderRow,
} from "@/lib/api";
import { orderStatusPill, paymentPill } from "@/lib/badges";
import { formatUpdatedAt } from "@/lib/format";

const PLACEHOLDER = "external_order_id,order_status,payment_status\n2406ABCDEF,paid,paid\n";

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
      <h1>Shopee orders (CSV import)</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Paste a Seller Centre order export (header row required). Required column:{" "}
        <code>external_order_id</code>. Re-importing is safe — duplicates are skipped.
      </p>
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
        <div className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Imported</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.externalOrderId}</td>
                  <td>
                    <span className="pill soft">{o.channel}</span>
                  </td>
                  <td>
                    {o.orderStatus ? (
                      <span className={`pill ${orderStatusPill(o.orderStatus)}`}>
                        {o.orderStatus}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {o.paymentStatus ? (
                      <span className={`pill ${paymentPill(o.paymentStatus)}`}>
                        {o.paymentStatus}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatUpdatedAt(o.importedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
