"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * Reached only after a first-time LINE sign-in (the /callback route sets the pending
 * cookie and sends the browser here). LINE gives us no phone number, and a customer
 * row can't exist without one, so we collect a phone + PDPA consent, then create the
 * account. On success we hard-navigate so the new session cookie is picked up.
 */

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account";
}

function LineRegisterContent() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressOpen, setAddressOpen] = useState(false);
  const [addressLine1, setAddressLine1] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [district, setDistrict] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Pre-fill the username with the LINE display name (editable — the user can change it).
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

  const nameOk = name.trim().length > 0;
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneOk = phoneDigits.length >= 9 && phoneDigits.length <= 10;

  // Default address is optional: skipped when blank, but must be COMPLETE if started.
  const addressStarted = [addressLine1, subdistrict, district, province, postalCode].some(
    (f) => f.trim() !== "",
  );
  const addressComplete =
    addressLine1.trim() !== "" &&
    subdistrict.trim() !== "" &&
    district.trim() !== "" &&
    province.trim() !== "" &&
    /^\d{5}$/.test(postalCode.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !nameOk || !phoneOk || !consent) return;
    if (addressStarted && !addressComplete) {
      setError("กรุณากรอกที่อยู่จัดส่งให้ครบ หรือลบออกเพื่อข้ามไปก่อน");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/line/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          pdpaConsent: consent,
          ...(addressComplete
            ? {
                address: {
                  addressLine1: addressLine1.trim(),
                  subdistrict: subdistrict.trim(),
                  district: district.trim(),
                  province: province.trim(),
                  postalCode: postalCode.trim(),
                },
              }
            : {}),
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
          เข้าสู่ระบบด้วย LINE สำเร็จ — ยืนยันชื่อและเบอร์โทรศัพท์เพื่อใช้จัดส่งและติดตามคำสั่งซื้อ
        </p>
        <form style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
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
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="line-phone">เบอร์โทรศัพท์</label>
            <input
              id="line-phone"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="08x-xxx-xxxx"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (error) setError(null);
              }}
              required
            />
          </div>

          {!addressOpen ? (
            <button
              type="button"
              onClick={() => setAddressOpen(true)}
              style={{
                alignSelf: "flex-start",
                background: "none",
                border: "none",
                padding: "2px 0",
                color: "var(--brand-blue)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              + เพิ่มที่อยู่จัดส่ง (ไม่บังคับ)
            </button>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: 12,
                background: "var(--paper)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-dark)" }}>
                  ที่อยู่จัดส่ง (ไม่บังคับ)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAddressOpen(false);
                    setAddressLine1("");
                    setSubdistrict("");
                    setDistrict("");
                    setProvince("");
                    setPostalCode("");
                    if (error) setError(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--gray-mid)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  ข้ามไปก่อน
                </button>
              </div>
              <input
                className="input"
                placeholder="บ้านเลขที่ / ถนน / ซอย"
                value={addressLine1}
                onChange={(e) => {
                  setAddressLine1(e.target.value);
                  if (error) setError(null);
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  placeholder="ตำบล/แขวง"
                  value={subdistrict}
                  onChange={(e) => setSubdistrict(e.target.value)}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <input
                  className="input"
                  placeholder="อำเภอ/เขต"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  placeholder="จังหวัด"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="รหัสไปรษณีย์"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
            </div>
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
            disabled={
              busy || !nameOk || !phoneOk || !consent || (addressStarted && !addressComplete)
            }
          >
            {busy ? "กำลังสร้างบัญชี…" : "สร้างบัญชีและเข้าสู่ระบบ"}
          </button>
        </form>
      </div>
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
