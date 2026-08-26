"use client";

import { useState } from "react";
import { useT } from "../LangProvider";

/**
 * The owner's way back in when neither the PIN nor the password works.
 *
 * Nothing on this page is the proof. The proof is the Cloudflare Access token already on the
 * browser's request — Access covers this one address, so reaching this page at all means a code was
 * sent to the owner's mailbox and typed back correctly. The button relays that to the API, which
 * verifies the token against Cloudflare's own keys and then checks the email is named in
 * SUPER_ADMIN_EMAILS. Anyone else Access happens to admit is refused as plainly "not the owner".
 *
 * A button rather than an automatic sign-in on load: arriving somewhere should not silently change
 * who you are, and the page has to explain itself before it acts.
 */
export function RecoverForm({ next }: { next: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // A full navigation, not a router push: every server component has to re-render now that
        // there is a session, and the menu itself depends on the role.
        window.location.href = next;
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { reason?: string };
      setError(
        body.reason === "access_not_configured"
          ? t({
              th: "ทางเข้าฉุกเฉินนี้ต้องเปิด Cloudflare Access ให้ที่อยู่นี้ก่อน ตอนนี้ยังไม่ได้เปิด — ให้เปิดก่อน อย่าเพิ่งพึ่งหน้านี้",
              en: "This rescue needs Cloudflare Access switched on for this address. It is not set up yet — ask for it to be turned on before relying on this page.",
            })
          : t({
              th: "ทางเข้าฉุกเฉินนี้ใช้ได้เฉพาะอีเมลของเจ้าของร้าน ให้เข้าด้วยรหัส 6 หลักหรือรหัสผ่านแทน",
              en: "This rescue is only for the shop owner's email address. Sign in with your PIN or password instead.",
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

  return (
    <>
      {error && (
        <div className="login-error" role="alert">
          {error}
        </div>
      )}
      <button
        type="button"
        className="btn-primary"
        style={{ width: "100%" }}
        onClick={signInAsOwner}
        disabled={busy}
      >
        {busy
          ? t({ th: "กำลังเข้าใช้งาน…", en: "Signing in…" })
          : t({ th: "เข้าใช้งานเป็นเจ้าของร้าน", en: "Sign in as the owner" })}
      </button>
    </>
  );
}
