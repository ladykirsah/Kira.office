"use client";

import { useRef, useState } from "react";
import { recordRefund, privateFileUrl, type OrderDetail } from "@/lib/api";
import { formatBahtTrim, formatUpdatedAt } from "@/lib/format";
import { tableText } from "@/lib/tableText";
import { card, sectionTitle } from "./cardStyles";

/**
 * Zone A for a bounced (delivery_failed) order whose money we hold — the failed-delivery refund, the
 * one refund path the system tracks (every other return/claim is handled via LINE OA).
 *
 * needs_refund: the customer submits their payout bank account on the storefront; a SUPER-ADMIN sees
 * it here (the account is financial PII, redacted for any other admin), transfers the full amount by
 * hand, then uploads OUR outgoing slip and marks it refunded. refunded: a compact evidence block with
 * that slip, readable by any admin. Full-width at the top of the page, per the layout standard.
 */
export function RefundSection({
  order,
  refundAction,
  viewerIsSuperAdmin,
  status,
  onError,
}: {
  order: OrderDetail["order"];
  refundAction: "needs_refund" | "refunded";
  viewerIsSuperAdmin: boolean;
  status: { pill: string; label: string };
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasBank = !!order.refundAccountNo;

  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      await recordRefund(order.id, file);
      location.reload();
    } catch (e) {
      onError((e as Error).message);
      setBusy(false);
    }
  }

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
    alignItems: "start",
  } as const;

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
            {refundAction === "refunded" ? "คืนเงินแล้ว (พัสดุตีกลับ)" : "คืนเงิน (พัสดุตีกลับ)"}
          </div>
          <span className={`pill ${status.pill}`}>{status.label}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={tableText.subtitle}>ยอดคืนเต็มจำนวน</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>
            {formatBahtTrim(
              refundAction === "refunded" ? (order.refundSatang ?? 0) : order.grandTotalSatang,
            )}
          </div>
        </div>
      </div>

      {refundAction === "refunded" ? (
        <div style={gridStyle}>
          <div style={card}>
            <div style={sectionTitle}>หลักฐานการคืนเงิน</div>
            {order.refundSlipImageKey ? (
              <img
                src={privateFileUrl(order.refundSlipImageKey)}
                alt="สลิปการคืนเงิน"
                style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
              />
            ) : (
              <div style={tableText.subtitle}>ไม่มีสลิป</div>
            )}
          </div>
          <div style={card}>
            <div style={sectionTitle}>รายละเอียด</div>
            <div style={{ fontSize: 14, lineHeight: 1.9 }}>
              <div>คืนเมื่อ: {order.refundedAt ? formatUpdatedAt(order.refundedAt) : "—"}</div>
              <div>โดย: {order.refundActorEmail ?? "—"}</div>
              {viewerIsSuperAdmin && hasBank && (
                <div style={{ marginTop: 8, color: "var(--text-muted)" }}>
                  โอนเข้า: {order.refundBankName} · {order.refundAccountNo} ·{" "}
                  {order.refundAccountName}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={gridStyle}>
          <div style={card}>
            <div style={sectionTitle}>บัญชีรับเงินคืนของลูกค้า</div>
            {!viewerIsSuperAdmin ? (
              <div style={tableText.subtitle}>เฉพาะผู้ดูแลระดับสูง</div>
            ) : hasBank ? (
              <div style={{ fontSize: 14, lineHeight: 1.9 }}>
                <div>
                  <span style={tableText.subtitle}>ธนาคาร</span> · {order.refundBankName}
                </div>
                <div>
                  <span style={tableText.subtitle}>เลขบัญชี</span> · {order.refundAccountNo}
                </div>
                <div>
                  <span style={tableText.subtitle}>ชื่อบัญชี</span> · {order.refundAccountName}
                </div>
              </div>
            ) : (
              <div style={tableText.subtitle}>รอลูกค้าแจ้งบัญชีรับเงินคืนบนหน้าเว็บ AirPlus</div>
            )}
          </div>

          <div style={card}>
            <div style={sectionTitle}>บันทึกการคืนเงิน</div>
            {!viewerIsSuperAdmin ? (
              <div style={tableText.subtitle}>รอผู้ดูแลระดับสูงดำเนินการคืนเงิน</div>
            ) : !hasBank ? (
              <div style={tableText.subtitle}>ต้องมีบัญชีของลูกค้าก่อนจึงจะคืนเงินได้</div>
            ) : (
              <>
                <div style={{ ...tableText.subtitle, marginBottom: 10 }}>
                  โอนเงินเต็มจำนวนแล้วแนบสลิปการโอนเพื่อยืนยัน
                </div>
                {/* The same picker the affiliate/banner editors use: a styled ＋ button over a hidden
                    input, beside the primary action — no raw "Choose File / No file chosen" control. */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn-sm"
                    onClick={() => fileRef.current?.click()}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    ＋ {file ? file.name.slice(0, 18) : "เลือกสลิป"}
                  </button>
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={busy || !file}
                    onClick={() => void submit()}
                  >
                    {busy ? "กำลังบันทึก…" : "ยืนยันการคืนเงิน"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
