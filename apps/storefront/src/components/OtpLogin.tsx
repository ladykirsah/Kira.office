"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { normalizePhone } from "@/lib/format";

/**
 * Shared phone-OTP login widget (login page + checkout embed it). Two steps:
 * ① phone → POST /api/auth/otp/send, ② 6-digit code → POST /api/auth/otp/verify.
 * A NEW account gets the PDPA consent checkbox revealed on demand ({requiresConsent:true}) —
 * the code stays valid, verify is simply resubmitted with pdpaConsent: true.
 * Turnstile renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set (dev skips it entirely).
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const RESEND_COOLDOWN_MS = 30_000;

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  turnstileScriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script failed to load"));
    document.head.appendChild(s);
  });
  return turnstileScriptPromise;
}

export interface OtpLoginCustomer {
  id: string;
  phone: string;
  name: string;
}

export function OtpLogin({
  onLoggedIn,
  compact = false,
}: {
  onLoggedIn?: (customer: OtpLoginCustomer) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // 30-second resend cooldown (ticks once per second while armed).
  const [resendAt, setResendAt] = useState(0);
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    if (resendAt <= Date.now()) return;
    setNowTick(Date.now());
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [resendAt]);
  const secondsLeft = Math.max(0, Math.ceil((resendAt - Math.max(nowTick, 1)) / 1000));

  // Turnstile widget — re-rendered per step so a resend always has a fresh token.
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    setTurnstileToken(null);
    void loadTurnstileScript()
      .then(() => {
        const el = turnstileRef.current;
        if (cancelled || !el || !window.turnstile) return;
        el.replaceChildren();
        widgetIdRef.current = window.turnstile.render(el, {
          sitekey: SITE_KEY,
          callback: (token) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(null),
          "error-callback": () => setTurnstileToken(null),
        });
      })
      .catch(() => setError("โหลดระบบยืนยันความปลอดภัยไม่สำเร็จ กรุณารีเฟรชหน้า"));
    return () => {
      cancelled = true;
    };
  }, [step]);

  const phoneDigits = normalizePhone(phone);
  const phoneOk = phoneDigits.length >= 9 && phoneDigits.length <= 10;

  async function send() {
    if (sending || secondsLeft > 0) return;
    if (!phoneOk) {
      setError("กรุณากรอกเบอร์โทรศัพท์ 9-10 หลัก");
      return;
    }
    setSending(true);
    setError(null);
    setDevCode(null);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: phoneDigits,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        sent?: boolean;
        devCode?: string;
        error?: string;
      };
      if (res.status === 429) {
        setError(data.error ?? "ขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่");
        setResendAt(Date.now() + RESEND_COOLDOWN_MS);
        return;
      }
      if (!res.ok || !data.sent) {
        setError(data.error ?? "ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      if (data.devCode) setDevCode(data.devCode);
      setCode("");
      setStep("code");
      setResendAt(Date.now() + RESEND_COOLDOWN_MS);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setSending(false);
      if (SITE_KEY) {
        setTurnstileToken(null);
        window.turnstile?.reset(widgetIdRef.current);
      }
    }
  }

  async function verify() {
    if (verifying) return;
    if (!/^\d{6}$/.test(code)) {
      setError("กรุณากรอกรหัส 6 หลัก");
      return;
    }
    if (needsConsent && !consentChecked) {
      setError("กรุณายอมรับนโยบายความเป็นส่วนตัวเพื่อสร้างบัญชี");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: phoneDigits,
          code,
          ...(needsConsent && consentChecked ? { pdpaConsent: true } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        customer?: OtpLoginCustomer;
        requiresConsent?: boolean;
        error?: string;
      };
      if (data.requiresConsent) {
        // Code stays valid server-side — just reveal the checkbox and resubmit.
        setNeedsConsent(true);
        setError(data.error ?? "กรุณายอมรับนโยบายความเป็นส่วนตัวเพื่อสร้างบัญชี");
        return;
      }
      if (!res.ok || !data.customer) {
        setError(data.error ?? "รหัสไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
        return;
      }
      onLoggedIn?.(data.customer);
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setVerifying(false);
    }
  }

  function backToPhone() {
    setStep("phone");
    setCode("");
    setNeedsConsent(false);
    setConsentChecked(false);
    setError(null);
    setDevCode(null);
  }

  const gap = compact ? 8 : 12;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {step === "phone" ? (
        <form
          style={{ display: "flex", flexDirection: "column", gap }}
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="otp-phone">เบอร์โทรศัพท์</label>
            <input
              id="otp-phone"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="08x-xxx-xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          {SITE_KEY && <div ref={turnstileRef} />}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={sending || secondsLeft > 0 || Boolean(SITE_KEY && !turnstileToken)}
          >
            {sending
              ? "กำลังส่งรหัส…"
              : secondsLeft > 0
                ? `ส่งได้อีกครั้งใน ${secondsLeft} วิ`
                : "รับรหัส OTP"}
          </button>
        </form>
      ) : (
        <form
          style={{ display: "flex", flexDirection: "column", gap }}
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            ส่งรหัส 6 หลักไปที่ <strong style={{ color: "var(--text)" }}>{phoneDigits}</strong> แล้ว
          </p>
          {devCode && (
            <div
              style={{
                background: "var(--warn-soft)",
                color: "var(--warn)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              รหัสทดสอบ: {devCode} — โหมดพัฒนา
            </div>
          )}
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="otp-code">รหัส OTP 6 หลัก</label>
            <input
              id="otp-code"
              className="input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              style={{ letterSpacing: 6, fontSize: 18, textAlign: "center" }}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </div>
          {needsConsent && (
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                style={{ width: 18, height: 18, flexShrink: 0, accentColor: "var(--accent)" }}
              />
              <span>
                ยอมรับ{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  style={{ color: "var(--accent)", textDecoration: "underline" }}
                >
                  นโยบายความเป็นส่วนตัว
                </Link>{" "}
                เพื่อสร้างบัญชี
              </span>
            </label>
          )}
          {SITE_KEY && <div ref={turnstileRef} />}
          <button type="submit" className="btn btn-primary btn-block" disabled={verifying}>
            {verifying ? "กำลังตรวจสอบ…" : "ยืนยัน"}
          </button>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <button type="button" onClick={backToPhone} className="btn btn-text btn-primary btn-s">
              เปลี่ยนเบอร์
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || secondsLeft > 0 || Boolean(SITE_KEY && !turnstileToken)}
              className="btn btn-text btn-default btn-s"
            >
              {secondsLeft > 0 ? `ส่งรหัสอีกครั้ง (${secondsLeft})` : "ส่งรหัสอีกครั้ง"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p
          role="alert"
          style={{ margin: 0, color: "var(--danger)", fontSize: 13, fontWeight: 600 }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
