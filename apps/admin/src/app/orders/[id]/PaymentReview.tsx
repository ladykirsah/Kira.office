"use client";

import { useState } from "react";
import { reviewOrderPayment, privateFileUrl, type OrderDetail } from "@/lib/api";
import { tableText } from "@/lib/tableText";
import { inputS } from "@/lib/inputStyles";
import { card, sectionTitle } from "./cardStyles";

/**
 * Zone A for a `verifying` order (owner, 31 Jul 2026): the one thing to do is decide the uploaded
 * slip. Any admin may confirm or reject; the slip IMAGE is super-admin-only (a regular admin sees a
 * note instead). Confirm settles the order; reject needs a reason and returns it to pending with a
 * fresh 48h window. Full-width at the top of the page, per the layout standard.
 */
export function PaymentReviewSection({
  order,
  viewerIsSuperAdmin,
  status,
  onError,
}: {
  order: OrderDetail["order"];
  viewerIsSuperAdmin: boolean;
  status: { pill: string; label: string };
  onError: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<null | "confirm" | "reject">(null);
  const slipKey = order.slipImageKey;

  async function decide(decision: "confirm" | "reject") {
    if (decision === "reject" && !reason.trim()) return;
    setBusy(decision);
    try {
      await reviewOrderPayment(
        order.id,
        decision,
        decision === "reject" ? reason.trim() : undefined,
      );
      location.reload();
    } catch (e) {
      onError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <>
      <div
        style={{
          ...card,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ ...sectionTitle, marginBottom: 6 }}>ตรวจสอบการชำระเงิน</div>
          <span className={`pill ${status.pill}`}>{status.label}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div style={card}>
          <div style={sectionTitle}>สลิปการชำระเงิน</div>
          {slipKey && viewerIsSuperAdmin ? (
            <img
              src={privateFileUrl(slipKey)}
              alt="สลิปการชำระเงิน"
              style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
            />
          ) : (
            <div style={tableText.subtitle}>
              {slipKey ? "เฉพาะผู้ดูแลระดับสูง" : "ยังไม่มีสลิป"}
            </div>
          )}
        </div>

        <div style={card}>
          <div style={sectionTitle}>ผลการตรวจสอบ</div>
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={busy !== null}
            onClick={() => void decide("confirm")}
          >
            {busy === "confirm" ? "กำลังยืนยัน…" : "ยืนยันการชำระเงิน"}
          </button>

          <div style={{ ...tableText.subtitle, marginTop: 14, marginBottom: 4 }}>
            เหตุผลที่ปฏิเสธ (จำเป็น)
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="เช่น ยอดไม่ตรง, สลิปไม่ชัด…"
            style={{ width: "100%", ...inputS, minHeight: 52 }}
          />
          <button
            type="button"
            className="btn-soft btn-sm"
            disabled={busy !== null || !reason.trim()}
            onClick={() => void decide("reject")}
            style={{ marginTop: 8 }}
          >
            {busy === "reject" ? "กำลังปฏิเสธ…" : "ปฏิเสธสลิป"}
          </button>
          <div style={{ ...tableText.subtitle, marginTop: 8 }}>
            ปฏิเสธแล้วคำสั่งซื้อจะกลับไปที่ “รอชำระเงิน” และให้เวลาลูกค้าใหม่ 48 ชม.
          </div>
        </div>
      </div>
    </>
  );
}
