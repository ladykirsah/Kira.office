"use client";

import { useEffect, useState } from "react";
import { fetchTypeWarranties, setTypeWarranty, type TypeWarranty } from "@/lib/api";
import { inputS } from "@/lib/inputStyles";
import { PageHeader } from "../../PageHeader";
import { useToast } from "../../ToastProvider";

/** Warranty / return window per product category (product_types). The storefront shows this on every
 *  product of that category, and the returns policy refers to it. Blank = no warranty shown. */
export default function WarrantySettingsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<TypeWarranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTypeWarranties()
      .then((r) => setRows(r))
      .catch((e) => toast((e as Error).message, "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  function edit(id: string, value: string) {
    const n = value.trim() === "" ? null : Math.max(0, Math.round(Number(value) || 0));
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, warrantyDays: n } : r)));
  }

  async function save(row: TypeWarranty) {
    setSavingId(row.id);
    try {
      await setTypeWarranty(row.id, row.warrantyDays);
      toast(
        row.warrantyDays
          ? `${row.name}: รับประกัน ${row.warrantyDays} วัน`
          : `${row.name}: ไม่มีรับประกัน`,
        "success",
      );
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main>
      <PageHeader
        title="ระยะเวลารับประกัน"
        subtitle="กำหนดระยะเวลาการคืน/รับประกัน (วัน) ต่อหมวดหมู่สินค้า — จะแสดงบนหน้าสินค้าทุกชิ้นในหมวดนั้น (เว้นว่าง = ไม่แสดง)"
      />

      {loading ? (
        <p className="muted">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="muted">ยังไม่มีหมวดหมู่สินค้า — เพิ่มได้ที่หน้า Part attributes ก่อน</p>
      ) : (
        <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              className="card"
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}
            >
              <span style={{ flex: 1, fontWeight: 600 }}>{r.name}</span>
              <input
                value={r.warrantyDays ?? ""}
                onChange={(e) => edit(r.id, e.target.value)}
                onBlur={() => void save(r)}
                inputMode="numeric"
                placeholder="—"
                aria-label={`ระยะเวลารับประกันของ ${r.name} (วัน)`}
                style={{ ...inputS, width: 96, textAlign: "right" }}
              />
              <span className="muted" style={{ width: 28 }}>
                วัน
              </span>
              <span className="muted" style={{ width: 44, fontSize: 12 }}>
                {savingId === r.id ? "…" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
