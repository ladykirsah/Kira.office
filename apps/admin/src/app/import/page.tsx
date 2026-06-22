"use client";

import { useState } from "react";
import { importProductsCsv, type ImportResult } from "@/lib/api";

const PLACEHOLDER = "product_code,name,description\nSKU-001,ครีมบำรุงผิว,หลอด 50ml\n";

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
        product_code: "product_code",
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
      <p style={{ color: "#555" }}>
        Paste a CSV with a header row. Columns <code>product_code</code> and <code>name</code> are
        required; <code>description</code> is optional. Re-importing is safe (idempotent on code).
      </p>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={10}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
      />
      <div style={{ marginTop: 8 }}>
        <button onClick={run} disabled={busy}>
          Import
        </button>
      </div>
      {status && <p>{status}</p>}
      {result && (
        <div style={{ marginTop: 12 }}>
          <p>
            Received <strong>{result.received}</strong> · imported{" "}
            <strong>{result.valid}</strong> · skipped <strong>{result.invalid}</strong>
          </p>
          {result.errors.length > 0 && (
            <ul style={{ color: "crimson" }}>
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
