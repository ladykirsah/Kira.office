"use client";

import { useState } from "react";

const CopyIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/** Frameless icon button that copies `value` to the clipboard, with a brief ✓ confirmation. */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — fail quietly rather than throw.
    }
  }

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={copy}
      aria-label={copied ? "Copied" : `Copy ${label ?? value}`}
      title={copied ? "Copied" : "Copy"}
      style={copied ? { color: "var(--primary)" } : undefined}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}
