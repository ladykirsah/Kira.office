"use client";

import { useEffect, useRef, useState } from "react";
import { PinInput } from "./PinInput";
import { isLocalHost } from "@/lib/devApiMismatch";
import { useT } from "../LangProvider";

type Method = "pin" | "password";

/**
 * The two doors, kept genuinely separate (owner, 2026-08-03): a PIN is six digits and nothing else,
 * a password sign-in is email + password. Switching tabs clears whatever was typed, so half of one
 * method can never be submitted alongside the other.
 */
export function LoginForm({ expired = false, next = "/" }: { expired?: boolean; next?: string }) {
  const t = useT();
  const [method, setMethod] = useState<Method>("pin");
  /**
   * THE EMERGENCY ENTRANCE (owner, 2026-08-26). Two steps, as asked: press it, then type the key.
   *
   * Deliberately NOT a third tab beside รหัส 6 หลัก and รหัสผ่าน. Those are the two everyday doors
   * and belong side by side; this one is for the day neither opens, and putting it in the same row
   * would invite it to be used as a third ordinary choice — which is exactly what a key with no
   * account name attached must not become.
   */
  const [emergency, setEmergency] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showOwner, setShowOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);

  /**
   * Throw away a cookie the API has already disowned.
   *
   * Without this the dead cookie sits in the browser indefinitely, and the middleware — which can
   * only see that a cookie EXISTS — keeps believing this person is signed in and keeps waving their
   * requests through to a layout that immediately bounces them back here. Nothing is broken by
   * that, but the browser's idea of the world stays wrong until they succeed at signing in. Clear
   * it once, on arrival, and the two agree again.
   */
  useEffect(() => {
    if (!expired) return;
    void fetch("/api/staff/logout", { method: "POST" }).catch(() => {});
  }, [expired]);

  /**
   * The sixth digit hands focus to Sign in, so a PIN can be entered without looking up.
   *
   * This has to be an effect, not a callback from the input: at the moment the sixth digit is
   * typed the button is still disabled (React has not re-rendered with the new value yet), and a
   * disabled button cannot take focus — the call simply did nothing.
   *
   * It moves focus rather than submitting. With three failures costing a 24-hour lockout, a PIN
   * must never be sent by the act of finishing it.
   */
  useEffect(() => {
    if (method === "pin" && /^\d{6}$/.test(pin)) submitRef.current?.focus();
  }, [method, pin]);

  function switchTo(next: Method) {
    setMethod(next);
    setPin("");
    setPassword("");
    setError(null);
    // Leaving the emergency door closes it and forgets what was typed, the same way switching
    // between the two everyday doors clears them.
    setEmergency(false);
    setRecoveryKey("");
  }

  /**
   * Spend the emergency key.
   *
   * Its own submit, not a branch inside `submit`, because its failures are its own: there is no
   * account to be locked and no "PIN sign-in is not set up" to report — only "that key does not
   * open this" and "you have tried too often, wait".
   */
  async function signInWithKey() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: recoveryKey }),
      });
      if (res.ok) {
        window.location.href = next;
        return;
      }
      if (res.status === 429) {
        setError(
          t({
            th: "ลองมาหลายครั้งแล้ว รออีกสัก 15 นาทีแล้วค่อยลองใหม่",
            en: "Too many tries. Wait about 15 minutes, then try again.",
          }),
        );
        return;
      }
      // One answer for every refusal, matching the API: saying more would tell a stranger whether
      // an emergency key exists at all.
      setError(t({ th: "กุญแจนี้เปิดไม่ได้", en: "That key does not open this." }));
    } catch {
      setError(
        t({
          th: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่",
          en: "Can't reach the server. Check the connection and try again.",
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * On a practice copy, offer the way in that needs no credential.
   *
   * Shown up front rather than after a failure, unlike the owner link below: on a practice copy
   * this IS the everyday route, and hiding it behind a failed attempt is what cost the owner two
   * sessions on 2026-08-24 — the second one with the "this is a practice copy" banner already on
   * screen, because knowing why you are locked out does not unlock anything.
   *
   * An effect, not a render-time check: `window` does not exist on the server and reading it during
   * render breaks hydration. The API refuses this door in production regardless of what is drawn
   * here — this only decides whether to show a button, never whether it works.
   */
  const [practiceCopy, setPracticeCopy] = useState(false);
  useEffect(() => {
    setPracticeCopy(isLocalHost(window.location.hostname));
  }, []);

  async function signInToPractice() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ practice: true }),
      });
      if (res.ok) {
        window.location.href = next;
        return;
      }
      // The API 404s this door unless it really is a practice copy. Say so plainly rather than
      // "wrong password", which would send someone hunting for a credential that is not the issue.
      setError(
        t({
          th: "เครื่องนี้ยังไม่ได้ตั้งให้เข้าใช้งานแบบคลิกเดียว — เพิ่ม PRACTICE_COPY=1 ใน .dev.vars แล้วเริ่มใหม่",
          en: "This copy is not set up for one-click sign-in. Add PRACTICE_COPY=1 to .dev.vars and restart it.",
        }),
      );
    } catch {
      setError(
        t({ th: "มีบางอย่างผิดพลาด ลองใหม่อีกครั้ง", en: "Something went wrong. Try again." }),
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * The owner's way in when neither door opens: Cloudflare Access has already proved who they are
   * before this page was reachable, so the server can create or repair their staff row and sign
   * them in. Refused for anyone not named in SUPER_ADMIN_EMAILS, so it is not a back door.
   *
   * Offered only after a failed attempt — it is a recovery, not the everyday route, and putting it
   * beside the password box would invite people to use it instead of their own login.
   */
  async function signInAsOwner() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner: true }),
      });
      if (res.ok) {
        window.location.href = next;
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { reason?: string };
      setError(
        body.reason === "access_not_configured"
          ? t({
              th: "ทางเข้าของเจ้าของร้านต้องเปิด Cloudflare Access ให้เว็บนี้ก่อน",
              en: "Owner sign-in needs Cloudflare Access switched on for this site.",
            })
          : t({
              th: "ทางเข้านี้ใช้ได้เฉพาะอีเมลของเจ้าของร้าน",
              en: "This sign-in is only for the shop owner's email address.",
            }),
      );
    } catch {
      setError(
        t({ th: "มีบางอย่างผิดพลาด ลองใหม่อีกครั้ง", en: "Something went wrong. Try again." }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(method === "pin" ? { pin } : { email, password }),
      });
      if (res.ok) {
        // A full navigation, not a router push: every server component has to re-render now that
        // there is a session, and the menu itself depends on the role.
        window.location.href = next;
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { reason?: string; error?: string };
      if (body.error === "unreachable") {
        setError(
          t({
            th: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่",
            en: "Can't reach the server. Check the connection and try again.",
          }),
        );
      } else if (body.reason === "locked") {
        setError(
          t({
            th: "ใส่ผิด 3 ครั้ง บัญชีนี้ถูกล็อก 24 ชั่วโมง",
            en: "This account is locked for 24 hours after 3 failed tries.",
          }),
        );
        setShowOwner(true);
      } else if (body.reason === "needs_reset") {
        // NOT "wrong password". This account's credential was hashed above the platform's PBKDF2
        // ceiling and can never be verified, however correctly it is typed — saying "wrong" sends
        // someone retyping a password that is right (owner locked out of prod, 9 Aug 2026).
        setError(
          t({
            th: "บัญชีนี้ต้องตั้งรหัสใหม่ — ระบบตรวจไม่ได้ ถึงจะใส่ถูกก็ตาม ให้ซูเปอร์แอดมินตั้งรหัสผ่านหรือรหัส 6 หลักให้ใหม่",
            en: "This login needs resetting — it can't be checked, even if it's correct. Ask a super admin to set a new password or PIN.",
          }),
        );
        setShowOwner(true);
      } else if (body.reason === "pin_login_unavailable") {
        setError(
          t({
            th: "ยังไม่ได้เปิดให้เข้าด้วยรหัส 6 หลัก ใช้อีเมลกับรหัสผ่านแทน",
            en: "PIN sign-in isn't set up yet. Use email and password.",
          }),
        );
      } else {
        setError(
          method === "pin"
            ? t({ th: "ไม่มีใครใช้รหัสนี้", en: "That PIN doesn't match anyone." })
            : t({ th: "อีเมลหรือรหัสผ่านไม่ถูกต้อง", en: "Email or password is wrong." }),
        );
        // Surfaced only once something has actually failed, so the everyday login stays the obvious
        // one and this reads as what it is: the way out of being stuck.
        setShowOwner(true);
      }
    } catch {
      setError(
        t({ th: "มีบางอย่างผิดพลาด ลองใหม่อีกครั้ง", en: "Something went wrong. Try again." }),
      );
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    !busy && (method === "pin" ? /^\d{6}$/.test(pin) : email.trim() !== "" && password !== "");

  return (
    <form onSubmit={submit}>
      <div
        className="login-tabs"
        role="tablist"
        aria-label={t({ th: "วิธีเข้าใช้งาน", en: "Sign-in method" })}
      >
        <button
          type="button"
          role="tab"
          aria-selected={method === "pin"}
          className={method === "pin" ? "login-tab on" : "login-tab"}
          onClick={() => switchTo("pin")}
        >
          {t({ th: "รหัส 6 หลัก", en: "PIN" })}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === "password"}
          className={method === "password" ? "login-tab on" : "login-tab"}
          onClick={() => switchTo("password")}
        >
          {t({ th: "รหัสผ่าน", en: "Password" })}
        </button>
      </div>

      {method === "pin" ? (
        <div style={{ marginBottom: 18 }}>
          <div className="login-label">{t({ th: "รหัส 6 หลัก", en: "6-digit PIN" })}</div>
          <PinInput value={pin} onChange={setPin} />
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 14 }}>
            <label className="login-label" htmlFor="email">
              {t({ th: "อีเมล", en: "Email" })}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label className="login-label" htmlFor="password">
              {t({ th: "รหัสผ่าน", en: "Password" })}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%" }}
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>
        </>
      )}

      {practiceCopy && (
        <div className="practice-door">
          <button
            type="button"
            onClick={signInToPractice}
            disabled={busy}
            className="btn-primary"
            style={{ width: "100%" }}
          >
            {t({ th: "เข้าใช้งานเครื่องซ้อม", en: "Sign in to the practice copy" })}
          </button>
          <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0", textAlign: "center" }}>
            {t({
              th: "ไม่ต้องใช้รหัส — เครื่องนี้รันอยู่บนคอมของคุณ และไม่มีข้อมูลจริง",
              en: "No password — this copy runs on your computer and holds no real data.",
            })}
          </p>
        </div>
      )}

      {expired && !error && (
        <div role="status" className="login-error login-note">
          {t({
            th: "ระบบพาออกจากระบบแล้ว กรุณาเข้าใช้งานอีกครั้ง",
            en: "You were signed out. Please sign in again.",
          })}
        </div>
      )}

      {error && (
        <div id="login-error" role="alert" className="login-error">
          {error}
        </div>
      )}

      <button
        ref={submitRef}
        type="submit"
        className="btn-primary"
        style={{ width: "100%" }}
        disabled={!canSubmit}
      >
        {busy
          ? t({ th: "กำลังเข้าใช้งาน…", en: "Signing in…" })
          : t({ th: "เข้าใช้งาน", en: "Sign in" })}
      </button>

      {showOwner && (
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button
            type="button"
            onClick={signInAsOwner}
            disabled={busy}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary)",
              font: "inherit",
              fontSize: 14,
              textDecoration: "underline",
              cursor: "pointer",
              padding: 4,
            }}
          >
            {t({ th: "เป็นเจ้าของร้าน — เข้าใช้งานเลย", en: "I’m the shop owner — sign me in" })}
          </button>
          <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
            {t({
              th: "ใช้อีเมลที่ยืนยันตัวตนไว้แล้วตอนเข้าหน้านี้",
              en: "Uses the email you already verified to reach this page.",
            })}
          </p>
        </div>
      )}

      {/*
        THE EMERGENCY ENTRANCE (owner, 2026-08-26). Two steps: press it, then type the key.

        Always visible, not hidden behind a failure like the owner link above. Being locked out is
        the moment you need it, and a door you can only find by failing first is one you cannot find
        when the failing is the problem.
      */}
      <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        {emergency ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label className="login-label" htmlFor="recovery-key">
              {t({ th: "กุญแจฉุกเฉิน", en: "Emergency key" })}
            </label>
            <input
              id="recovery-key"
              type="password"
              autoComplete="off"
              autoFocus
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1 }}
                disabled={busy || recoveryKey.trim() === ""}
                onClick={signInWithKey}
              >
                {/*
                  NOT simply "Sign in": the everyday form is still on screen above with a button of
                  its own, and two identical buttons a few centimetres apart is a way to press the
                  wrong one — which here means typing your emergency key and being told your PIN is
                  wrong.
                */}
                {busy
                  ? t({ th: "กำลังเข้าใช้งาน…", en: "Signing in…" })
                  : t({ th: "เข้าใช้งานด้วยกุญแจ", en: "Sign in with the key" })}
              </button>
              <button
                type="button"
                className="btn-sm"
                disabled={busy}
                onClick={() => {
                  setEmergency(false);
                  setRecoveryKey("");
                  setError(null);
                }}
              >
                {t({ th: "ยกเลิก", en: "Cancel" })}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEmergency(true);
              setError(null);
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              font: "inherit",
              fontSize: 13,
              textDecoration: "underline",
              cursor: "pointer",
              padding: 4,
              width: "100%",
            }}
          >
            {t({ th: "ทางเข้าฉุกเฉิน", en: "Emergency entrance" })}
          </button>
        )}
      </div>
    </form>
  );
}
