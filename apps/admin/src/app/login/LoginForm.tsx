"use client";

import { useEffect, useRef, useState } from "react";
import { PinInput } from "./PinInput";
import { isLocalHost } from "@/lib/devApiMismatch";

type Method = "pin" | "password";

/**
 * The two doors, kept genuinely separate (owner, 2026-08-03): a PIN is six digits and nothing else,
 * a password sign-in is email + password. Switching tabs clears whatever was typed, so half of one
 * method can never be submitted alongside the other.
 */
export function LoginForm({ expired = false, next = "/" }: { expired?: boolean; next?: string }) {
  const [method, setMethod] = useState<Method>("pin");
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
        "This copy is not set up for one-click sign-in. Add PRACTICE_COPY=1 to .dev.vars and restart it.",
      );
    } catch {
      setError("Something went wrong. Try again.");
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
          ? "Owner sign-in needs Cloudflare Access switched on for this site."
          : "This sign-in is only for the shop owner's email address.",
      );
    } catch {
      setError("Something went wrong. Try again.");
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
        setError("Can't reach the server. Check the connection and try again.");
      } else if (body.reason === "locked") {
        setError("This account is locked for 24 hours after 3 failed tries.");
        setShowOwner(true);
      } else if (body.reason === "needs_reset") {
        // NOT "wrong password". This account's credential was hashed above the platform's PBKDF2
        // ceiling and can never be verified, however correctly it is typed — saying "wrong" sends
        // someone retyping a password that is right (owner locked out of prod, 9 Aug 2026).
        setError(
          "This login needs resetting — it can't be checked, even if it's correct. Ask a super admin to set a new password or PIN.",
        );
        setShowOwner(true);
      } else if (body.reason === "pin_login_unavailable") {
        setError("PIN sign-in isn't set up yet. Use email and password.");
      } else {
        setError(
          method === "pin" ? "That PIN doesn't match anyone." : "Email or password is wrong.",
        );
        // Surfaced only once something has actually failed, so the everyday login stays the obvious
        // one and this reads as what it is: the way out of being stuck.
        setShowOwner(true);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    !busy && (method === "pin" ? /^\d{6}$/.test(pin) : email.trim() !== "" && password !== "");

  return (
    <form onSubmit={submit}>
      <div className="login-tabs" role="tablist" aria-label="Sign-in method">
        <button
          type="button"
          role="tab"
          aria-selected={method === "pin"}
          className={method === "pin" ? "login-tab on" : "login-tab"}
          onClick={() => switchTo("pin")}
        >
          PIN
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === "password"}
          className={method === "password" ? "login-tab on" : "login-tab"}
          onClick={() => switchTo("password")}
        >
          Password
        </button>
      </div>

      {method === "pin" ? (
        <div style={{ marginBottom: 18 }}>
          <div className="login-label">6-digit PIN</div>
          <PinInput value={pin} onChange={setPin} />
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 14 }}>
            <label className="login-label" htmlFor="email">
              Email
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
              Password
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
            Sign in to the practice copy
          </button>
          <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0", textAlign: "center" }}>
            No password — this copy runs on your computer and holds no real data.
          </p>
        </div>
      )}

      {expired && !error && (
        <div role="status" className="login-error login-note">
          You were signed out. Please sign in again.
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
        {busy ? "Signing in…" : "Sign in"}
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
            I&rsquo;m the shop owner — sign me in
          </button>
          <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
            Uses the email you already verified to reach this page.
          </p>
        </div>
      )}
    </form>
  );
}
