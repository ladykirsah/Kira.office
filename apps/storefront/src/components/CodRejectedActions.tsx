"use client";

import { useState } from "react";

/**
 * Shown on the order-tracking page when a COD order was rejected. Two choices: switch to bank
 * transfer (→ the order goes back to pending and the slip upload appears) or cancel (→ Cancelled).
 * Both re-look-up the order on success so the page reflects the new state.
 */
export function CodRejectedActions({
  orderRef,
  phone,
  onChanged,
}: {
  orderRef: string;
  phone: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<null | "transfer" | "cancel">(null);
  const [error, setError] = useState<string | null>(null);

  async function act(kind: "transfer" | "cancel") {
    setBusy(kind);
    setError(null);
    try {
      const url = kind === "transfer" ? "/api/orders/change-payment" : "/api/orders/cancel";
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref: orderRef, phone }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
        setBusy(null);
        return;
      }
      onChanged();
    } catch {
      setError("ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้ง");
      setBusy(null);
    }
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
        เก็บเงินปลายทางถูกปฏิเสธ — เลือกดำเนินการต่อ
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy !== null}
          onClick={() => void act("transfer")}
        >
          {busy === "transfer" ? "กำลังเปลี่ยน…" : "เปลี่ยนเป็นโอนเงิน"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy !== null}
          onClick={() => void act("cancel")}
        >
          {busy === "cancel" ? "กำลังยกเลิก…" : "ยกเลิกคำสั่งซื้อ"}
        </button>
      </div>
      {error && (
        <div role="alert" style={{ marginTop: 8, color: "var(--danger)", fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  );
}
