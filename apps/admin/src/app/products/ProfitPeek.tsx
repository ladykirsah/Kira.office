"use client";

import { useState } from "react";
import { useT } from "../LangProvider";

const baht = (s: number) => `฿${(s / 100).toFixed(2)}`;

/** Press-and-hold the eye to reveal profit; release to hide it (keeps margins off-screen at a glance). */
export function ProfitPeek({ value }: { value: number }) {
  const t = useT();
  const [show, setShow] = useState(false);
  const hide = () => setShow(false);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        aria-label={t({ th: "กดค้างเพื่อดูกำไร", en: "Hold to reveal profit" })}
        title={t({ th: "กดค้างเพื่อดูกำไร", en: "Hold to see profit" })}
        onPointerDown={() => setShow(true)}
        onPointerUp={hide}
        onPointerLeave={hide}
        onPointerCancel={hide}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          minHeight: 0,
          padding: "3px 7px",
          lineHeight: 1,
          cursor: "pointer",
          touchAction: "none",
          userSelect: "none",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      {show ? (
        <strong style={{ color: value >= 0 ? "var(--ok)" : "var(--danger)" }}>
          {t({ th: "กำไร", en: "profit" })} {baht(value)}
        </strong>
      ) : (
        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
          {t({ th: "กดค้างเพื่อดูกำไร", en: "hold to see profit" })}
        </span>
      )}
    </span>
  );
}
