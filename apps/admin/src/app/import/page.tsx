"use client";

import { useState } from "react";
import { importProductsCsv, type ImportResult } from "@/lib/api";
import { PageHeader } from "../PageHeader";
import { BackLink } from "../BackLink";
import { useT } from "../LangProvider";

const PLACEHOLDER = "product_ref,name,description\nAC-CMP-VIOS14,ครีมบำรุงผิว,หลอด 50ml\n";

export default function ImportPage() {
  const t = useT();
  const [csv, setCsv] = useState(PLACEHOLDER);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setStatus(t({ th: "กำลังนำเข้า…", en: "Importing…" }));
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
      <PageHeader
        title={t({ th: "นำเข้าสินค้า (CSV)", en: "Import products (CSV)" })}
        subtitle={
          <>
            {t({
              th: "วางไฟล์ CSV ที่มีแถวหัวตาราง คอลัมน์",
              en: "Paste a CSV with a header row. Columns",
            })}{" "}
            <code>product_ref</code> {t({ th: "(รหัสสินค้า) และ", en: "(Product ID) and" })}{" "}
            <code>name</code>{" "}
            {t({
              th: "จำเป็นต้องมี ส่วน",
              en: "are required;",
            })}{" "}
            <code>description</code>{" "}
            {t({
              th: "จะใส่หรือไม่ก็ได้ นำเข้าซ้ำได้อย่างปลอดภัย (ยึดตามรหัสสินค้า)",
              en: "is optional. Re-importing is safe (idempotent on the Product ID).",
            })}
          </>
        }
        below={<BackLink href="/products">{t({ th: "สินค้า", en: "Products" })}</BackLink>}
      />
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={10}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
      />
      <div style={{ marginTop: 8 }}>
        <button className="btn-primary" onClick={run} disabled={busy}>
          {t({ th: "นำเข้า", en: "Import" })}
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
    </main>
  );
}
