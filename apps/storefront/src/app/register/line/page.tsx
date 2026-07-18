"use client";

import { Suspense, useState } from "react";
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

  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneDigits = phone.replace(/\D/g, "");
  const phoneOk = phoneDigits.length >= 9 && phoneDigits.length <= 10;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !phoneOk || !consent) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/line/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pdpaConsent: consent }),
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
          เข้าสู่ระบบด้วย LINE สำเร็จ — กรอกเบอร์โทรศัพท์เพื่อใช้จัดส่งและติดตามคำสั่งซื้อ
        </p>
        <form style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
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
            disabled={busy || !phoneOk || !consent}
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
