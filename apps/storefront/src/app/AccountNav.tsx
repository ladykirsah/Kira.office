"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Header auth affordance: logged-out → outline person icon → /login; logged-in → filled person
 * icon + green presence dot → /account. Probes GET /api/auth/me on mount (session cookie is
 * httpOnly — a client component cannot read it directly).
 */
export function AccountNav() {
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setLoggedIn(Boolean((d as { customer?: unknown }).customer));
      })
      .catch(() => {
        /* probe failure = treat as logged out */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!loggedIn) {
    return (
      <Link href="/login" aria-label="เข้าสู่ระบบ" className="hdr-tap">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M4.5 19.5c1.4-3.2 4.2-4.8 7.5-4.8s6.1 1.6 7.5 4.8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </Link>
    );
  }

  return (
    <Link href="/account" aria-label="บัญชีของฉัน" className="hdr-tap">
      <span style={{ position: "relative", display: "inline-flex" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="8" r="4.2" />
          <path d="M4 20.2c1.5-3.6 4.6-5.4 8-5.4s6.5 1.8 8 5.4c.1.4-.2.8-.6.8H4.6c-.4 0-.7-.4-.6-.8Z" />
        </svg>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -2,
            right: -3,
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "var(--ok)",
            border: "2px solid var(--surface)",
          }}
        />
      </span>
    </Link>
  );
}

/** Small logout button for the account page (POST-only route; JSON body satisfies guardMutation). */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    } catch {
      // network hiccup — still navigate home; the cookie stays and the user can retry
    }
    router.push("/");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={busy}
      className="btn btn-s btn-outline btn-secondary"
    >
      {busy ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
    </button>
  );
}
