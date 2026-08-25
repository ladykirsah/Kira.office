"use client";

import { useState } from "react";
import { reviewOrderPayment, privateFileUrl, type OrderDetail } from "@/lib/api";
import { tableText } from "@/lib/tableText";
import { inputS } from "@/lib/inputStyles";
import { card, sectionTitle } from "./cardStyles";
import { useT } from "../../LangProvider";

/**
 * Zone A for a `verifying` order (owner, 31 Jul 2026): the one thing to do is decide the uploaded
 * slip. Any admin may confirm or reject; the slip IMAGE is super-admin-only (a regular admin sees a
 * note instead). Confirm settles the order; reject needs a reason and returns it to pending with a
 * fresh 48h window. Full-width at the top of the page, per the layout standard.
 */
export function PaymentReviewSection({
  order,
  viewerIsSuperAdmin,
  canAct,
  status,
  onError,
}: {
  order: OrderDetail["order"];
  viewerIsSuperAdmin: boolean;
  /** Payment review is the super-admin's + admin's action; a mechanic sees it read-only. */
  canAct: boolean;
  /** Already translated by OrderDetailView — see the note there. */
  status: { pill: string; label: string };
  onError: (message: string) => void;
}) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
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
          <div style={{ ...sectionTitle, marginBottom: 6 }}>
            {t({ th: "ตรวจสอบการชำระเงิน", en: "Review the payment" })}
          </div>
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
          <div style={sectionTitle}>{t({ th: "สลิปการชำระเงิน", en: "Payment slip" })}</div>
          {slipKey && viewerIsSuperAdmin ? (
            <img
              src={privateFileUrl(slipKey)}
              alt={t({ th: "สลิปการชำระเงิน", en: "Payment slip" })}
              style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
            />
          ) : (
            <div style={tableText.subtitle}>
              {slipKey
                ? t({ th: "เฉพาะผู้ดูแลระดับสูง", en: "Super admin only" })
                : t({ th: "ยังไม่มีสลิป", en: "No slip yet" })}
            </div>
          )}
        </div>

        <div style={card}>
          <div style={sectionTitle}>{t({ th: "ผลการตรวจสอบ", en: "Your decision" })}</div>
          {!canAct && (
            <div style={tableText.subtitle}>
              {t({ th: "เฉพาะผู้ดูแลระดับสูงและผู้ดูแล", en: "Super admin and admin only" })}
            </div>
          )}
          {/* The two choices together. Reject is a two-step: it just opens the reason box below,
              so a slip is never rejected in one careless click. */}
          <div style={{ display: canAct ? "flex" : "none", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={busy !== null}
              onClick={() => void decide("confirm")}
            >
              {busy === "confirm"
                ? t({ th: "กำลังยืนยัน…", en: "Confirming…" })
                : t({ th: "ยืนยันการชำระเงิน", en: "Confirm payment" })}
            </button>
            <button
              type="button"
              className="btn-soft btn-sm"
              disabled={busy !== null}
              onClick={() => setRejecting((r) => !r)}
            >
              {t({ th: "ปฏิเสธ", en: "Reject" })}
            </button>
          </div>

          {rejecting && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...tableText.subtitle, marginBottom: 4 }}>
                {t({ th: "เหตุผลที่ปฏิเสธ (จำเป็น)", en: "Reason for rejecting (required)" })}
              </div>
              <textarea
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder={t({
                  th: "เช่น ยอดไม่ตรง, สลิปไม่ชัด…",
                  en: "e.g. amount does not match, slip unreadable…",
                })}
                style={{ width: "100%", ...inputS, minHeight: 52 }}
              />
              <button
                type="button"
                className="btn-danger btn-sm"
                disabled={busy !== null || !reason.trim()}
                onClick={() => void decide("reject")}
                style={{ marginTop: 8 }}
              >
                {busy === "reject"
                  ? t({ th: "กำลังปฏิเสธ…", en: "Rejecting…" })
                  : t({ th: "ยืนยันการปฏิเสธ", en: "Confirm rejection" })}
              </button>
              <div style={{ ...tableText.subtitle, marginTop: 8 }}>
                {t({
                  th: "ปฏิเสธแล้วคำสั่งซื้อจะกลับไปที่ “รอชำระเงิน” และให้เวลาลูกค้าใหม่ 48 ชม.",
                  en: "Rejecting sends the order back to “Unpaid” and gives the customer another 48 hours.",
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
