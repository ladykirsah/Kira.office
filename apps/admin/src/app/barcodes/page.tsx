"use client";

import { useEffect, useState } from "react";
import { fetchBarcodes, addBarcode, type BarcodeRow } from "@/lib/api";

export default function BarcodesPage() {
  const [rows, setRows] = useState<BarcodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      setRows(await fetchBarcodes());
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate(productId: string) {
    setBusy(productId);
    try {
      await addBarcode(productId);
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (loading) return <main>Loading…</main>;

  return (
    <main>
      <h1>Barcodes</h1>
      <p>
        <button onClick={() => window.print()}>Print this list</button>{" "}
        <small style={{ color: "crimson" }}>{msg}</small>
      </p>
      <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Product</th>
            <th align="left">Code</th>
            <th align="left">Barcode</th>
            <th align="left"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.variantId} style={{ borderTop: "1px solid #eee" }}>
              <td>{r.productName}</td>
              <td>{r.productCode}</td>
              <td style={{ fontFamily: "monospace" }}>{r.barcode ?? <span style={{ color: "#bbb" }}>—</span>}</td>
              <td>
                {!r.barcode && (
                  <button onClick={() => generate(r.productId)} disabled={busy === r.productId}>
                    Generate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
