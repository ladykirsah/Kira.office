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
import { useT } from "../../LangProvider";
import type { Phrase } from "@/lib/lang";

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
const ACTION_LABEL: Record<ClaimState, Phrase> = {
  requested: { th: "แจ้งเคลม", en: "Claim raised" },
  // legacy state, no longer entered
  approved: { th: "อนุมัติเคลม", en: "Claim approved" },
  received: { th: "ได้รับสินค้าแล้ว", en: "Item received" },
  mechanic_approved: { th: "อนุมัติเคลม", en: "Claim approved" },
  mechanic_rejected: { th: "ปฏิเสธ", en: "Rejected" },
  shipped: { th: "จัดส่งสินค้าเคลม", en: "Claim item sent" },
  done: { th: "เสร็จสิ้น", en: "Done" },
  cancelled: { th: "ยกเลิก", en: "Cancelled" },
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
  /** Already translated by OrderDetailView — see the note there. */
  /** Already translated by OrderDetailView — see the note there. */
  status: { pill: string; label: string };
  onError: (m: string) => void;
}) {
  const t = useT();
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
        <span style={tableText.subtitle}>{t({ th: "ขนส่ง", en: "Carrier" })}</span>
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
        <span style={tableText.subtitle}>{t({ th: "เลขพัสดุ", en: "Tracking no." })}</span>
        <input
          value={trackingNo}
          onChange={(e) => setTrackingNo(e.target.value)}
          placeholder="TH…"
          style={{ ...inputS, width: "100%" }}
        />
      </label>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={tableText.subtitle}>
          {t({ th: "ค่าจัดส่ง (บาท)", en: "Shipping fee (฿)" })}
        </span>
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
          <div style={{ ...sectionTitle, marginBottom: 6 }}>
            {t({ th: "จัดการเคลมสินค้า", en: "Handle the claim" })}
          </div>
          <span className={`pill ${status.pill}`}>{status.label}</span>
        </div>
        {isClaimState(claim.state) && (
          <span style={tableText.subtitle}>
            {t({ th: "สถานะเคลม", en: "Claim state" })}:{" "}
            {ACTION_LABEL[claim.state] ? t(ACTION_LABEL[claim.state]) : claim.state}
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
          <div style={sectionTitle}>{t({ th: "รายละเอียดการเคลม", en: "Claim details" })}</div>
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>
            <div>
              <span style={tableText.subtitle}>{t({ th: "สินค้า", en: "Product" })}</span> ·{" "}
              {claimedNames || "—"}
            </div>
            <div>
              <span style={tableText.subtitle}>{t({ th: "แจ้งเมื่อ", en: "Raised" })}</span> ·{" "}
              {formatUpdatedAt(claim.createdAt)}
            </div>

            {/* the customer's choice, above the reason */}
            {claim.resolution && (
              <div style={{ marginTop: 6 }}>
                <span style={tableText.subtitle}>
                  {t({ th: "ลูกค้าเลือก", en: "Customer chose" })}
                </span>{" "}
                ·{" "}
                {isRefund
                  ? t({ th: "รับเงินคืน", en: "a refund" })
                  : t({ th: "เปลี่ยนสินค้าใหม่", en: "a replacement" })}
              </div>
            )}
            {claim.resolution &&
              (isRefund ? (
                <div style={tableText.subtitle}>
                  {!viewerIsSuperAdmin
                    ? t({
                        th: "บัญชีรับเงินคืน · เฉพาะผู้ดูแลระดับสูง",
                        en: "Refund account · super admin only",
                      })
                    : order.refundAccountNo
                      ? `${t({ th: "บัญชี", en: "Account" })} · ${order.refundBankName} · ${order.refundAccountNo} · ${order.refundAccountName}`
                      : t({
                          th: "รอลูกค้าแจ้งบัญชีรับเงินคืน",
                          en: "Waiting for the customer's refund account",
                        })}
                </div>
              ) : (
                <div style={tableText.subtitle}>
                  {t({ th: "ส่งไปที่", en: "Send to" })} · {formatAddress(shipTo)}
                </div>
              ))}

            {claim.reasonNote && (
              <div style={{ marginTop: 4 }}>
                <span style={tableText.subtitle}>
                  {t({ th: "เหตุผลลูกค้า", en: "Customer's reason" })}
                </span>{" "}
                · {claim.reasonNote}
              </div>
            )}
            {claim.assigneeName && (
              <div>
                <span style={tableText.subtitle}>{t({ th: "ผู้รับผิดชอบ", en: "In charge" })}</span>{" "}
                · {claim.assigneeName}
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
                      alt={t({ th: "หลักฐานการเคลม", en: "Claim evidence" })}
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
          <div style={sectionTitle}>{t({ th: "ดำเนินการ", en: "Next step" })}</div>
          {!mayAct ? (
            <div style={tableText.subtitle}>
              {t({ th: "เฉพาะช่างและผู้ดูแลระดับสูง", en: "Mechanics and super admins only" })}
            </div>
          ) : atResolution ? (
            isRefund ? (
              // Refund resolution — money out + the customer's bank are the super-admin's alone.
              !viewerIsSuperAdmin ? (
                <div style={tableText.subtitle}>
                  {t({
                    th: "รอผู้ดูแลระดับสูงคืนเงินให้ลูกค้า",
                    en: "Waiting for a super admin to refund the customer",
                  })}
                </div>
              ) : !order.refundAccountNo ? (
                <div style={tableText.subtitle}>
                  {t({
                    th: "รอลูกค้าแจ้งบัญชีรับเงินคืนก่อนจึงจะคืนเงินได้",
                    en: "The customer's refund account is needed first",
                  })}
                </div>
              ) : !showResolve ? (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setShowResolve(true)}
                >
                  {t({ th: "อนุมัติการเคลม", en: "Approve the claim" })}
                </button>
              ) : (
                <>
                  <div style={{ ...tableText.subtitle, marginBottom: 10 }}>
                    {t({
                      th: "โอนเงินเต็มจำนวนแล้วแนบสลิปการโอนเพื่อยืนยัน",
                      en: "Transfer the full amount, then attach the slip to confirm",
                    })}
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
                      ＋{" "}
                      {slip ? slip.name.slice(0, 18) : t({ th: "เลือกสลิป", en: "Choose a slip" })}
                    </button>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={busy !== null || !slip}
                      onClick={() => void refund()}
                    >
                      {busy === "refund"
                        ? t({ th: "กำลังบันทึก…", en: "Saving…" })
                        : t({ th: "ยืนยันการคืนเงิน", en: "Confirm the refund" })}
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
                {t({ th: "จัดส่งสินค้าเคลม", en: "Send the claim item" })}
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
                  {busy === "shipped"
                    ? t({ th: "กำลังบันทึก…", en: "Saving…" })
                    : t({ th: "ยืนยันการจัดส่ง", en: "Confirm the shipment" })}
                </button>
              </>
            )
          ) : atReturn ? (
            // Rejected (out of T&C / misuse) — no refund/replacement; ship the customer's product
            // back. Same drop-off form as the replacement, just named a return.
            !showResolve ? (
              <>
                <div style={{ ...tableText.subtitle, marginBottom: 10 }}>
                  {t({
                    th: "เคลมไม่ผ่านเงื่อนไข — ส่งสินค้าคืนให้ลูกค้า",
                    en: "Claim not covered — send the item back to the customer",
                  })}
                </div>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setShowResolve(true)}
                >
                  {t({ th: "จัดส่งสินค้าคืน", en: "Send the item back" })}
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
                  {busy === "returned"
                    ? t({ th: "กำลังบันทึก…", en: "Saving…" })
                    : t({ th: "ยืนยันการจัดส่งคืน", en: "Confirm the return" })}
                </button>
              </>
            )
          ) : nexts.length === 0 ? (
            <div style={tableText.subtitle}>
              {t({ th: "ไม่มีขั้นตอนถัดไป", en: "No next step" })}
            </div>
          ) : (
            <>
              {/* Assign the case only at the inspection step (ผลการตรวจสอบ); arrival needs no owner. */}
              {claim.state === "received" && (
                <>
                  <div style={{ ...tableText.subtitle, marginBottom: 4 }}>
                    {t({ th: "ผู้รับผิดชอบ", en: "In charge" })}
                  </div>
                  <select
                    aria-label={t({ th: "ผู้รับผิดชอบ", en: "In charge" })}
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    style={{ ...inputS, width: "100%", marginBottom: 12 }}
                  >
                    <option value="">— {t({ th: "ยังไม่ระบุ", en: "not set" })} —</option>
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
                    {busy === s ? t({ th: "กำลังบันทึก…", en: "Saving…" }) : t(ACTION_LABEL[s])}
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
                    {t(ACTION_LABEL[s])}
                  </button>
                ))}
              </div>
              {denyTarget && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ ...tableText.subtitle, marginBottom: 4 }}>
                    {t({ th: "เหตุผล (แจ้งลูกค้า)", en: "Reason (shown to the customer)" })}
                  </div>
                  <textarea
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder={t({
                      th: "เช่น ไม่เข้าเงื่อนไขการรับประกัน, ลูกค้าใช้งานผิดวิธี…",
                      en: "e.g. not covered by warranty, used incorrectly…",
                    })}
                    style={{ width: "100%", ...inputS, minHeight: 52 }}
                  />
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    disabled={busy !== null || !reason.trim()}
                    onClick={() => void go(denyTarget, reason)}
                    style={{ marginTop: 8 }}
                  >
                    {busy === denyTarget
                      ? t({ th: "กำลังบันทึก…", en: "Saving…" })
                      : t({ th: "ยืนยัน", en: "Confirm" })}
                  </button>
                  <div style={{ ...tableText.subtitle, marginTop: 8 }}>
                    {t({
                      th: "ลูกค้าจะเห็นเหตุผลบนหน้าติดตามคำสั่งซื้อ",
                      en: "The customer sees this reason on their order tracking page",
                    })}
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
