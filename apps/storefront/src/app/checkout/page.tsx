"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { OtpLogin } from "@/components/OtpLogin";
import type { AddressRow } from "@/app/api/account/addresses/route";
import { cartTotalSatang, clearCart, useCart } from "@/lib/cart";
import { Icon } from "@/components/Icon";
import {
  type CheckoutPaymentMethod,
  type CheckoutRequest,
  type CheckoutResponse,
  type CouponCheckResponse,
} from "@/lib/checkoutApi";
import { baht } from "@/lib/format";

/**
 * Checkout v2 — ONE page, all sections visible at once (the anti-inw.me statement: no hidden
 * steps, payment methods shown plainly BEFORE commit). Purchasing now requires login (phone OTP,
 * account auto-created), which unlocks the address book and coupons. Cart prices are display-only:
 * the server re-prices every line (campaign-aware) and recomputes the coupon discount.
 */

/** กรุงเทพมหานคร first (most orders), then the other 76 provinces alphabetically. */
const PROVINCES = [
  "กรุงเทพมหานคร",
  "กระบี่",
  "กาญจนบุรี",
  "กาฬสินธุ์",
  "กำแพงเพชร",
  "ขอนแก่น",
  "จันทบุรี",
  "ฉะเชิงเทรา",
  "ชลบุรี",
  "ชัยนาท",
  "ชัยภูมิ",
  "ชุมพร",
  "เชียงราย",
  "เชียงใหม่",
  "ตรัง",
  "ตราด",
  "ตาก",
  "นครนายก",
  "นครปฐม",
  "นครพนม",
  "นครราชสีมา",
  "นครศรีธรรมราช",
  "นครสวรรค์",
  "นนทบุรี",
  "นราธิวาส",
  "น่าน",
  "บึงกาฬ",
  "บุรีรัมย์",
  "ปทุมธานี",
  "ประจวบคีรีขันธ์",
  "ปราจีนบุรี",
  "ปัตตานี",
  "พระนครศรีอยุธยา",
  "พะเยา",
  "พังงา",
  "พัทลุง",
  "พิจิตร",
  "พิษณุโลก",
  "เพชรบุรี",
  "เพชรบูรณ์",
  "แพร่",
  "ภูเก็ต",
  "มหาสารคาม",
  "มุกดาหาร",
  "แม่ฮ่องสอน",
  "ยโสธร",
  "ยะลา",
  "ร้อยเอ็ด",
  "ระนอง",
  "ระยอง",
  "ราชบุรี",
  "ลพบุรี",
  "ลำปาง",
  "ลำพูน",
  "เลย",
  "ศรีสะเกษ",
  "สกลนคร",
  "สงขลา",
  "สตูล",
  "สมุทรปราการ",
  "สมุทรสงคราม",
  "สมุทรสาคร",
  "สระแก้ว",
  "สระบุรี",
  "สิงห์บุรี",
  "สุโขทัย",
  "สุพรรณบุรี",
  "สุราษฎร์ธานี",
  "สุรินทร์",
  "หนองคาย",
  "หนองบัวลำภู",
  "อ่างทอง",
  "อำนาจเจริญ",
  "อุดรธานี",
  "อุตรดิตถ์",
  "อุทัยธานี",
  "อุบลราชธานี",
];

const PAYMENT_OPTIONS: { id: CheckoutPaymentMethod; title: string; detail: string }[] = [
  {
    id: "promptpay",
    title: "PromptPay",
    detail: "สแกน QR จ่ายได้ทันที ระบบจะแสดง QR หลังยืนยันคำสั่งซื้อ",
  },
  {
    id: "transfer",
    title: "โอนผ่านบัญชีธนาคาร",
    detail:
      "บัญชีร้านค้านิติบุคคล Den Air Service — รายละเอียดบัญชีจะแสดงหลังยืนยัน (ไม่ใช่บัญชีส่วนตัว)",
  },
  {
    id: "cod",
    title: "เก็บเงินปลายทาง (COD)",
    detail: "จ่ายกับพนักงานส่ง ไม่มีค่าธรรมเนียมเพิ่ม",
  },
];

/** One idempotency ref per checkout visit — a retried submit can never create a duplicate order. */
function generateRef(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return `AP-${Array.from(buf, (b) => chars[b % chars.length]).join("")}`;
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 10px" }}>
      <span
        aria-hidden="true"
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          background: "var(--accent)",
          color: "var(--white)",
          fontSize: 13,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {n}
      </span>
      <h2 className="t-h3" style={{ margin: 0, color: "var(--gray-dark)" }}>
        {children}
      </h2>
    </div>
  );
}

const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "underline",
};

/** The slice of /api/auth/me the checkout page needs. undefined = still loading. */
interface Me {
  id: string;
  phone: string;
  /** '' = not captured yet → the one-time name field shows. */
  name: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart();

  const [ref] = useState(generateRef);

  // ① account
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [nameInput, setNameInput] = useState("");
  const accountSectionRef = useRef<HTMLDivElement | null>(null);

  // ② address
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [addressChoice, setAddressChoice] = useState<string>("new"); // saved id | "new"
  const [sameRecipient, setSameRecipient] = useState(true);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [district, setDistrict] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // ③ payment + coupon + submit
  const [payment, setPayment] = useState<CheckoutPaymentMethod>("promptpay");
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<{ code: string; discountSatang: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = (await res.json()) as { customer: Me | null };
      setMe(
        data.customer
          ? { id: data.customer.id, phone: data.customer.phone, name: data.customer.name ?? "" }
          : null,
      );
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  // Load the address book whenever the logged-in customer changes; preselect the default.
  useEffect(() => {
    if (!me) {
      setAddresses([]);
      setAddressChoice("new");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/account/addresses");
        const data = (await res.json()) as { addresses?: AddressRow[] };
        if (cancelled) return;
        const list = data.addresses ?? [];
        setAddresses(list);
        setAddressChoice(list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? "new");
      } catch {
        if (!cancelled) {
          setAddresses([]);
          setAddressChoice("new");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } catch {
      // Even if the network call fails, drop the local session view — /api/checkout re-verifies.
    }
    setMe(null);
    setCoupon(null);
  }

  const subtotal = cartTotalSatang(lines);
  const discount = coupon ? Math.min(coupon.discountSatang, subtotal) : 0;
  const total = subtotal - discount;

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || couponChecking) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotalSatang: subtotal }),
      });
      const data = (await res.json()) as CouponCheckResponse;
      if (data.valid) {
        setCoupon({ code, discountSatang: data.discountSatang });
        setCouponInput("");
      } else {
        setCouponError(data.message || "ใช้คูปองไม่ได้");
      }
    } catch {
      setCouponError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
    setCouponChecking(false);
  }

  const needName = me != null && me.name === "";
  const accountName = me ? (me.name !== "" ? me.name : nameInput.trim()) : "";
  const nameOk = me != null && (!needName || nameInput.trim() !== "");

  const usingNewAddress = addressChoice === "new";
  const recipientOk =
    sameRecipient || (recipientName.trim() !== "" && recipientPhone.trim() !== "");
  const newAddressOk =
    recipientOk &&
    addressLine1.trim() !== "" &&
    subdistrict.trim() !== "" &&
    district.trim() !== "" &&
    province !== "" &&
    /^\d{5}$/.test(postalCode);
  const addressOk =
    me != null && (usingNewAddress ? newAddressOk : addresses.some((a) => a.id === addressChoice));

  const valid = lines.length > 0 && me != null && nameOk && addressOk;

  async function submit() {
    if (!valid || submitting || !me) return;
    setSubmitting(true);
    setError(null);
    const body: CheckoutRequest = {
      idempotencyRef: ref,
      paymentMethod: payment,
      lines: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
    };
    if (needName) body.name = nameInput.trim();
    if (coupon) body.couponCode = coupon.code;
    if (usingNewAddress) {
      body.address = {
        recipientName: sameRecipient ? accountName : recipientName.trim(),
        phone: sameRecipient ? me.phone : recipientPhone.trim(),
        addressLine1: addressLine1.trim(),
        subdistrict: subdistrict.trim(),
        district: district.trim(),
        province,
        postalCode,
      };
    } else {
      body.addressId = addressChoice;
    }
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as CheckoutResponse;
      if (!res.ok || "error" in data) {
        if ("error" in data && data.requiresLogin) {
          setMe(null);
          accountSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        setError("error" in data ? data.error : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        setSubmitting(false);
        return;
      }
      sessionStorage.setItem("airplus.lastOrder", JSON.stringify({ ...data, phone: me.phone }));
      setRedirecting(true);
      clearCart();
      router.push("/checkout/done");
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  }

  if (lines.length === 0 && !redirecting) {
    return (
      <div className="section">
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>ตะกร้ายังว่างอยู่</p>
          <Link href="/products" className="btn btn-primary">
            เลือกซื้อสินค้า
          </Link>
        </div>
      </div>
    );
  }

  const addressFormVisible = me != null && (usingNewAddress || addresses.length === 0);

  return (
    <div className="has-sticky-bar">
      <h1 className="t-h1" style={{ margin: "8px 0 4px", color: "var(--gray-dark)" }}>
        <span style={{ color: "var(--brand)" }}>ชำระ</span>เงิน
      </h1>
      <p className="muted" style={{ margin: "0 0 4px" }}>
        เข้าสู่ระบบด้วยเบอร์โทรครั้งเดียว — ที่อยู่และประวัติคำสั่งซื้อถูกบันทึกให้อัตโนมัติ
      </p>

      <div ref={accountSectionRef}>
        <SectionTitle n={1}>บัญชีของคุณ</SectionTitle>
      </div>
      {me === undefined ? (
        <div className="card" style={{ padding: 16 }}>
          <span className="muted" style={{ fontSize: 14 }}>
            กำลังตรวจสอบสถานะการเข้าสู่ระบบ…
          </span>
        </div>
      ) : me === null ? (
        <div className="card" style={{ padding: 16 }}>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
            เข้าสู่ระบบด้วย OTP เพื่อสั่งซื้อ — ครั้งแรกระบบจะสร้างบัญชีให้อัตโนมัติ
          </p>
          <OtpLogin compact onLoggedIn={() => void refreshMe()} />
        </div>
      ) : (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              aria-hidden="true"
              style={{ color: "var(--ok)", display: "inline-flex", flexShrink: 0 }}
            >
              <Icon name="check" size={18} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, flex: 1 }}>
              สวัสดี คุณ{me.name !== "" ? me.name : me.phone}
            </span>
            <button type="button" onClick={() => void logout()} style={linkButtonStyle}>
              ออกจากระบบ
            </button>
          </div>
          {needName && (
            <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
              <label htmlFor="co-name">ชื่อ-นามสกุล (ครั้งแรกครั้งเดียว)</label>
              <input
                id="co-name"
                className="input"
                type="text"
                autoComplete="name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
              />
            </div>
          )}
        </div>
      )}

      <SectionTitle n={2}>ที่อยู่จัดส่ง</SectionTitle>
      {!me ? (
        <div className="card" style={{ padding: 16 }}>
          <span className="muted" style={{ fontSize: 14 }}>
            เข้าสู่ระบบก่อน เพื่อเลือกที่อยู่จัดส่ง
          </span>
        </div>
      ) : (
        <>
          {addresses.length > 0 && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}
              role="radiogroup"
              aria-label="เลือกที่อยู่จัดส่ง"
            >
              {addresses.map((a) => {
                const on = addressChoice === a.id;
                return (
                  <label
                    key={a.id}
                    className="card"
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: 14,
                      cursor: "pointer",
                      borderColor: on ? "var(--accent)" : "var(--border)",
                      boxShadow: on ? "0 0 0 1px var(--accent) inset" : "var(--shadow)",
                    }}
                  >
                    <input
                      type="radio"
                      name="addressChoice"
                      checked={on}
                      onChange={() => setAddressChoice(a.id)}
                      style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--accent)" }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                        {a.recipientName} · {a.phone}{" "}
                        {a.isDefault && <span className="pill soft">ค่าเริ่มต้น</span>}
                      </span>
                      <span
                        className="muted"
                        style={{ display: "block", fontSize: 13, marginTop: 2 }}
                      >
                        {a.addressLine1} {a.subdistrict} {a.district} {a.province} {a.postalCode}
                      </span>
                    </span>
                  </label>
                );
              })}
              <label
                className="card"
                style={{
                  display: "flex",
                  gap: 10,
                  padding: 14,
                  cursor: "pointer",
                  borderColor: usingNewAddress ? "var(--accent)" : "var(--border)",
                  boxShadow: usingNewAddress ? "0 0 0 1px var(--accent) inset" : "var(--shadow)",
                }}
              >
                <input
                  type="radio"
                  name="addressChoice"
                  checked={usingNewAddress}
                  onChange={() => setAddressChoice("new")}
                  style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                />
                <span style={{ fontSize: 14, fontWeight: 700 }}>ใช้ที่อยู่ใหม่</span>
              </label>
            </div>
          )}

          {addressFormVisible && (
            <div className="card" style={{ padding: 16, paddingBottom: 2 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                  marginBottom: 14,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={sameRecipient}
                  onChange={(e) => setSameRecipient(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                />
                ผู้รับคือเจ้าของบัญชี ({me.name !== "" ? me.name : me.phone})
              </label>
              {!sameRecipient && (
                <>
                  <div className="field">
                    <label htmlFor="co-recipient-name">ชื่อผู้รับ</label>
                    <input
                      id="co-recipient-name"
                      className="input"
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="co-recipient-phone">เบอร์โทรผู้รับ</label>
                    <input
                      id="co-recipient-phone"
                      className="input"
                      type="tel"
                      inputMode="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div className="field">
                <label htmlFor="co-address">ที่อยู่ (บ้านเลขที่ หมู่ ซอย ถนน)</label>
                <textarea
                  id="co-address"
                  className="input"
                  rows={2}
                  autoComplete="street-address"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12 }}>
                <div className="field">
                  <label htmlFor="co-subdistrict">ตำบล/แขวง</label>
                  <input
                    id="co-subdistrict"
                    className="input"
                    type="text"
                    value={subdistrict}
                    onChange={(e) => setSubdistrict(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="co-district">อำเภอ/เขต</label>
                  <input
                    id="co-district"
                    className="input"
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="co-province">จังหวัด</label>
                  <select
                    id="co-province"
                    className="input"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                  >
                    <option value="">เลือกจังหวัด</option>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="co-postal">รหัสไปรษณีย์</label>
                  <input
                    id="co-postal"
                    className="input"
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    autoComplete="postal-code"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <SectionTitle n={3}>วิธีชำระเงิน</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {PAYMENT_OPTIONS.map((opt) => {
          const on = payment === opt.id;
          return (
            <label
              key={opt.id}
              className="card"
              style={{
                display: "flex",
                gap: 10,
                padding: 14,
                cursor: "pointer",
                borderColor: on ? "var(--accent)" : "var(--border)",
                boxShadow: on ? "0 0 0 1px var(--accent) inset" : "var(--shadow)",
              }}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={opt.id}
                checked={on}
                onChange={() => setPayment(opt.id)}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--accent)" }}
              />
              <span style={{ minWidth: 0 }}>
                <span className="t-h4" style={{ display: "block" }}>
                  {opt.title}
                </span>
                <span className="muted" style={{ display: "block", fontSize: 13, marginTop: 2 }}>
                  {opt.detail}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="card" style={{ padding: 16, marginTop: 20 }}>
        <div className="t-overline" style={{ color: "var(--brand-deep)", marginBottom: 10 }}>
          สรุปคำสั่งซื้อ
        </div>
        {lines.map((l) => (
          <div
            key={l.variantId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 14,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {l.name} × {l.qty}
            </span>
            <span style={{ flexShrink: 0 }}>{baht(l.priceSatang * l.qty)}</span>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 14,
            marginBottom: 6,
          }}
        >
          <span className="muted">ค่าจัดส่ง</span>
          <span style={{ color: "var(--ok)", fontWeight: 600 }}>ฟรี (ช่วงเปิดร้าน)</span>
        </div>

        {/* coupon — collapsible so the summary stays clean for the no-coupon majority */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
          {coupon ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                marginBottom: 6,
              }}
            >
              <span style={{ color: "var(--ok)", fontWeight: 600, minWidth: 0 }}>
                คูปอง {coupon.code} −{baht(discount)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCoupon(null);
                  setCouponError(null);
                }}
                style={{ ...linkButtonStyle, color: "var(--danger)", flexShrink: 0 }}
              >
                ลบ
              </button>
            </div>
          ) : couponOpen ? (
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  type="text"
                  placeholder="รหัสคูปอง"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void applyCoupon();
                    }
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                  aria-label="รหัสคูปอง"
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => void applyCoupon()}
                  disabled={couponChecking || couponInput.trim() === ""}
                  style={{ flexShrink: 0 }}
                >
                  {couponChecking ? "กำลังตรวจสอบ…" : "ใช้คูปอง"}
                </button>
              </div>
              {couponError && (
                <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 6 }} role="alert">
                  {couponError}
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: 6 }}>
              <button type="button" onClick={() => setCouponOpen(true)} style={linkButtonStyle}>
                มีคูปอง?
              </button>
            </div>
          )}
        </div>

        {coupon && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              marginBottom: 6,
            }}
          >
            <span className="muted">ส่วนลดคูปอง</span>
            <span style={{ color: "var(--ok)", fontWeight: 600 }}>−{baht(discount)}</span>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingTop: 12,
            marginTop: 6,
            borderTop: "2px solid var(--gray-lite)",
          }}
        >
          <span className="t-h4" style={{ color: "var(--gray-dark)" }}>
            รวมทั้งหมด
          </span>
          <span className="t-price-l">{baht(total)}</span>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "10px 0 0" }}>
          ส่งฟรีทั่วไทยช่วงเปิดร้าน
        </p>
      </div>

      <p className="muted" style={{ fontSize: 12, margin: "12px 4px 0", lineHeight: 1.6 }}>
        ซื้อได้อย่างมั่นใจ — หากสินค้าชำรุดหรือมีปัญหา สามารถ{" "}
        <a href="/returns" style={{ color: "var(--brand)", fontWeight: 600 }}>
          คืน ยกเลิก หรือเคลม
        </a>{" "}
        ได้ตามนโยบาย
      </p>

      {error && (
        <div
          className="card"
          role="alert"
          style={{
            padding: 14,
            marginTop: 12,
            background: "var(--danger-soft)",
            borderColor: "var(--danger)",
            color: "var(--danger)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      <div className="sticky-bar">
        <div className="sticky-bar-inner">
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={!valid || submitting}
            onClick={() => void submit()}
          >
            {submitting ? "กำลังส่งคำสั่งซื้อ…" : `ยืนยันคำสั่งซื้อ · ${baht(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
