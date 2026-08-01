"use client";

import { useRef, useState } from "react";
import {
  transitionOrderClaim,
  recordClaimRefund,
  recordClaimReturnShipment,
  privateFileUrl,
  type OrderDetail,
} from "@/lib/api";
import {
  canReviewClaim,
  isClaimState,
  nextClaimStates,
  CARRIERS,
  DEFAULT_CARRIER,
  type ClaimState,
} from "@l-shopee/core";
import { formatUpdatedAt } from "@/lib/format";
import { tableText } from "@/lib/tableText";
import { inputS } from "@/lib/inputStyles";
import { card, sectionTitle } from "./cardStyles";

/**
 * Zone A for the ACTIVE defect claim — full-width on top for its whole life. No pre-approve gate:
 * requested → confirm arrival (received) / reject, received → mechanic verdict, mechanic_approved →
 * RESOLVE, shipped → done. A claim is a requested action at every step, so it stays here until it is
 * terminal (done / cancelled / rejected), then drops to the Claims card.
 *
 * The resolution the customer picked when they filed the claim drives the last step:
 *  - refund  → the super-admin uploads OUR transfer slip (money + bank PII are the super-admin's alone,
 *              exactly like the failed-delivery refund) and the claim closes;
 *  - exchange → a drop-off form (carrier · tracking) ships the replacement, then it closes.
 *
 * The mechanic's and super-admin's call — a plain admin sees the info but the actions are DISABLED.
 * Any "deny" move (cancel, or the mechanic finding no fault) needs a reason, shown to the customer on
 * their AirPlus order page, and is two-step so a claim is never denied in one careless click.
 */

/** The action verb on each transition button (the target state). */
const ACTION_LABEL: Record<ClaimState, string> = {
  requested: "แจ้งเคลม",
  approved: "อนุมัติเคลม", // legacy state, no longer entered
  received: "ได้รับสินค้าแล้ว",
  mechanic_approved: "อนุมัติเคลม",
  mechanic_rejected: "ปฏิเสธ",
  shipped: "จัดส่งสินค้าเคลม",
  done: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

/** Moves the customer must be told the reason for. */
const REASON_REQUIRED = new Set<ClaimState>(["cancelled", "mechanic_rejected"]);

/** One-line address for the replacement drop-off. */
function formatAddress(a: OrderDetail["address"]): string {
  if (!a) return "—";
  return [
    a.recipientName,
    a.phone,
    a.addressLine1,
    a.subdistrict,
    a.district,
    a.province,
    a.postalCode,
  ]
    .filter(Boolean)
    .join(" ");
}

export function ClaimReviewSection({
  claim,
  order,
  address,
  lines,
  viewerRole,
  viewerIsSuperAdmin,
  mechanics,
  status,
  onError,
}: {
  claim: OrderDetail["claims"][number];
  order: OrderDetail["order"];
  address: OrderDetail["address"];
  lines: OrderDetail["lines"];
  viewerRole: OrderDetail["viewerRole"];
  viewerIsSuperAdmin: boolean;
  mechanics: string[];
  status: { pill: string; label: string };
  onError: (m: string) => void;
}) {
  const [assignee, setAssignee] = useState(claim.assigneeName ?? "");
  const [reason, setReason] = useState("");
  const [denyTarget, setDenyTarget] = useState<ClaimState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // The mechanic_approved resolution step: a two-step reveal so the money/ship action is deliberate.
  const [showResolve, setShowResolve] = useState(false);
  const [slip, setSlip] = useState<File | null>(null);
  const slipRef = useRef<HTMLInputElement>(null);
  const [carrier, setCarrier] = useState<string>(DEFAULT_CARRIER);
  const [trackingNo, setTrackingNo] = useState("");
  const [shippingFee, setShippingFee] = useState(""); // baht, what the carrier charged us

  // The replacement's carrier fee, in satang — required to ship, so it lands in the books.
  const shipFeeSatang = Math.round(Number(shippingFee) * 100);
  const shipFeeOk =
    shippingFee.trim() !== "" && Number.isFinite(shipFeeSatang) && shipFeeSatang >= 0;

  const mayAct = canReviewClaim(viewerRole);
  const isRefund = claim.resolution === "refund";
  // The claim has passed the mechanic and now needs resolving (refund paid, or replacement shipped).
  const atResolution = claim.state === "mechanic_approved";
  // A rejected claim (out of T&C / misuse) whose product we still owe back to the customer.
  const atReturn = claim.state === "mechanic_rejected" && !claim.trackingNo;
  const shipTo = claim.replacementAddress ?? address;

  const nexts = isClaimState(claim.state) ? nextClaimStates(claim.state) : [];
  const positive = nexts.filter((s) => !REASON_REQUIRED.has(s));
  const deny = nexts.filter((s) => REASON_REQUIRED.has(s));

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

  async function go(to: ClaimState, reasonText?: string) {
    if (REASON_REQUIRED.has(to) && !reasonText?.trim()) return;
    setBusy(to);
    try {
      await transitionOrderClaim(claim.id, to, {
        assignee: assignee.trim() || undefined,
        reason: reasonText?.trim() || undefined,
      });
      location.reload();
    } catch (e) {
      onError((e as Error).message);
      setBusy(null);
    }
  }

  /** Exchange resolution: hand the replacement to the carrier (mechanic_approved → shipped). */
  async function shipReplacement() {
    if (!trackingNo.trim() || !shipFeeOk) return;
    setBusy("shipped");
    try {
      await transitionOrderClaim(claim.id, "shipped", {
        assignee: assignee.trim() || undefined,
        carrier,
        trackingNo: trackingNo.trim(),
        shippingFeeSatang: shipFeeSatang,
      });
      location.reload();
    } catch (e) {
      onError((e as Error).message);
      setBusy(null);
    }
  }

  /** Rejected claim: ship the customer's own product back (no refund, no replacement). */
  async function shipReturn() {
    if (!trackingNo.trim() || !shipFeeOk) return;
    setBusy("returned");
    try {
      await recordClaimReturnShipment(claim.id, {
        carrier,
        trackingNo: trackingNo.trim(),
        shippingFeeSatang: shipFeeSatang,
      });
      location.reload();
    } catch (e) {
      onError((e as Error).message);
      setBusy(null);
    }
  }

  /** Refund resolution: record OUR transfer slip and close the claim (super-admin only). */
  async function refund() {
    if (!slip) return;
    setBusy("refund");
    try {
      await recordClaimRefund(claim.id, slip);
      location.reload();
    } catch (e) {
      onError((e as Error).message);
      setBusy(null);
    }
  }

  // Carrier + tracking + fee — the SAME drop-off fields for a replacement (approved) and a return
  // (rejected). Only the surrounding heading and submit handler differ.
  const shipFieldsGrid = (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={tableText.subtitle}>ขนส่ง</span>
        <select
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          style={{ ...inputS, width: "100%" }}
        >
          {CARRIERS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={tableText.subtitle}>เลขพัสดุ</span>
        <input
          value={trackingNo}
          onChange={(e) => setTrackingNo(e.target.value)}
          placeholder="TH…"
          style={{ ...inputS, width: "100%" }}
        />
      </label>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={tableText.subtitle}>ค่าจัดส่ง (บาท)</span>
        <input
          value={shippingFee}
          onChange={(e) => setShippingFee(e.target.value)}
          inputMode="decimal"
          placeholder="90.00"
          style={{ ...inputS, width: "100%" }}
        />
      </label>
    </div>
  );

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
          <div style={{ ...sectionTitle, marginBottom: 6 }}>จัดการเคลมสินค้า</div>
          <span className={`pill ${status.pill}`}>{status.label}</span>
        </div>
        {isClaimState(claim.state) && (
          <span style={tableText.subtitle}>
            สถานะเคลม: {ACTION_LABEL[claim.state] ?? claim.state}
          </span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* the defect: product, date, the customer's chosen resolution, reason, evidence */}
        <div style={card}>
          <div style={sectionTitle}>รายละเอียดการเคลม</div>
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>
            <div>
              <span style={tableText.subtitle}>สินค้า</span> · {claimedNames || "—"}
            </div>
            <div>
              <span style={tableText.subtitle}>แจ้งเมื่อ</span> · {formatUpdatedAt(claim.createdAt)}
            </div>

            {/* the customer's choice, above the reason */}
            {claim.resolution && (
              <div style={{ marginTop: 6 }}>
                <span style={tableText.subtitle}>ลูกค้าเลือก</span> ·{" "}
                {isRefund ? "รับเงินคืน" : "เปลี่ยนสินค้าใหม่"}
              </div>
            )}
            {claim.resolution &&
              (isRefund ? (
                <div style={tableText.subtitle}>
                  {!viewerIsSuperAdmin
                    ? "บัญชีรับเงินคืน · เฉพาะผู้ดูแลระดับสูง"
                    : order.refundAccountNo
                      ? `บัญชี · ${order.refundBankName} · ${order.refundAccountNo} · ${order.refundAccountName}`
                      : "รอลูกค้าแจ้งบัญชีรับเงินคืน"}
                </div>
              ) : (
                <div style={tableText.subtitle}>ส่งไปที่ · {formatAddress(shipTo)}</div>
              ))}

            {claim.reasonNote && (
              <div style={{ marginTop: 4 }}>
                <span style={tableText.subtitle}>เหตุผลลูกค้า</span> · {claim.reasonNote}
              </div>
            )}
            {claim.assigneeName && (
              <div>
                <span style={tableText.subtitle}>ผู้รับผิดชอบ</span> · {claim.assigneeName}
              </div>
            )}
          </div>
          {claim.photoKeys.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {claim.photoKeys.map((k) =>
                /\.(mp4|mov|webm|m4v)$/i.test(k) ? (
                  <video
                    key={k}
                    src={privateFileUrl(k)}
                    controls
                    style={{
                      width: 140,
                      height: 84,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "#000",
                    }}
                  />
                ) : (
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
                ),
              )}
            </div>
          )}
        </div>

        {/* the current step's action — mechanic + super-admin only */}
        <div style={card}>
          <div style={sectionTitle}>ดำเนินการ</div>
          {!mayAct ? (
            <div style={tableText.subtitle}>เฉพาะช่างและผู้ดูแลระดับสูง</div>
          ) : atResolution ? (
            isRefund ? (
              // Refund resolution — money out + the customer's bank are the super-admin's alone.
              !viewerIsSuperAdmin ? (
                <div style={tableText.subtitle}>รอผู้ดูแลระดับสูงคืนเงินให้ลูกค้า</div>
              ) : !order.refundAccountNo ? (
                <div style={tableText.subtitle}>รอลูกค้าแจ้งบัญชีรับเงินคืนก่อนจึงจะคืนเงินได้</div>
              ) : !showResolve ? (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setShowResolve(true)}
                >
                  อนุมัติการเคลม
                </button>
              ) : (
                <>
                  <div style={{ ...tableText.subtitle, marginBottom: 10 }}>
                    โอนเงินเต็มจำนวนแล้วแนบสลิปการโอนเพื่อยืนยัน
                  </div>
                  {/* The same picker the affiliate/refund editors use: a styled ＋ button over a hidden
                      input, beside the primary action — no raw "Choose File" control. */}
                  <input
                    ref={slipRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => setSlip(e.target.files?.[0] ?? null)}
                  />
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn-sm"
                      onClick={() => slipRef.current?.click()}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      ＋ {slip ? slip.name.slice(0, 18) : "เลือกสลิป"}
                    </button>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={busy !== null || !slip}
                      onClick={() => void refund()}
                    >
                      {busy === "refund" ? "กำลังบันทึก…" : "ยืนยันการคืนเงิน"}
                    </button>
                  </div>
                </>
              )
            ) : // Exchange resolution — ship the replacement with a carrier + tracking + fee.
            !showResolve ? (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => setShowResolve(true)}
              >
                จัดส่งสินค้าเคลม
              </button>
            ) : (
              <>
                {shipFieldsGrid}
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={busy !== null || !trackingNo.trim() || !shipFeeOk}
                  onClick={() => void shipReplacement()}
                  style={{ marginTop: 10 }}
                >
                  {busy === "shipped" ? "กำลังบันทึก…" : "ยืนยันการจัดส่ง"}
                </button>
              </>
            )
          ) : atReturn ? (
            // Rejected (out of T&C / misuse) — no refund/replacement; ship the customer's product
            // back. Same drop-off form as the replacement, just named a return.
            !showResolve ? (
              <>
                <div style={{ ...tableText.subtitle, marginBottom: 10 }}>
                  เคลมไม่ผ่านเงื่อนไข — ส่งสินค้าคืนให้ลูกค้า
                </div>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setShowResolve(true)}
                >
                  จัดส่งสินค้าคืน
                </button>
              </>
            ) : (
              <>
                {shipFieldsGrid}
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={busy !== null || !trackingNo.trim() || !shipFeeOk}
                  onClick={() => void shipReturn()}
                  style={{ marginTop: 10 }}
                >
                  {busy === "returned" ? "กำลังบันทึก…" : "ยืนยันการจัดส่งคืน"}
                </button>
              </>
            )
          ) : nexts.length === 0 ? (
            <div style={tableText.subtitle}>ไม่มีขั้นตอนถัดไป</div>
          ) : (
            <>
              {/* Assign the case only at the inspection step (ผลการตรวจสอบ); arrival needs no owner. */}
              {claim.state === "received" && (
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
                </>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {positive.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={busy !== null}
                    onClick={() => void go(s)}
                  >
                    {busy === s ? "กำลังบันทึก…" : ACTION_LABEL[s]}
                  </button>
                ))}
                {deny.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="btn-soft btn-sm"
                    disabled={busy !== null}
                    onClick={() => setDenyTarget((d) => (d === s ? null : s))}
                  >
                    {ACTION_LABEL[s]}
                  </button>
                ))}
              </div>
              {denyTarget && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ ...tableText.subtitle, marginBottom: 4 }}>เหตุผล (แจ้งลูกค้า)</div>
                  <textarea
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="เช่น ไม่เข้าเงื่อนไขการรับประกัน, ลูกค้าใช้งานผิดวิธี…"
                    style={{ width: "100%", ...inputS, minHeight: 52 }}
                  />
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    disabled={busy !== null || !reason.trim()}
                    onClick={() => void go(denyTarget, reason)}
                    style={{ marginTop: 8 }}
                  >
                    {busy === denyTarget ? "กำลังบันทึก…" : "ยืนยัน"}
                  </button>
                  <div style={{ ...tableText.subtitle, marginTop: 8 }}>
                    ลูกค้าจะเห็นเหตุผลบนหน้าติดตามคำสั่งซื้อ
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
