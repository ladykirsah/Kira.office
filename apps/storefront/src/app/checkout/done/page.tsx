"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PromptPayQr } from "@/components/PromptPayQr";
import { SaveQrButton } from "@/components/SaveQrButton";
import { SlipUpload } from "@/components/SlipUpload";
import { Icon } from "@/components/Icon";
import type { CheckoutSuccess } from "@/lib/checkoutApi";
import { baht } from "@/lib/format";

/**
 * Order confirmation (Design C, owner-picked 2026-07-16). Reads the just-placed order from
 * sessionStorage (written by checkout). The order is PLACED but — for prepaid methods — not yet
 * PAID, so the page shows a รอชำระเงิน status and the actual way to pay right here: a PromptPay QR,
 * or the shop's bank account (copyable) for a transfer. The green check confirms the ORDER, never
 * the payment.
 */

/**
 * MOCK bank account. The shop's real account is managed in Kira.office (the back office), which is
 * not wired to the storefront yet — this hardcodes one so the AirPlus transfer flow is testable
 * end to end. Swap for live shop-settings data when that lands.
 */
const MOCK_BANK = {
  bank: "ธนาคารกสิกรไทย",
  accountNo: "123-4-56789-0",
  accountName: "บจก. เด่น แอร์ เซอร์วิส",
};

/**
 * MOCK PromptPay target — same rationale as MOCK_BANK: the shop's real PromptPay ID is managed in
 * Kira.office and not yet wired to the storefront, so an order placed before that lands has no
 * promptpayId. This valid-format demo phone lets the PromptPay QR flow render end to end on staging;
 * it is clearly labelled a demo below the QR and is NOT a real receiving account. Swap for live
 * shop-settings data when that lands (then the mock branch simply never runs).
 */
const MOCK_PROMPTPAY_ID = "0812345678";

type LastOrder = CheckoutSuccess & { phone: string };

function parseLastOrder(raw: string | null): LastOrder | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as LastOrder;
    if (typeof o?.ref !== "string" || typeof o?.amountSatang !== "number") return null;
    return o;
  } catch {
    return null;
  }
}

export default function CheckoutDonePage() {
  // undefined = not read yet (sessionStorage is client-only); null = nothing stored.
  const [order, setOrder] = useState<LastOrder | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [copiedAcct, setCopiedAcct] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null); // wraps the QR SVG so "Save QR" can rasterize it

  useEffect(() => {
    setOrder(parseLastOrder(window.sessionStorage.getItem("airplus.lastOrder")));
  }, []);

  if (order === undefined) return null;

  if (order === null) {
    return (
      <div className="section" style={{ maxWidth: 480, margin: "40px auto" }}>
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p className="t-h4" style={{ margin: "0 0 16px" }}>
            ไม่พบข้อมูลคำสั่งซื้อล่าสุด
          </p>
          <Link href="/" className="btn btn-primary">
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    );
  }

  async function copyRef() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.ref);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. non-HTTPS) — the ref is on screen, nothing to recover.
    }
  }

  async function copyAccount() {
    try {
      // Copy the bare digits — easiest to paste straight into a banking app.
      await navigator.clipboard.writeText(MOCK_BANK.accountNo.replace(/\D/g, ""));
      setCopiedAcct(true);
      setTimeout(() => setCopiedAcct(false), 2000);
    } catch {
      // Clipboard blocked (non-HTTPS) — the number is on screen, nothing to recover.
    }
  }

  const isCod = order.paymentMethod === "cod";
  const amount = baht(order.amountSatang);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      {/* Header — the check + สั่งซื้อสำเร็จ! confirm the ORDER was placed, nothing about payment. */}
      <div style={{ textAlign: "center", margin: "24px 0 16px" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            // Blue disc + white check — the order-success hero reads at a glance, and blue (the CI's
            // trust highlight) feels friendlier here than the solid green that preceded it.
            background: "var(--brand-blue)",
            color: "var(--white)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="check" size={28} />
        </div>
        <h1 className="t-h1" style={{ margin: "10px 0 0", color: "var(--gray-dark)" }}>
          สั่งซื้อ<span style={{ color: "var(--brand)" }}>สำเร็จ!</span>
        </h1>
      </div>

      {/* Payment card — the money still owed (unless COD), with the way to pay it right here. */}
      <div className="card" style={{ padding: 20, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            {isCod ? "ยอดชำระปลายทาง" : "ยอดที่ต้องโอน"}
          </span>
          <span className={`pill ${isCod ? "soft" : "warn"}`}>
            {isCod ? "จ่ายเมื่อรับของ" : "รอชำระเงิน"}
          </span>
        </div>
        <div className="t-price-l" style={{ margin: "6px 0 0", color: "var(--brand-deep)" }}>
          {amount}
        </div>

        {/* Order number as a payment reference — by the amount, copyable, ONE place (was a
            de-emphasized row at the very bottom). Shown for every payment method. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            margin: "8px 0 2px",
            fontSize: 13,
          }}
        >
          <span className="muted">เลขที่คำสั่งซื้อ</span>
          <b style={{ color: "var(--gray-dark)", letterSpacing: 0.5 }}>{order.ref}</b>
          {/* Icon-only copy, matching the transfer-flow account copy: flips to a green check. */}
          <button
            type="button"
            onClick={copyRef}
            aria-label={copied ? "คัดลอกแล้ว" : "คัดลอกเลขที่คำสั่งซื้อ"}
            style={{
              display: "inline-flex",
              flexShrink: 0,
              background: "none",
              border: 0,
              padding: 0,
              lineHeight: 0,
              cursor: "pointer",
              color: copied ? "var(--ok)" : "var(--brand)",
            }}
          >
            <Icon name={copied ? "check" : "copy"} size={16} />
          </button>
        </div>

        {order.paymentMethod === "promptpay" && (
          <>
            {/* Real PromptPay ID once shop-settings is wired; a labelled demo QR until then so the
                pay-by-QR flow is visible instead of a dead-end warning. PromptPayQr renders nothing
                on an invalid ID, so a bad live setting still degrades safely. Wrapped so SaveQrButton
                can find + rasterize the SVG. */}
            <div ref={qrRef} style={{ display: "inline-flex", marginTop: 12 }}>
              <PromptPayQr
                promptpayId={order.promptpayId || MOCK_PROMPTPAY_ID}
                amountSatang={order.amountSatang}
                size={200}
              />
            </div>
            {!order.promptpayId && (
              <p
                style={{
                  margin: "10px auto 0",
                  maxWidth: 220,
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--warn-soft)",
                  color: "var(--warn)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ตัวอย่าง (เดโม) — ยังไม่ใช่บัญชีรับเงินจริง
              </p>
            )}
            <div
              style={{
                textAlign: "left",
                margin: "14px auto 0",
                maxWidth: 300,
                fontSize: 12.5,
                color: "var(--gray-mid)",
                lineHeight: 1.7,
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--gray-dark)", marginBottom: 2 }}>
                จ่ายด้วยมือถือเครื่องเดียว
              </div>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>กด “บันทึก QR code” (หรือแคปหน้าจอ)</li>
                <li>เปิดแอปธนาคารของคุณ</li>
                <li>เลือก “สแกน” แล้วเลือกรูป QR จากอัลบั้ม</li>
              </ol>
            </div>
            <SaveQrButton qrRef={qrRef} filename={`airplus-promptpay-${order.ref}.png`} />
            <div style={{ marginTop: 14 }}>
              <SlipUpload orderRef={order.ref} phone={order.phone} />
            </div>
          </>
        )}

        {order.paymentMethod === "transfer" && (
          <>
            {/* The bank account to transfer to — the missing flow. Number is copyable. */}
            <div
              style={{
                background: "var(--paper)",
                borderRadius: "var(--radius-sm)",
                padding: 14,
                textAlign: "left",
                margin: "14px 0 12px",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={acctRow}>
                <span className="muted">ธนาคาร</span>
                <span style={{ fontWeight: 700 }}>{MOCK_BANK.bank}</span>
              </div>
              <div style={acctRow}>
                <span className="muted">เลขที่บัญชี</span>
                <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <b style={{ letterSpacing: 0.5, fontSize: 15 }}>{MOCK_BANK.accountNo}</b>
                  {/* Icon-only copy, sized to the glyph (no box padding) so it sits flush by the
                      number; flips to a green check on success so the tap is confirmed. */}
                  <button
                    type="button"
                    onClick={copyAccount}
                    aria-label={copiedAcct ? "คัดลอกแล้ว" : "คัดลอกเลขที่บัญชี"}
                    style={{
                      display: "inline-flex",
                      flexShrink: 0,
                      background: "none",
                      border: 0,
                      padding: 0,
                      lineHeight: 0,
                      cursor: "pointer",
                      color: copiedAcct ? "var(--ok)" : "var(--brand)",
                    }}
                  >
                    <Icon name={copiedAcct ? "check" : "copy"} size={18} />
                  </button>
                </span>
              </div>
              <div style={acctRow}>
                <span className="muted">ชื่อบัญชี</span>
                <span style={{ fontWeight: 700, textAlign: "right", minWidth: 0 }}>
                  {MOCK_BANK.accountName}
                </span>
              </div>
            </div>
            <SlipUpload orderRef={order.ref} phone={order.phone} />
          </>
        )}

        {isCod && (
          <p className="muted" style={{ fontSize: 14, margin: "12px 0 0" }}>
            จ่ายกับพนักงานส่งเมื่อได้รับสินค้า ไม่มีค่าธรรมเนียมเพิ่ม
          </p>
        )}
      </div>

      {/* Nav — black buttons (owner-picked). รายละเอียดคำสั่งซื้อ shows live status + account. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
        <Link
          href={`/orders?ref=${encodeURIComponent(order.ref)}&phone=${encodeURIComponent(order.phone)}`}
          className="btn btn-block"
        >
          รายละเอียดคำสั่งซื้อ
        </Link>
        <Link href="/" className="btn btn-block">
          กลับหน้าแรก
        </Link>
      </div>
    </div>
  );
}

/** One row in the bank-account block: muted label left, value right. */
const acctRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  fontSize: 14,
};
