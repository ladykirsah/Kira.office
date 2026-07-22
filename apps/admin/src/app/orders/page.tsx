"use client";

import { useEffect, useRef, useState } from "react";
import {
  importShopeeOrdersCsv,
  fetchOrders,
  type OrderImportResult,
  type OrderRow,
} from "@/lib/api";
import { orderStatusPill, paymentPill } from "@/lib/badges";
import { formatBahtTrim, formatUpdatedAt } from "@/lib/format";
import { tableText } from "@/lib/tableText";
import { xlsxToImportCsv } from "@l-shopee/core";
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
  }, []);

  // Load a chosen file into the CSV box: a Shopee .xlsx is parsed + normalized in-browser (all its
  // cells are text, so no heavy library); a .csv is read as-is. The user still reviews then Imports.
  const readingFile = useRef(false); // guard: an earlier slow parse must not clobber a newer pick
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked
    if (!file || readingFile.current) return;
    readingFile.current = true;
    setResult(null);
    setMsg(`Reading ${file.name}…`);
    try {
      const text = /\.xlsx$/i.test(file.name)
        ? await xlsxToImportCsv(new Uint8Array(await file.arrayBuffer()))
        : await file.text();
      setCsv(text);
      setMsg("");
    } catch (err) {
      setMsg(`Could not read ${file.name}: ${(err as Error).message}`);
    } finally {
      readingFile.current = false;
    }
  }

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
        title="Shopee orders (import)"
        subtitle={
          <>
            Upload a Seller Centre order export (<code>.xlsx</code>) — it&apos;s parsed in your
            browser into the columns below (Total = Sales − fees). Or paste a <code>.csv</code>{" "}
            directly. Required column: <code>external_order_id</code>. Re-importing is safe —
            duplicates are skipped.
          </>
        }
      />
      <div style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center" }}>
        {/* A real <button> (not a label) so it gets the app's button styling (radius/weight/hover). */}
        <button
          type="button"
          className="btn-soft btn-sm"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Shopee export…
        </button>
        <small className="muted">.xlsx or .csv — or paste below</small>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={onFile}
          style={{ display: "none" }}
        />
      </div>
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
                <th style={{ textAlign: "right" }}>Shipping</th>
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
                  <td style={{ textAlign: "right", ...tableText.body2 }}>
                    {o.shippingFeeSatang ? (
                      formatBahtTrim(o.shippingFeeSatang)
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
