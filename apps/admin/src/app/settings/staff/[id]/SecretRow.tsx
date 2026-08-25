"use client";

import { useState } from "react";
import { confirmationProblem } from "@/lib/secretConfirm";
import { useToast } from "../../../ToastProvider";

/**
 * One credential, one row: the value hidden behind dots, an eye to reveal it, and a reset.
 *
 * Password and PIN use the SAME component so they behave identically — the previous screen had a
 * reveal button for one and a bare "Set / Clear" for the other, which read as two unrelated things
 * (owner: "this flow is not smooth", 2026-08-03).
 *
 * Reset only PROPOSES a value: it fills an editable box and nothing is written until Save. That is
 * what makes a stray click harmless, so there is no separate "are you sure" step.
 *
 * ALSO SERVES A PERSON CHANGING THEIR OWN (owner, 2026-08-25: "function here is messy · 2 function
 * requested here — view, change"). `/me` had a hand-rolled version of this card with a permanently
 * open input box under each secret; it now uses this component, so both sides of the app behave the
 * same. Without `generate` the action opens an EMPTY box and the ↻ is not drawn — you are choosing
 * your own password, not being handed one — and `actionLabel` lets that button read "change" rather
 * than "reset", because nobody resets their own.
 */
export function SecretRow({
  label,
  value,
  hasValue,
  generate,
  onSave,
  actionLabel = "reset",
  confirm = false,
  hint,
  inputMode,
  maxLength,
}: {
  label: string;
  /** The revealed value, or null when there is nothing stored / no key to read it with. */
  value: string | null;
  hasValue: boolean;
  /** Omit when the person is setting their OWN secret: the box opens empty and offers no ↻. */
  generate?: () => string;
  onSave: (next: string) => Promise<boolean>;
  /** The word on the button that opens the box. "reset" when acting on somebody else's. */
  actionLabel?: string;
  /**
   * Ask for the value TWICE before saving. For a secret the person types themselves: a generated
   * one is on screen to be read, so there is nothing to mistype and a second box is only friction.
   */
  confirm?: boolean;
  hint?: string;
  inputMode?: "numeric";
  maxLength?: number;
}) {
  const toast = useToast();
  const [shown, setShown] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);

  function close() {
    setDraft(null);
    setAgain("");
  }

  async function save() {
    if (draft === null) return;
    // The two boxes are checked BEFORE onSave, so a mismatch never reaches the server and never
    // counts as an attempt. Save itself is never disabled (owner, 2026-08-25) — it explains.
    if (confirm) {
      const problem = confirmationProblem(draft, again);
      if (problem) {
        toast(problem, "error");
        return;
      }
    }
    setBusy(true);
    const ok = await onSave(draft);
    setBusy(false);
    if (ok) close();
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
          <button type="button" className="text-btn" onClick={() => setDraft(generate?.() ?? "")}>
            {actionLabel}
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
              if (e.key === "Escape") close();
              if (e.key === "Enter") void save();
            }}
            placeholder={confirm ? `New ${label.toLowerCase()}` : undefined}
            style={{ flex: 1, minWidth: 150 }}
          />
          {/* The second box sits on the SAME line as the first (owner's control sizing), so the two
              read as one question asked twice rather than as two separate fields. */}
          {confirm && (
            <input
              value={again}
              inputMode={inputMode}
              maxLength={maxLength}
              placeholder="พิมพ์อีกครั้ง"
              onChange={(e) =>
                setAgain(
                  inputMode === "numeric" ? e.target.value.replace(/\D/g, "") : e.target.value,
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                if (e.key === "Enter") void save();
              }}
              style={{ flex: 1, minWidth: 150 }}
            />
          )}
          {generate && (
            <button
              type="button"
              className="icon-btn"
              aria-label={`Generate another ${label}`}
              onClick={() => setDraft(generate())}
            >
              ↻
            </button>
          )}
          <button type="button" className="text-btn" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" className="text-btn muted-btn" onClick={close}>
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
