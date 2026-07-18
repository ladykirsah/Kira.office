"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PROVINCES } from "@/lib/provinces";
import { loadPostcodes, resolvePostcode, type PostcodeEntry } from "@/lib/thaiGeo";

/**
 * Reached only after a first-time LINE sign-in (the /callback route sets the pending cookie and
 * sends the browser here). LINE is the only login (no OTP), so we collect as little as possible:
 * a casual username + one delivery address. The phone lives INSIDE that address (it's also the
 * account phone — a customer row can't exist without one). Address entry is a bottom-sheet popup
 * with zip-first autofill: the postcode fills จังหวัด/อำเภอ and offers that area's ตำบล.
 */

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account";
}

function LineRegisterContent() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delivery address (required) — collected in the popup, then summarized on the form.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [district, setDistrict] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [tambons, setTambons] = useState<PostcodeEntry[]>([]);

  // Pre-fill the username with the LINE display name (editable).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/line/pending");
        const data = (await res.json()) as { name?: string | null };
        if (!cancelled && typeof data.name === "string" && data.name.trim()) setName(data.name);
      } catch {
        /* leave blank — the user types it */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Typing a 5-digit zip fills จังหวัด + อำเภอ (still editable) and loads that area's ตำบล options.
  async function applyPostcode(zip: string) {
    const map = await loadPostcodes();
    const res = resolvePostcode(map, zip);
    setTambons(res ? res.tambons : []);
    if (res) {
      setProvince(res.province);
      setDistrict(res.amphoe);
      setSubdistrict("");
    }
  }

  const nameOk = name.trim().length > 0;
  const phoneDigits = phone.replace(/\D/g, "");
  const addressComplete =
    recipientName.trim() !== "" &&
    phoneDigits.length >= 9 &&
    phoneDigits.length <= 10 &&
    addressLine1.trim() !== "" &&
    subdistrict.trim() !== "" &&
    district.trim() !== "" &&
    province !== "" &&
    /^\d{5}$/.test(postalCode.trim());

  const multiAmphoe = new Set(tambons.map((t) => t.amphoe)).size > 1;
  const tambonIdx = tambons.findIndex((t) => t.tambon === subdistrict && t.amphoe === district);

  function openSheet() {
    if (!recipientName.trim()) setRecipientName(name.trim());
    setSheetError(null);
    setSheetOpen(true);
  }

  function saveAddress() {
    if (!addressComplete) {
      setSheetError("กรุณากรอกข้อมูลจัดส่งให้ครบทุกช่อง");
      return;
    }
    setSheetError(null);
    setSaved(true);
    setSheetOpen(false);
    if (error) setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !nameOk || !saved || !consent) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/line/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          pdpaConsent: consent,
          address: {
            recipientName: recipientName.trim(),
            phone,
            addressLine1: addressLine1.trim(),
            subdistrict: subdistrict.trim(),
            district: district.trim(),
            province,
            postalCode: postalCode.trim(),
          },
        }),
      });
      const data = (await res.json()) as { customer?: unknown; error?: string };
      if (res.ok) {
        window.location.assign(next);
        return;
      }
      setError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      setBusy(false);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "24px auto 0" }}>
      <div className="card" style={{ padding: 24 }}>
        <h1 className="t-h1" style={{ margin: "0 0 6px", color: "var(--gray-dark)" }}>
          อีกขั้นตอนเดียว
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.5, color: "var(--gray-mid)" }}>
          เข้าสู่ระบบด้วย LINE สำเร็จ — ตั้งชื่อผู้ใช้และเพิ่มที่อยู่จัดส่งเพื่อเริ่มสั่งซื้อ
        </p>
        <form style={{ display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="line-name">ชื่อผู้ใช้</label>
            <input
              id="line-name"
              className="input"
              type="text"
              autoComplete="name"
              placeholder="ชื่อ-นามสกุล หรือชื่อเล่น"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              required
            />
          </div>

          {/* Delivery address — required. The phone lives inside it. */}
          {saved ? (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 14px",
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--gray-dark)" }}>
                  📦 {recipientName} · {phone}
                </div>
                <div style={{ fontSize: 13, color: "var(--gray-mid)", marginTop: 3 }}>
                  {addressLine1} {subdistrict} {district} {province} {postalCode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--brand-blue)",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                แก้ไข
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openSheet}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                width: "100%",
                padding: 13,
                background: "rgba(1, 90, 191, 0.06)",
                color: "var(--brand-blue)",
                border: "1px dashed #9cc0ea",
                borderRadius: "var(--radius-sm)",
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: 14.5,
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 17, lineHeight: 1 }}>＋</span> เพิ่มข้อมูลจัดส่ง
            </button>
          )}

          <div className="otp-welcome">
            <label className="otp-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (e.target.checked && error) setError(null);
                }}
              />
              <span>
                ยอมรับ{" "}
                <Link href="/privacy" target="_blank">
                  นโยบายความเป็นส่วนตัว (PDPA)
                </Link>{" "}
                และ{" "}
                <Link href="/terms" target="_blank">
                  ข้อกำหนด
                </Link>{" "}
                เพื่อสร้างบัญชี
              </span>
            </label>
          </div>

          {error && (
            <div style={{ color: "var(--danger)", fontSize: 14, fontWeight: 600 }} role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={busy || !nameOk || !saved || !consent}
          >
            {busy ? "กำลังสร้างบัญชี…" : "สร้างบัญชีและเข้าสู่ระบบ"}
          </button>
        </form>
      </div>

      {/* Bottom-sheet popup: the full delivery address (recipient + phone + address, all required). */}
      {sheetOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50 }}
          role="dialog"
          aria-modal="true"
          aria-label="ข้อมูลจัดส่ง"
        >
          <div
            onClick={() => setSheetOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.42)" }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              background: "var(--white)",
              borderRadius: "18px 18px 0 0",
              padding: "10px 18px 20px",
              maxHeight: "92%",
              overflowY: "auto",
              maxWidth: 460,
              margin: "0 auto",
            }}
          >
            <div
              style={{
                width: 38,
                height: 4,
                background: "#d5d5d5",
                borderRadius: 2,
                margin: "0 auto 14px",
              }}
            />
            <h2 className="t-h4" style={{ margin: "0 0 14px", color: "var(--gray-dark)" }}>
              ข้อมูลจัดส่ง
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="d-recipient">ชื่อผู้รับ</label>
                <input
                  id="d-recipient"
                  className="input"
                  type="text"
                  autoComplete="name"
                  placeholder="ชื่อผู้รับสินค้า"
                  value={recipientName}
                  onChange={(e) => {
                    setRecipientName(e.target.value);
                    if (sheetError) setSheetError(null);
                  }}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="d-phone">เบอร์โทรผู้รับ</label>
                <input
                  id="d-phone"
                  className="input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="08x-xxx-xxxx"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (sheetError) setSheetError(null);
                  }}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="d-address">ที่อยู่</label>
                <textarea
                  id="d-address"
                  className="input"
                  rows={2}
                  autoComplete="street-address"
                  placeholder="บ้านเลขที่ หมู่ ซอย ถนน"
                  value={addressLine1}
                  onChange={(e) => {
                    setAddressLine1(e.target.value);
                    if (sheetError) setSheetError(null);
                  }}
                  style={{ resize: "vertical" }}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="d-postal">รหัสไปรษณีย์</label>
                <input
                  id="d-postal"
                  className="input"
                  inputMode="numeric"
                  maxLength={5}
                  autoComplete="postal-code"
                  placeholder="กรอกเพื่อเติมจังหวัด/อำเภออัตโนมัติ"
                  value={postalCode}
                  onChange={(e) => {
                    const zip = e.target.value.replace(/\D/g, "").slice(0, 5);
                    setPostalCode(zip);
                    if (sheetError) setSheetError(null);
                    if (/^\d{5}$/.test(zip)) void applyPostcode(zip);
                    else setTambons([]);
                  }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="d-province">จังหวัด</label>
                  <select
                    id="d-province"
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
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="d-district">อำเภอ/เขต</label>
                  <input
                    id="d-district"
                    className="input"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  />
                </div>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="d-subdistrict">ตำบล/แขวง</label>
                {tambons.length > 0 ? (
                  <select
                    id="d-subdistrict"
                    className="input"
                    value={tambonIdx >= 0 ? String(tambonIdx) : ""}
                    onChange={(e) => {
                      const t = tambons[Number(e.target.value)];
                      if (t) {
                        setSubdistrict(t.tambon);
                        setDistrict(t.amphoe);
                        setProvince(t.province);
                        if (sheetError) setSheetError(null);
                      }
                    }}
                  >
                    <option value="">เลือกตำบล/แขวง</option>
                    {tambons.map((t, i) => (
                      <option key={i} value={i}>
                        {t.tambon}
                        {multiAmphoe ? ` · ${t.amphoe}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="d-subdistrict"
                    className="input"
                    placeholder="กรอกรหัสไปรษณีย์ก่อน"
                    value={subdistrict}
                    onChange={(e) => setSubdistrict(e.target.value)}
                  />
                )}
              </div>
              {sheetError && (
                <div
                  style={{ color: "var(--danger)", fontSize: 13.5, fontWeight: 600 }}
                  role="alert"
                >
                  {sheetError}
                </div>
              )}
              <button type="button" className="btn btn-primary btn-block" onClick={saveAddress}>
                บันทึกที่อยู่
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LineRegisterPage() {
  return (
    <Suspense fallback={<p className="muted">กำลังโหลด…</p>}>
      <LineRegisterContent />
    </Suspense>
  );
}
