"use client";

import { useState } from "react";
import { importProductsCsv, type ImportResult } from "@/lib/api";

const PLACEHOLDER = "product_ref,name,description\nAC-CMP-VIOS14,ครีมบำรุงผิว,หลอด 50ml\n";

export default function ImportPage() {
  const [csv, setCsv] = useState(PLACEHOLDER);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setStatus("Importing…");
    setResult(null);
    try {
      const out = await importProductsCsv(csv, {
        product_ref: "product_ref",
        name: "name",
        description: "description",
      });
      setResult(out);
      setStatus("");
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Import products (CSV)</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Paste a CSV with a header row. Columns <code>product_ref</code> (Product ID) and{" "}
        <code>name</code> are required; <code>description</code> is optional. Re-importing is safe
        (idempotent on the Product ID).
      </p>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={10}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
      />
      <div style={{ marginTop: 8 }}>
        <button className="btn-primary" onClick={run} disabled={busy}>
          Import
        </button>
      </div>
      {status && <p>{status}</p>}
      {result && (
        <div style={{ marginTop: 12 }}>
          <p>
            Received <strong>{result.received}</strong> · imported <strong>{result.valid}</strong> ·
            skipped <strong>{result.invalid}</strong>
          </p>
          {result.errors.length > 0 && (
            <ul style={{ color: "var(--danger)" }}>
              {result.errors.map((e, i) => (
                <li key={i}>
                  row {e.rowIndex}: {e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p>
        <a href="/products">← Products</a>
      </p>
    </main>
  );
}
