"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { OtpLogin } from "@/components/OtpLogin";
import type { AddressRow } from "@/app/api/account/addresses/route";
import { cartTotalSatang, clearCart, useCart } from "@/lib/cart";
import { ALL_COUPONS, readCollectedCodes, type Coupon } from "@/lib/coupons";
import { imgUrl } from "@/lib/img";
import { Icon } from "@/components/Icon";
import {
  type CheckoutPaymentMethod,
  type CheckoutRequest,
  type CheckoutResponse,
  type CouponCheckResponse,
} from "@/lib/checkoutApi";
import { baht } from "@/lib/format";
import { loadPostcodes, resolvePostcode, type PostcodeEntry } from "@/lib/thaiGeo";

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
    detail: "โอนแล้วแนบสลิป รอร้านตรวจสอบและยืนยันการชำระเงิน",
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

/** Small square line thumbnail for the order summary — the shared ✦ frame, image when it has one. */
function LineThumb({ imageKey, name }: { imageKey: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="frame" style={{ width: 40, height: 40, flexShrink: 0 }}>
      {imageKey && !failed ? (
        <img src={imgUrl(imageKey)} alt={name} onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, color: "var(--brand)" }}>
          ✦
        </span>
      )}
    </div>
  );
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

/** One money row in the order summary: label left, value right, both baseline-aligned. */
const coSumLine: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  fontSize: 14,
  marginBottom: 8,
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
  const [addrTambons, setAddrTambons] = useState<PostcodeEntry[]>([]);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressSaveError, setAddressSaveError] = useState<string | null>(null);

  // ③ payment + coupon + submit
  const [payment, setPayment] = useState<CheckoutPaymentMethod>("promptpay");
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<{ code: string; discountSatang: number } | null>(null);
  // Which coupon a check is running for: the code (from the collected list) or null (the code box).
  // Lets exactly one row spin while every button disables — one coupon at a time, no double-apply.
  const [applyingCode, setApplyingCode] = useState<string | null>(null);
  // The shopper's collected coupons (client wallet). Read once on mount — localStorage is browser-only.
  const [collectedCodes, setCollectedCodes] = useState<string[]>([]);
  useEffect(() => {
    setCollectedCodes(readCollectedCodes());
  }, []);
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

  // Collected codes → their catalog display info, newest-collected first. Unknown codes (collected
  // then removed from the catalog) are dropped rather than shown as a bare code.
  const collectedCoupons: Coupon[] = collectedCodes
    .map((code) => ALL_COUPONS.find((c) => c.code === code))
    .filter((c): c is Coupon => c !== undefined);

  /**
   * Validate + apply a coupon, from EITHER entry point: a tapped collected coupon (rawCode given)
   * or the typed code box (rawCode omitted). Both funnel through the same server check, so the two
   * ways can never disagree on whether a code is valid. Applying replaces any current coupon —
   * that is how "one coupon at a time" is enforced without extra logic.
   */
  async function applyCoupon(rawCode?: string) {
    const code = (rawCode ?? couponInput).trim().toUpperCase();
    if (!code || couponChecking) return;
    setCouponChecking(true);
    setApplyingCode(rawCode ? code : null);
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
    setApplyingCode(null);
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
  // A new address must be SAVED before the order can go through: saving it selects it, so at
  // place-order time a "new" (still-unsaved) address is never the choice. This is what gives the
  // form a real action instead of silently persisting at submit — the owner's "need save button".
  const addressOk = me != null && !usingNewAddress && addresses.some((a) => a.id === addressChoice);

  const valid = lines.length > 0 && me != null && nameOk && addressOk;

  // Thai postcode autofill (same behaviour as the address book): a 5-digit zip fills จังหวัด + อำเภอ
  // (editable) and loads the ตำบล dropdown for that area; picking a ตำบล refines อำเภอ/จังหวัด.
  const addrMultiAmphoe = new Set(addrTambons.map((t) => t.amphoe)).size > 1;
  const addrTambonIdx = addrTambons.findIndex(
    (t) => t.tambon === subdistrict && t.amphoe === district,
  );
  async function applyPostcode(zip: string) {
    const map = await loadPostcodes();
    const res = resolvePostcode(map, zip);
    setAddrTambons(res ? res.tambons : []);
    if (res) {
      setProvince(res.province);
      setDistrict(res.amphoe);
      setSubdistrict("");
    }
  }

  /**
   * Save the just-entered new address to the book, then SELECT it — so it collapses into a chosen
   * saved address and the place-order bar lights up. Routes through the same POST the address book
   * uses (validation + first-address-becomes-default live there), so nothing is duplicated. On
   * success the form is cleared, because the address it held now lives in the list above it.
   */
  async function saveNewAddress() {
    if (!me || !newAddressOk || savingAddress) return;
    setSavingAddress(true);
    setAddressSaveError(null);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: sameRecipient ? accountName : recipientName.trim(),
          phone: sameRecipient ? me.phone : recipientPhone.trim(),
          addressLine1: addressLine1.trim(),
          subdistrict: subdistrict.trim(),
          district: district.trim(),
          province,
          postalCode,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setAddressSaveError(data.error ?? "บันทึกที่อยู่ไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      // Re-read the book so the new row shows with its real default flag, then select it.
      const listRes = await fetch("/api/account/addresses");
      const listData = (await listRes.json().catch(() => ({}))) as { addresses?: AddressRow[] };
      setAddresses(listData.addresses ?? []);
      setAddressChoice(data.id);
      setAddressLine1("");
      setSubdistrict("");
      setDistrict("");
      setProvince("");
      setPostalCode("");
      setAddrTambons([]);
      setRecipientName("");
      setRecipientPhone("");
      setSameRecipient(true);
    } catch {
      setAddressSaveError("เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setSavingAddress(false);
    }
  }

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
                      alignItems: "center",
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
                      style={{ width: 18, height: 18, flexShrink: 0, accentColor: "var(--accent)" }}
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
                  alignItems: "center",
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
                  style={{ width: 18, height: 18, flexShrink: 0, accentColor: "var(--accent)" }}
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
              {/* Location, zip-first: postcode fills จังหวัด/อำเภอ and offers this area's ตำบล. */}
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
                  onChange={(e) => {
                    const zip = e.target.value.replace(/\D/g, "").slice(0, 5);
                    setPostalCode(zip);
                    if (/^\d{5}$/.test(zip)) void applyPostcode(zip);
                    else setAddrTambons([]);
                  }}
                />
                <span
                  style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 }}
                >
                  กรอกรหัสไปรษณีย์ ระบบจะเติมจังหวัด/อำเภอ และให้เลือกตำบลของพื้นที่นั้น
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12 }}>
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
                  <label htmlFor="co-district">อำเภอ/เขต</label>
                  <input
                    id="co-district"
                    className="input"
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="co-subdistrict">ตำบล/แขวง</label>
                {addrTambons.length > 0 ? (
                  <select
                    id="co-subdistrict"
                    className="input"
                    value={addrTambonIdx >= 0 ? String(addrTambonIdx) : ""}
                    onChange={(e) => {
                      const t = addrTambons[Number(e.target.value)];
                      if (t) {
                        setSubdistrict(t.tambon);
                        setDistrict(t.amphoe);
                        setProvince(t.province);
                      }
                    }}
                  >
                    <option value="">เลือกตำบล/แขวง</option>
                    {addrTambons.map((t, i) => (
                      <option key={i} value={i}>
                        {t.tambon}
                        {addrMultiAmphoe ? ` · ${t.amphoe}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="co-subdistrict"
                    className="input"
                    type="text"
                    value={subdistrict}
                    onChange={(e) => setSubdistrict(e.target.value)}
                  />
                )}
              </div>
              {addressSaveError && (
                <div
                  role="alert"
                  style={{
                    color: "var(--danger)",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 10,
                  }}
                >
                  {addressSaveError}
                </div>
              )}
              {/* The form's own action. Without it the only button was the far-away place-order bar,
                  and the address saved invisibly at submit — so the form looked like it did nothing. */}
              <button
                type="button"
                className="btn btn-primary btn-block"
                style={{ marginBottom: 14 }}
                disabled={!newAddressOk || savingAddress}
                onClick={() => void saveNewAddress()}
              >
                {savingAddress ? "กำลังบันทึก…" : "บันทึกและใช้ที่อยู่นี้"}
              </button>
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
                alignItems: "center",
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
                style={{ width: 18, height: 18, flexShrink: 0, accentColor: "var(--accent)" }}
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
        {/* Design C: each item = thumbnail + name (wraps to 2 lines so the fitment is readable,
            not hard-truncated) + line price. */}
        {lines.map((l) => (
          <div
            key={l.variantId}
            style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}
          >
            <LineThumb imageKey={l.imageKey} name={l.name} />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 14,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {l.name} <span className="muted">× {l.qty}</span>
            </span>
            <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 700 }}>
              {baht(l.priceSatang * l.qty)}
            </span>
          </div>
        ))}

        {/* Money lines — one fact per row, each stated ONCE (the old card printed the coupon twice
            and free shipping twice). Muted labels, values right-aligned so the eye scans one column. */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 2 }}>
          <div style={coSumLine}>
            <span className="muted">ยอดรวมสินค้า</span>
            <span>{baht(subtotal)}</span>
          </div>
          <div style={coSumLine}>
            <span className="muted">ค่าจัดส่ง</span>
            <span style={{ color: "var(--ok)", fontWeight: 600 }}>ฟรี</span>
          </div>
          {coupon && (
            <div style={coSumLine}>
              <span className="muted" style={{ minWidth: 0, display: "flex", gap: 6 }}>
                ส่วนลดคูปอง
                <b style={{ color: "var(--gray-dark)" }}>{coupon.code}</b>
                <button
                  type="button"
                  aria-label="ลบคูปอง"
                  onClick={() => {
                    setCoupon(null);
                    setCouponError(null);
                  }}
                  style={{
                    background: "none",
                    border: 0,
                    padding: 0,
                    color: "var(--danger)",
                    cursor: "pointer",
                    fontSize: 13,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </span>
              <span style={{ color: "var(--ok)", fontWeight: 600 }}>−{baht(discount)}</span>
            </div>
          )}
        </div>

        {/* coupon ENTRY — shown only when no coupon is applied. An applied coupon lives in the money
            lines above as its discount row (with its own ✕), so it can never appear twice. */}
        {!coupon && (
          <div style={{ paddingTop: 10, marginTop: 2 }}>
            {couponOpen ? (
              <div style={{ marginBottom: 6, display: "grid", gap: 12 }}>
                {/* Way 1 — pick a collected coupon. Each row applies via the same server check as the
                  code box below, so both paths agree on validity. Shipping coupons are shown but not
                  tappable: the server only discounts the subtotal, and shipping is free today. */}
                {collectedCoupons.length > 0 && (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                      คูปองของฉัน
                    </div>
                    {collectedCoupons.map((c) => {
                      const isShip = c.kind === "ship";
                      const tone = isShip ? "var(--ship)" : "var(--brand)";
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => void applyCoupon(c.code)}
                          disabled={couponChecking || isShip}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--white)",
                            textAlign: "left",
                            cursor: couponChecking || isShip ? "default" : "pointer",
                            opacity: isShip ? 0.6 : 1,
                            font: "inherit",
                          }}
                        >
                          <span
                            style={{
                              flexShrink: 0,
                              fontWeight: 800,
                              fontSize: 14,
                              color: tone,
                              minWidth: 52,
                            }}
                          >
                            {c.value}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                display: "block",
                                fontSize: 14,
                                fontWeight: 700,
                                color: "var(--gray-dark)",
                              }}
                            >
                              {c.title}
                            </span>
                            <span className="muted" style={{ display: "block", fontSize: 12 }}>
                              {isShip ? "ใช้กับค่าจัดส่ง · ตอนนี้ส่งฟรีทุกออเดอร์" : c.cond}
                            </span>
                          </span>
                          <span
                            style={{
                              flexShrink: 0,
                              fontSize: 13,
                              fontWeight: 700,
                              color: isShip ? "var(--text-muted)" : "var(--brand)",
                            }}
                          >
                            {applyingCode === c.code ? "…" : isShip ? "" : "ใช้"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Way 2 — type a code (for coupons not collected). */}
                <div style={{ display: "grid", gap: 6 }}>
                  {collectedCoupons.length > 0 && (
                    <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                      หรือใส่รหัสคูปอง
                    </div>
                  )}
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
                      {couponChecking && applyingCode === null ? "กำลังตรวจสอบ…" : "ใช้คูปอง"}
                    </button>
                  </div>
                </div>

                {couponError && (
                  <div style={{ color: "var(--danger)", fontSize: 13 }} role="alert">
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
        )}

        {/* Total — the one thing to skim. t-price-l (the app's large-price size, 24px) so it stays
            consistent with prices everywhere; the savings badge restates the discount as a benefit. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 12,
            paddingTop: 12,
            marginTop: 10,
            borderTop: "2px solid var(--gray-lite)",
          }}
        >
          <span>
            <span className="t-h4" style={{ display: "block", color: "var(--gray-dark)" }}>
              ยอดชำระทั้งหมด
            </span>
            {discount > 0 && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: 6,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "var(--ok-soft)",
                  color: "var(--ok)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ประหยัด {baht(discount)}
              </span>
            )}
          </span>
          <span className="t-price-l" style={{ color: "var(--brand-deep)", flexShrink: 0 }}>
            {baht(total)}
          </span>
        </div>
      </div>

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
