"use client";

import { useState } from "react";
import { transitionOrderClaim, privateFileUrl, type OrderDetail } from "@/lib/api";
import { canReviewClaim } from "@l-shopee/core";
import { formatUpdatedAt } from "@/lib/format";
import { tableText } from "@/lib/tableText";
import { inputS } from "@/lib/inputStyles";
import { card, sectionTitle } from "./cardStyles";

/**
 * Zone A for a defect claim awaiting the approve/reject decision (a `requested` claim → claim_pending).
 * The mechanic's and super-admin's call — a plain admin sees the info but the actions are DISABLED.
 * Approve moves the claim to `approved` (awaiting the customer's return); reject needs a reason, shown
 * to the customer on their AirPlus order page, and returns the order to `delivered`. Full-width on top,
 * per the layout standard, with a two-step reject like the slip review.
 */
export function ClaimReviewSection({
  claim,
  lines,
  viewerRole,
  mechanics,
  status,
  onError,
}: {
  claim: OrderDetail["claims"][number];
  lines: OrderDetail["lines"];
  viewerRole: OrderDetail["viewerRole"];
  mechanics: string[];
  status: { pill: string; label: string };
  onError: (m: string) => void;
}) {
  const [assignee, setAssignee] = useState(claim.assigneeName ?? "");
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const mayAct = canReviewClaim(viewerRole);

  // The claimed products: the claim's own lines mapped to the order's line names, else the whole order.
  const claimedNames =
    claim.lines.length > 0
      ? claim.lines
          .map((cl) => lines.find((l) => l.id === cl.salesOrderLineId)?.name ?? cl.salesOrderLineId)
          .join(", ")
      : lines
          .map((l) => l.name)
          .filter(Boolean)
          .join(", ");

  async function decide(to: "approved" | "cancelled") {
    if (to === "cancelled" && !reason.trim()) return;
    setBusy(to === "approved" ? "approve" : "reject");
    try {
      await transitionOrderClaim(claim.id, to, {
        assignee: assignee.trim() || undefined,
        reason: to === "cancelled" ? reason.trim() : undefined,
      });
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
          <div style={{ ...sectionTitle, marginBottom: 6 }}>ตรวจสอบการเคลมสินค้า</div>
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
        {/* the defect: product, date, customer reason, evidence photos */}
        <div style={card}>
          <div style={sectionTitle}>รายละเอียดการเคลม</div>
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>
            <div>
              <span style={tableText.subtitle}>สินค้า</span> · {claimedNames || "—"}
            </div>
            <div>
              <span style={tableText.subtitle}>แจ้งเมื่อ</span> · {formatUpdatedAt(claim.createdAt)}
            </div>
            {claim.reasonNote && (
              <div style={{ marginTop: 4 }}>
                <span style={tableText.subtitle}>เหตุผลลูกค้า</span> · {claim.reasonNote}
              </div>
            )}
          </div>
          {claim.photoKeys.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {claim.photoKeys.map((k) => (
                <a key={k} href={privateFileUrl(k)} target="_blank" rel="noreferrer">
                  <img
                    src={privateFileUrl(k)}
                    alt="หลักฐานการเคลม"
                    style={{
                      width: 84,
                      height: 84,
                      objectFit: "cover",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* the decision — mechanic + super-admin only */}
        <div style={card}>
          <div style={sectionTitle}>ผลการตรวจสอบ</div>
          {!mayAct ? (
            <div style={tableText.subtitle}>เฉพาะช่างและผู้ดูแลระดับสูง</div>
          ) : (
            <>
              <div style={{ ...tableText.subtitle, marginBottom: 4 }}>ผู้รับผิดชอบ</div>
              <select
                aria-label="ผู้รับผิดชอบ"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                style={{ ...inputS, width: "100%", marginBottom: 12 }}
              >
                <option value="">— ยังไม่ระบุ —</option>
                {mechanics.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {/* Both choices together; reject is two-step so a claim is never denied in one click. */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={busy !== null}
                  onClick={() => void decide("approved")}
                >
                  {busy === "approve" ? "กำลังอนุมัติ…" : "อนุมัติเคลม"}
                </button>
                <button
                  type="button"
                  className="btn-soft btn-sm"
                  disabled={busy !== null}
                  onClick={() => setRejecting((r) => !r)}
                >
                  ปฏิเสธ
                </button>
              </div>
              {rejecting && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ ...tableText.subtitle, marginBottom: 4 }}>
                    เหตุผลที่ปฏิเสธ (แจ้งลูกค้า)
                  </div>
                  <textarea
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="เช่น ไม่พบความชำรุด, เกินระยะประกัน…"
                    style={{ width: "100%", ...inputS, minHeight: 52 }}
                  />
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    disabled={busy !== null || !reason.trim()}
                    onClick={() => void decide("cancelled")}
                    style={{ marginTop: 8 }}
                  >
                    {busy === "reject" ? "กำลังปฏิเสธ…" : "ยืนยันการปฏิเสธ"}
                  </button>
                  <div style={{ ...tableText.subtitle, marginTop: 8 }}>
                    ปฏิเสธแล้วลูกค้าจะเห็นเหตุผลบนหน้าติดตามคำสั่งซื้อ
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
