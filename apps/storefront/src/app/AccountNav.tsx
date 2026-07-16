"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * Header auth affordance: logged-out → profile icon → /login; logged-in → the same profile icon
 * plus a green presence dot → /account (the dot, not a filled glyph, is what signals "signed in",
 * so both states share the one thin-line profile icon). Probes GET /api/auth/me on mount (session
 * cookie is httpOnly — a client component cannot read it directly).
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
        <Icon name="profile" size={22} />
      </Link>
    );
  }

  return (
    <Link href="/account" aria-label="บัญชีของฉัน" className="hdr-tap">
      <span style={{ position: "relative", display: "inline-flex" }}>
        <Icon name="profile" size={22} />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -2,
            right: -3,
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "var(--brand-blue)",
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
