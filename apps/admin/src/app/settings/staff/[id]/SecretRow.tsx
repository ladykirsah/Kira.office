"use client";

import { useState } from "react";

/**
 * One credential, one row: the value hidden behind dots, an eye to reveal it, and a reset.
 *
 * Password and PIN use the SAME component so they behave identically — the previous screen had a
 * reveal button for one and a bare "Set / Clear" for the other, which read as two unrelated things
 * (owner: "this flow is not smooth", 2026-08-03).
 *
 * Reset only PROPOSES a value: it fills an editable box and nothing is written until Save. That is
 * what makes a stray click harmless, so there is no separate "are you sure" step.
 */
export function SecretRow({
  label,
  value,
  hasValue,
  generate,
  onSave,
  hint,
  inputMode,
  maxLength,
}: {
  label: string;
  /** The revealed value, or null when there is nothing stored / no key to read it with. */
  value: string | null;
  hasValue: boolean;
  generate: () => string;
  onSave: (next: string) => Promise<boolean>;
  hint?: string;
  inputMode?: "numeric";
  maxLength?: number;
}) {
  const [shown, setShown] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!draft) return;
    setBusy(true);
    const ok = await onSave(draft);
    setBusy(false);
    if (ok) setDraft(null);
  }

  return (
    <div className="secret-row">
      <div className="secret-label">{label}</div>

      {draft === null ? (
        <div className="secret-line">
          <code className="secret-value">
            {!hasValue ? (
              <span className="faint">not set</span>
            ) : shown ? (
              (value ?? <span className="faint">can&rsquo;t be shown</span>)
            ) : (
              "••••••••"
            )}
          </code>
          <button
            type="button"
            className="icon-btn"
            aria-pressed={shown}
            aria-label={shown ? `Hide ${label}` : `Show ${label}`}
            disabled={!hasValue}
            onClick={() => setShown((v) => !v)}
          >
            {shown ? <EyeOff /> : <Eye />}
          </button>
          <button type="button" className="text-btn" onClick={() => setDraft(generate())}>
            reset
          </button>
        </div>
      ) : (
        <div className="secret-line">
          <input
            value={draft}
            autoFocus
            inputMode={inputMode}
            maxLength={maxLength}
            onChange={(e) =>
              setDraft(inputMode === "numeric" ? e.target.value.replace(/\D/g, "") : e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Escape") setDraft(null);
              if (e.key === "Enter") void save();
            }}
            style={{ flex: 1, minWidth: 150 }}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label={`Generate another ${label}`}
            onClick={() => setDraft(generate())}
          >
            ↻
          </button>
          <button type="button" className="text-btn" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" className="text-btn muted-btn" onClick={() => setDraft(null)}>
            Cancel
          </button>
        </div>
      )}

      {hint && <p className="secret-hint">{hint}</p>}
    </div>
  );
}

/* Thin-line glyphs, matching the admin's icon set — stroke, no fill. */
function Eye() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOff() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M17.9 17.9A10.1 10.1 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A10.1 10.1 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.2 3.2M9.9 9.9a3 3 0 1 0 4.2 4.2" />
      <path d="M1 1l22 22" />
    </svg>
  );
}
