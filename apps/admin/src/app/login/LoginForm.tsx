"use client";

import { useEffect, useRef, useState } from "react";
import { PinInput } from "./PinInput";

type Method = "pin" | "password";

/**
 * The two doors, kept genuinely separate (owner, 2026-08-03): a PIN is six digits and nothing else,
 * a password sign-in is email + password. Switching tabs clears whatever was typed, so half of one
 * method can never be submitted alongside the other.
 */
export function LoginForm() {
  const [method, setMethod] = useState<Method>("pin");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);

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
        window.location.href = "/";
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { reason?: string; error?: string };
      if (body.error === "unreachable") {
        setError("Can't reach the server. Check the connection and try again.");
      } else if (body.reason === "locked") {
        setError("This account is locked for 24 hours after 3 failed tries.");
      } else if (body.reason === "pin_login_unavailable") {
        setError("PIN sign-in isn't set up yet. Use email and password.");
      } else {
        setError(
          method === "pin" ? "That PIN doesn't match anyone." : "Email or password is wrong.",
        );
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
    </form>
  );
}
