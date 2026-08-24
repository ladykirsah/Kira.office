"use client";

import { useEffect, useState } from "react";
import { describePracticeCopy } from "@/lib/practiceCopy";

/**
 * A permanent strip saying "this is not the real shop" on any admin served from this machine.
 *
 * Rendered from `layout.tsx`, NOT from `AppShell` — deliberately. `AppShell` bails out early for
 * `/login` and for anyone not signed in, which is exactly when this warning matters: the owner's
 * 2026-08-24 lockout happened ON the login page, where `DevApiBanner` is structurally invisible.
 *
 * Not dismissible. The cost of the strip is a few pixels; the cost of not having it was a session
 * spent believing a correct password was wrong (and, in July, believing production data was gone).
 *
 * The check runs in an effect because it reads window.location, which does not exist on the server
 * and would break hydration. That means one frame without the strip — acceptable, since the strip
 * warns about a standing condition, not a momentary one.
 */
export function PracticeCopyBanner() {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setNotice(describePracticeCopy(window.location.hostname));
  }, []);

  if (!notice) return null;

  return (
    <div
      role="status"
      // Distinct hook so a verification pass cannot confuse this with ToastProvider's container or
      // with DevApiBanner, both of which also use role="status".
      data-practice-copy-banner=""
      style={{
        // Amber, never --primary: red is reserved for the one "you are here" control per view.
        background: "#fff4e5",
        color: "#7a4100",
        borderBottom: "1px solid #ffb84d",
        padding: "8px 16px",
        fontSize: 13,
        lineHeight: 1.5,
        textAlign: "center",
      }}
    >
      <strong>⚠ {notice}</strong>
    </div>
  );
}
