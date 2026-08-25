"use client";

import { useRef, useState } from "react";
import { recordRefund, privateFileUrl, type OrderDetail } from "@/lib/api";
import { formatBahtTrim, formatUpdatedAt } from "@/lib/format";
import { tableText } from "@/lib/tableText";
import { card, sectionTitle } from "./cardStyles";
import { useT } from "../../LangProvider";

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
  /** Already translated by OrderDetailView — see the note there. */
  status: { pill: string; label: string };
  onError: (message: string) => void;
}) {
  const t = useT();
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
            {refundAction === "refunded"
              ? t({ th: "คืนเงินแล้ว (พัสดุตีกลับ)", en: "Refunded (parcel bounced back)" })
              : t({ th: "คืนเงิน (พัสดุตีกลับ)", en: "Refund (parcel bounced back)" })}
          </div>
          <span className={`pill ${status.pill}`}>{status.label}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={tableText.subtitle}>
            {t({ th: "ยอดคืนเต็มจำนวน", en: "Full amount refunded" })}
          </div>
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
            <div style={sectionTitle}>{t({ th: "หลักฐานการคืนเงิน", en: "Proof of refund" })}</div>
            {order.refundSlipImageKey ? (
              <img
                src={privateFileUrl(order.refundSlipImageKey)}
                alt={t({ th: "สลิปการคืนเงิน", en: "Refund slip" })}
                style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
              />
            ) : (
              <div style={tableText.subtitle}>{t({ th: "ไม่มีสลิป", en: "No slip" })}</div>
            )}
          </div>
          <div style={card}>
            <div style={sectionTitle}>{t({ th: "รายละเอียด", en: "Details" })}</div>
            <div style={{ fontSize: 14, lineHeight: 1.9 }}>
              <div>
                {t({ th: "คืนเมื่อ", en: "Refunded on" })}:{" "}
                {order.refundedAt ? formatUpdatedAt(order.refundedAt) : "—"}
              </div>
              <div>
                {t({ th: "โดย", en: "By" })}: {order.refundActorEmail ?? "—"}
              </div>
              {viewerIsSuperAdmin && hasBank && (
                <div style={{ marginTop: 8, color: "var(--text-muted)" }}>
                  {t({ th: "โอนเข้า", en: "Into" })}: {order.refundBankName} ·{" "}
                  {order.refundAccountNo} · {order.refundAccountName}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={gridStyle}>
          <div style={card}>
            <div style={sectionTitle}>
              {t({ th: "บัญชีรับเงินคืนของลูกค้า", en: "The customer's refund account" })}
            </div>
            {!viewerIsSuperAdmin ? (
              <div style={tableText.subtitle}>
                {t({ th: "เฉพาะผู้ดูแลระดับสูง", en: "Super admin only" })}
              </div>
            ) : hasBank ? (
              <div style={{ fontSize: 14, lineHeight: 1.9 }}>
                <div>
                  <span style={tableText.subtitle}>{t({ th: "ธนาคาร", en: "Bank" })}</span> ·{" "}
                  {order.refundBankName}
                </div>
                <div>
                  <span style={tableText.subtitle}>{t({ th: "เลขบัญชี", en: "Account no." })}</span>{" "}
                  · {order.refundAccountNo}
                </div>
                <div>
                  <span style={tableText.subtitle}>
                    {t({ th: "ชื่อบัญชี", en: "Account name" })}
                  </span>{" "}
                  · {order.refundAccountName}
                </div>
              </div>
            ) : (
              <div style={tableText.subtitle}>
                {t({
                  th: "รอลูกค้าแจ้งบัญชีรับเงินคืนบนหน้าเว็บ AirPlus",
                  en: "Waiting for the customer to give their refund account on the AirPlus site",
                })}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={sectionTitle}>{t({ th: "บันทึกการคืนเงิน", en: "Record the refund" })}</div>
            {!viewerIsSuperAdmin ? (
              <div style={tableText.subtitle}>
                {t({
                  th: "รอผู้ดูแลระดับสูงดำเนินการคืนเงิน",
                  en: "Waiting for a super admin to make the refund",
                })}
              </div>
            ) : !hasBank ? (
              <div style={tableText.subtitle}>
                {t({
                  th: "ต้องมีบัญชีของลูกค้าก่อนจึงจะคืนเงินได้",
                  en: "The customer's account is needed before a refund can be made",
                })}
              </div>
            ) : (
              <>
                <div style={{ ...tableText.subtitle, marginBottom: 10 }}>
                  {t({
                    th: "โอนเงินเต็มจำนวนแล้วแนบสลิปการโอนเพื่อยืนยัน",
                    en: "Transfer the full amount, then attach the slip to confirm",
                  })}
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
                    ＋ {file ? file.name.slice(0, 18) : t({ th: "เลือกสลิป", en: "Choose a slip" })}
                  </button>
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={busy || !file}
                    onClick={() => void submit()}
                  >
                    {busy
                      ? t({ th: "กำลังบันทึก…", en: "Saving…" })
                      : t({ th: "ยืนยันการคืนเงิน", en: "Confirm the refund" })}
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
