"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { displayNameError, isAtLeastYears } from "@l-shopee/core";
import { normalizePhone, mmss } from "@/lib/format";
import { spreadOtp, backspaceOtp, otpCode, emptyOtp, OTP_LEN } from "@/lib/otpInput";
import { OTP_TTL_MS } from "@/lib/authCore";

/**
 * Shared phone-OTP login/register widget (login page + checkout embed it). "เลือกโหมดเอง" tabs let
 * the user pick เข้าสู่ระบบ vs สมัครสมาชิก:
 *  - login tab: phone → OTP → in. Returning members NEVER see a consent step.
 *  - register tab: phone + a welcome/transparency panel with the PDPA checkbox (Design A's "ยินดี
 *    ต้อนรับสมาชิกใหม่" — what we collect / why) → OTP → account created.
 * Because the backend returns identical responses for new vs existing phones (privacy), a new user
 * who used the LOGIN tab still gets the same welcome+consent panel as a fallback at the OTP step
 * ({requiresConsent:true}); the code stays valid and verify is resubmitted with pdpaConsent:true.
 * Consent is therefore only ever asked of new registrations. Turnstile renders only when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set (dev skips it entirely).
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

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
  onStepChange,
}: {
  onLoggedIn?: (customer: OtpLoginCustomer) => void;
  compact?: boolean;
  /** Reports the current step so a host page can react (e.g. hide its header on success screens). */
  onStepChange?: (step: "phone" | "code" | "name" | "address") => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState<"phone" | "code" | "name" | "address">("phone");
  /** the just-authenticated customer, held while the name / address step runs */
  const [verified, setVerified] = useState<OtpLoginCustomer | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  // Register tab collects these up front (see the register form): name + a 20+ birthday.
  const [regName, setRegName] = useState("");
  const [bDay, setBDay] = useState("");
  const [bMonth, setBMonth] = useState("");
  const [bYear, setBYear] = useState(""); // Buddhist-era year string
  // พ.ศ. year options: 15..100 years ago. useState initializer so new Date() runs once, not per render.
  const [beYears] = useState(() => {
    const currentBe = new Date().getFullYear() + 543;
    const ys: number[] = [];
    for (let y = currentBe - 15; y >= currentBe - 100; y--) ys.push(y);
    return ys;
  });
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState<string[]>(emptyOtp);
  const code = otpCode(digits);
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);
  const focusBox = (i: number) => boxRefs.current[i]?.focus();
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState(false); // red-flash the boxes after a wrong code
  const [nudge, setNudge] = useState<"login" | "register" | null>(null); // "switch to the other tab"
  const [devCode, setDevCode] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false); // new user who used the login tab (fallback)
  const [consentChecked, setConsentChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Consent is required whenever this could create an account: the register tab, or a login-tab user
  // the server flagged as new. Returning logins never hit this.
  const consentRequired = mode === "register" || needsConsent;

  // Lifetime of the code currently out (matches the server's OTP_TTL_MS). Resetting codeSentAt on
  // every successful send restarts the timer; `now` ticks once a second on the code step so the
  // countdown updates. Resend itself is always available — the server-side throttle, not a client
  // cooldown, is the real guard against spamming.
  const [codeSentAt, setCodeSentAt] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (step !== "code") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);
  const codeSecondsLeft =
    codeSentAt > 0 ? Math.max(0, Math.ceil((codeSentAt + OTP_TTL_MS - now) / 1000)) : 0;

  // Focus the first OTP box the moment the code step appears.
  useEffect(() => {
    if (step === "code") boxRefs.current[0]?.focus();
  }, [step]);

  // Report the current step so the host page can hide its generic header on the success screens.
  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

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
  // Register birthday → ISO "YYYY-MM-DD" (Buddhist year − 543); "" until all three are chosen.
  const dobIso =
    bYear && bMonth && bDay
      ? `${Number(bYear) - 543}-${bMonth.padStart(2, "0")}-${bDay.padStart(2, "0")}`
      : "";
  const regReady = mode !== "register" || (Boolean(regName.trim()) && dobIso !== "");

  function switchMode(next: "login" | "register") {
    if (next === mode) return;
    setMode(next);
    setConsentChecked(false);
    setError(null);
    setNudge(null);
  }

  async function send() {
    if (sending) return;
    if (!phoneOk) {
      setError("กรุณากรอกเบอร์โทรศัพท์ 9-10 หลัก");
      return;
    }
    if (mode === "register") {
      if (!regName.trim()) {
        setError("กรุณากรอกชื่อ-นามสกุล");
        return;
      }
      if (!dobIso) {
        setError("กรุณาเลือกวันเกิดให้ครบ");
        return;
      }
      if (!isAtLeastYears(dobIso, 20, Date.now())) {
        setError("ต้องมีอายุ 20 ปีบริบูรณ์ขึ้นไปจึงจะสมัครสมาชิกได้");
        return;
      }
      if (!consentChecked) {
        setError("กรุณายอมรับนโยบายความเป็นส่วนตัวเพื่อสร้างบัญชี");
        return;
      }
    }
    setSending(true);
    setError(null);
    setOtpError(false);
    setNudge(null);
    setDevCode(null);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: phoneDigits,
          mode,
          ...(mode === "register" ? { dob: dobIso } : {}),
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        sent?: boolean;
        devCode?: string;
        error?: string;
        notRegistered?: boolean;
        alreadyRegistered?: boolean;
      };
      if (res.status === 429) {
        setError(data.error ?? "ขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่");
        return;
      }
      // Registration gate: nudge the user to the correct tab (keeping their phone).
      if (data.notRegistered) {
        setError(data.error ?? "เบอร์นี้ยังไม่ได้สมัครสมาชิก");
        setNudge("register");
        return;
      }
      if (data.alreadyRegistered) {
        setError(data.error ?? "เบอร์นี้มีบัญชีแล้ว");
        setNudge("login");
        return;
      }
      if (!res.ok || !data.sent) {
        setError(data.error ?? "ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      if (data.devCode) setDevCode(data.devCode);
      const sentAt = Date.now();
      setCodeSentAt(sentAt);
      setNow(sentAt);
      setDigits(emptyOtp());
      setStep("code");
    } catch {
      // The request never completed (network drop, timeout, or a transient server hiccup) — a
      // general "try again", not a definitive "your internet is down".
      setError(
        "ส่งรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หากยังไม่ได้ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต",
      );
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
      setError("กรุณากรอกรหัส OTP ให้ครบ 6 หลัก");
      return;
    }
    if (consentRequired && !consentChecked) {
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
          ...(consentChecked ? { pdpaConsent: true } : {}),
          ...(mode === "register" ? { name: regName.trim(), dob: dobIso } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        customer?: OtpLoginCustomer;
        requiresConsent?: boolean;
        error?: string;
      };
      if (data.requiresConsent) {
        // New user on the login tab: the code stays valid — reveal the welcome+consent panel and
        // let them resubmit with pdpaConsent:true. No wasted SMS.
        setNeedsConsent(true);
        setError(data.error ?? "กรุณายอมรับนโยบายความเป็นส่วนตัวเพื่อสร้างบัญชี");
        return;
      }
      if (!res.ok || !data.customer) {
        // Neutral fallback: only a real 401 means "wrong code" (server sends that message); a
        // non-JSON gateway/5xx has no data.error and must not be mislabeled as a bad code.
        setError(data.error ?? "ยืนยันรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        // Wrong code (401): flash the boxes red and clear them for a fresh try. Expired/attempt-cap
        // (410/429) keep the digits so the user can just resend.
        if (res.status === 401) {
          setOtpError(true);
          setDigits(emptyOtp());
          focusBox(0);
        }
        return;
      }
      // Name step (owner, 2026-07-16): ask AFTER the code succeeds, never before. By this point the
      // account exists and the customer is in — so the question costs them nothing to skip, and the
      // friction lands after they have committed rather than in front of the registration form.
      // name === "" is the "never captured" sentinel, so this also catches accounts that predate
      // this step; they get asked once at their next login and can still skip.
      // A brand-new registration (register tab): the account already has the name + DOB entered up
      // front. Standalone (login page) → offer to set up a delivery address; embedded (checkout) →
      // hand back to the caller, which runs its own address step.
      if (mode === "register") {
        if (compact) {
          // checkout embed — hand back to the caller, which runs its own address step
          onLoggedIn?.(data.customer);
          router.refresh();
        } else {
          // standalone /login registration — offer to set up a delivery address
          setVerified(data.customer);
          setStep("address");
        }
        return;
      }
      // Legacy/login accounts with no name captured yet → ask once (skippable).
      if (!data.customer.name) {
        setVerified(data.customer);
        setStep("name");
        return;
      }
      onLoggedIn?.(data.customer);
      router.refresh();
    } catch {
      setError(
        "ยืนยันรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หากยังไม่ได้ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต",
      );
    } finally {
      setVerifying(false);
    }
  }

  function backToPhone() {
    setStep("phone");
    setDigits(emptyOtp());
    setNeedsConsent(false);
    setConsentChecked(false);
    setError(null);
    setOtpError(false);
    setDevCode(null);
  }

  const gap = compact ? 8 : 12;

  // Design A's "ยินดีต้อนรับสมาชิกใหม่" welcome + transparency panel, reused on the register tab
  // (before OTP) and as the login-tab fallback (at the OTP step).
  const consentPanel = (
    <div className="otp-welcome">
      <div className="otp-welcome-t">ยินดีต้อนรับสมาชิกใหม่</div>
      <label className="otp-consent">
        <input
          type="checkbox"
          checked={consentChecked}
          onChange={(e) => {
            setConsentChecked(e.target.checked);
            if (e.target.checked && error) setError(null); // ticking clears the "please accept" alert
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
  );

  /** Save the name, or skip it — either way the customer is already logged in and goes on. */
  async function finishName(save: boolean) {
    const customer = verified;
    if (!customer) return;
    if (!save) {
      onLoggedIn?.(customer);
      router.refresh();
      return;
    }
    const problem = displayNameError(nameInput);
    if (problem) {
      setError(problem);
      return;
    }
    setSavingName(true);
    setError(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nameInput }),
      });
      const data = (await res.json().catch(() => ({}))) as { name?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "บันทึกชื่อไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      onLoggedIn?.({ ...customer, name: data.name ?? nameInput });
      router.refresh();
    } catch {
      // Never trap someone in the login flow over an optional field — they ARE logged in.
      setError("บันทึกชื่อไม่สำเร็จ — คุณเข้าสู่ระบบแล้ว เพิ่มชื่อภายหลังได้ที่หน้าบัญชี");
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {step === "address" ? (
        <div style={{ display: "flex", flexDirection: "column", gap }}>
          <div>
            <h2 className="t-h2" style={{ margin: "0 0 4px", color: "var(--gray-dark)" }}>
              สมัครสมาชิกสำเร็จ 🎉
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              ตั้งค่าที่อยู่จัดส่งเลยไหม? จะช่วยให้สั่งซื้อครั้งต่อไปเร็วขึ้น
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => router.push("/account/addresses")}
          >
            ตั้งค่าที่อยู่จัดส่ง
          </button>
          <button
            type="button"
            className="btn btn-block btn-text btn-default"
            onClick={() => {
              if (verified && onLoggedIn) onLoggedIn(verified);
              else router.push("/account");
            }}
          >
            ข้ามไปก่อน
          </button>
        </div>
      ) : step === "name" ? (
        <form
          style={{ display: "flex", flexDirection: "column", gap }}
          onSubmit={(e) => {
            e.preventDefault();
            void finishName(true);
          }}
        >
          <div>
            <h2 className="t-h2" style={{ margin: "0 0 4px", color: "var(--gray-dark)" }}>
              ยินดีต้อนรับ 👋
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              เราจะเรียกคุณว่าอะไรดี? ใส่ไว้เพื่อให้ร้านติดต่อคุณได้ถูกคน
            </p>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="acct-name">ชื่อ-นามสกุล</label>
            <input
              id="acct-name"
              className="input"
              autoComplete="name"
              placeholder="เช่น สมชาย ใจดี"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
          </div>
          {error && (
            <div role="alert" style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={savingName}>
            {savingName ? "กำลังบันทึก…" : "บันทึกชื่อ"}
          </button>
          {/* Skippable by the owner's call — and safe, because the account already exists. Anyone
              who skips is asked again at checkout, and can add it any time from the account page. */}
          <button
            type="button"
            className="btn btn-block btn-text btn-default"
            onClick={() => void finishName(false)}
            disabled={savingName}
          >
            ข้ามไปก่อน
          </button>
        </form>
      ) : step === "phone" ? (
        <form
          style={{ display: "flex", flexDirection: "column", gap }}
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div className="otp-tabs" role="tablist" aria-label="เลือกโหมด">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "on" : ""}
              onClick={() => switchMode("login")}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "on" : ""}
              onClick={() => switchMode("register")}
            >
              สมัครสมาชิก
            </button>
          </div>
          {mode === "register" && (
            <>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-name">ชื่อ-นามสกุล</label>
                <input
                  id="reg-name"
                  className="input"
                  autoComplete="name"
                  placeholder="เช่น สมชาย ใจดี"
                  value={regName}
                  onChange={(e) => {
                    setRegName(e.target.value);
                    if (error) setError(null);
                  }}
                  required
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>วันเกิด (สมัครได้เมื่ออายุ 20 ปีขึ้นไป)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1.2fr", gap: 8 }}>
                  <select
                    className="input"
                    aria-label="วันเกิด"
                    value={bDay}
                    onChange={(e) => {
                      setBDay(e.target.value);
                      if (error) setError(null);
                    }}
                  >
                    <option value="">วัน</option>
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    aria-label="เดือนเกิด"
                    value={bMonth}
                    onChange={(e) => {
                      setBMonth(e.target.value);
                      if (error) setError(null);
                    }}
                  >
                    <option value="">เดือน</option>
                    {THAI_MONTHS.map((m, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    aria-label="ปีเกิด (พ.ศ.)"
                    value={bYear}
                    onChange={(e) => {
                      setBYear(e.target.value);
                      if (error) setError(null);
                    }}
                  >
                    <option value="">ปี พ.ศ.</option>
                    {beYears.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
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
              onChange={(e) => {
                setPhone(e.target.value);
                if (nudge) setNudge(null);
                if (error) setError(null);
              }}
              required
            />
          </div>
          {mode === "register" && consentPanel}
          {SITE_KEY && <div ref={turnstileRef} />}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={
              sending ||
              Boolean(SITE_KEY && !turnstileToken) ||
              (mode === "register" && (!consentChecked || !regReady))
            }
          >
            {sending ? "กำลังส่งรหัส…" : "รับรหัส OTP"}
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
            <label id="otp-label" htmlFor="otp-0">
              รหัส OTP 6 หลัก
            </label>
            <div className="otp-boxes" role="group" aria-labelledby="otp-label">
              {[0, 1].map((groupIdx) => (
                <div className="otp-group" key={groupIdx}>
                  {[0, 1, 2].map((k) => {
                    const i = groupIdx * 3 + k;
                    return (
                      <input
                        key={i}
                        id={`otp-${i}`}
                        ref={(el) => {
                          boxRefs.current[i] = el;
                        }}
                        className="otp-box"
                        data-error={otpError ? "" : undefined}
                        type="text"
                        inputMode="numeric"
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        maxLength={i === 0 ? OTP_LEN : 1}
                        aria-label={`รหัสหลักที่ ${i + 1}`}
                        value={digits[i]}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          if (otpError) setOtpError(false);
                          if (error) setError(null);
                          const next = spreadOtp(digits, i, e.target.value);
                          setDigits(next.digits);
                          focusBox(next.focus);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && !digits[i]) {
                            e.preventDefault();
                            const next = backspaceOtp(digits, i);
                            setDigits(next.digits);
                            focusBox(next.focus);
                          } else if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            focusBox(Math.max(i - 1, 0));
                          } else if (e.key === "ArrowRight") {
                            e.preventDefault();
                            focusBox(Math.min(i + 1, OTP_LEN - 1));
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const next = spreadOtp(emptyOtp(), 0, e.clipboardData.getData("text"));
                          setDigits(next.digits);
                          focusBox(next.focus);
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {needsConsent && consentPanel}
          {SITE_KEY && <div ref={turnstileRef} />}
          <p
            className="otp-ttl"
            role="status"
            // Only announce the terminal "expired" state — a per-second "4:59… 4:58…" live region
            // would talk over the boxes and the wrong-code alert for screen readers.
            aria-live={codeSecondsLeft === 0 ? "polite" : "off"}
            data-expired={codeSecondsLeft === 0 ? "" : undefined}
          >
            {codeSecondsLeft > 0 ? (
              <>
                รหัสหมดอายุใน <strong>{mmss(codeSecondsLeft)}</strong>
              </>
            ) : (
              <>รหัสหมดอายุแล้ว · กด “ส่งรหัสอีกครั้ง”</>
            )}
          </p>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={verifying || (consentRequired && !consentChecked)}
          >
            {verifying ? "กำลังตรวจสอบ…" : consentRequired ? "สร้างบัญชีและเข้าใช้งาน" : "ยืนยัน"}
          </button>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <button type="button" onClick={backToPhone} className="btn btn-text btn-info btn-s">
              เปลี่ยนเบอร์
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || Boolean(SITE_KEY && !turnstileToken)}
              className="btn btn-text btn-default btn-s"
            >
              {sending ? "กำลังส่ง…" : "ส่งรหัสอีกครั้ง"}
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
      {nudge && (
        <button
          type="button"
          onClick={() => switchMode(nudge)}
          className="btn btn-text btn-primary btn-s"
          style={{ alignSelf: "flex-start", marginTop: -4 }}
        >
          {nudge === "register" ? "สมัครสมาชิกด้วยเบอร์นี้ →" : "เข้าสู่ระบบด้วยเบอร์นี้ →"}
        </button>
      )}
    </div>
  );
}
