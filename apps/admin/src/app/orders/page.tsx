"use client";

import { useEffect, useState } from "react";
import {
  importShopeeOrdersCsv,
  fetchOrders,
  type OrderImportResult,
  type OrderRow,
} from "@/lib/api";

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
      <p style={{ color: "#555" }}>
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
        <small style={{ color: "crimson" }}>{msg}</small>
      </div>
      {result && (
        <p style={{ marginTop: 12 }}>
          Received <strong>{result.received}</strong> · imported <strong>{result.imported}</strong> ·
          duplicates <strong>{result.duplicates}</strong> · invalid <strong>{result.invalid}</strong>
        </p>
      )}

      <h2 style={{ marginTop: 20 }}>Imported orders ({orders.length})</h2>
      <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Order</th>
            <th align="left">Channel</th>
            <th align="left">Status</th>
            <th align="left">Payment</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} style={{ borderTop: "1px solid #eee" }}>
              <td>{o.externalOrderId}</td>
              <td>{o.channel}</td>
              <td>{o.orderStatus ?? "—"}</td>
              <td>{o.paymentStatus ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
