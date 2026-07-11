"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PromptPayQr } from "@/components/PromptPayQr";
import { SlipUpload } from "@/components/SlipUpload";
import type { CheckoutSuccess } from "@/lib/checkoutApi";
import { baht } from "@/lib/format";

/**
 * Order confirmation — reads the just-placed order from sessionStorage (written by the checkout
 * page). Payment instructions are shown IMMEDIATELY per method: PromptPay QR right on the page,
 * COD amount stated plainly — never a hidden bank account revealed after commit.
 */

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

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div style={{ textAlign: "center", margin: "24px 0 20px" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            background: "var(--ok-soft)",
            color: "var(--ok)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12.5 10 17.5 19 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="t-h1" style={{ margin: "12px 0 8px", color: "var(--gray-dark)" }}>
          สั่งซื้อ<span style={{ color: "var(--brand)" }}>สำเร็จ!</span>
        </h1>
        <div className="muted" style={{ fontSize: 13 }}>
          เลขที่คำสั่งซื้อ
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          <span
            className="t-h1"
            style={{
              letterSpacing: 1,
              color: "var(--brand-deep)",
            }}
          >
            {order.ref}
          </span>
          <button type="button" className="btn btn-s" onClick={copyRef}>
            {copied ? "คัดลอกแล้ว" : "คัดลอก"}
          </button>
        </div>
        {order.discountSatang > 0 && (
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ok)", marginTop: 6 }}>
            ส่วนลดคูปอง −{baht(order.discountSatang)}
          </div>
        )}
      </div>

      {order.paymentMethod === "promptpay" &&
        (order.promptpayId ? (
          <div className="card" style={{ padding: 20, textAlign: "center" }}>
            <div className="t-h4">สแกนจ่ายด้วย PromptPay</div>
            <div className="t-price-l" style={{ margin: "4px 0 12px" }}>
              {baht(order.amountSatang)}
            </div>
            <PromptPayQr
              promptpayId={order.promptpayId}
              amountSatang={order.amountSatang}
              size={220}
            />
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>
              สแกนด้วยแอปธนาคารใดก็ได้
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "8px 0 12px" }}>
              จ่ายแล้วแนบสลิปได้เลย — ระบบยืนยันให้ทันที
            </p>
            <SlipUpload orderRef={order.ref} phone={order.phone} />
          </div>
        ) : (
          <div
            className="card"
            style={{
              padding: 20,
              background: "var(--warn-soft)",
              borderColor: "var(--warn)",
              color: "var(--warn)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ร้านยังไม่ได้ตั้งค่า PromptPay — ทางร้านจะติดต่อกลับเพื่อแจ้งช่องทางชำระเงิน
          </div>
        ))}

      {order.paymentMethod === "transfer" && (
        <div className="card" style={{ padding: 20, textAlign: "center" }}>
          <div className="t-h4">โอนเข้าบัญชี Den Air Service</div>
          <div className="t-price-l" style={{ margin: "4px 0 8px" }}>
            {baht(order.amountSatang)}
          </div>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
            รายละเอียดบัญชีจะถูกส่งให้ทาง SMS/โทรยืนยันจากทางร้าน
          </p>
          <SlipUpload orderRef={order.ref} phone={order.phone} />
        </div>
      )}

      {order.paymentMethod === "cod" && (
        <div className="card" style={{ padding: 20, textAlign: "center", fontSize: 15 }}>
          ชำระเงิน <span className="t-price-m">{baht(order.amountSatang)}</span>{" "}
          กับพนักงานส่งเมื่อได้รับสินค้า
        </div>
      )}

      <p className="muted" style={{ textAlign: "center", fontSize: 14, margin: "20px 0 12px" }}>
        ติดตามคำสั่งซื้อได้ที่หน้า “ติดตามคำสั่งซื้อ” ด้วยเบอร์โทรและเลขที่คำสั่งซื้อ
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        <Link
          href={`/orders?ref=${encodeURIComponent(order.ref)}&phone=${encodeURIComponent(order.phone)}`}
          className="btn btn-block"
        >
          ติดตามคำสั่งซื้อ
        </Link>
        <Link href="/account/orders" className="btn btn-block">
          ดูคำสั่งซื้อทั้งหมด
        </Link>
        <Link href="/" className="btn btn-block">
          กลับหน้าแรก
        </Link>
      </div>
    </div>
  );
}
