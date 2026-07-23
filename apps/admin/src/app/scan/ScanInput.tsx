"use client";

import { useRef, useState } from "react";
import { inputS } from "@/lib/inputStyles";

/**
 * Shared scan input for every scan mode. A keyboard-wedge (USB/Bluetooth) scanner types the code
 * into the focused field and ends with Enter, which submits — the same handheld path POS uses.
 * Pasting or typing a code and pressing the button works too. The field clears and refocuses after
 * each scan so a run of parts can be scanned without touching the keyboard.
 *
 * The phone-camera path is the planned follow-up; it will decode a frame to a code string and call
 * the same `onScan`, so consumers of this component won't change.
 */
export function ScanInput({
  onScan,
  placeholder = "Scan or paste a barcode…",
  buttonLabel = "Add",
  disabled = false,
  autoFocus = true,
}: {
  /** Fired with the trimmed code on Enter or the button. Empty input is ignored. */
  onScan: (code: string) => void;
  placeholder?: string;
  buttonLabel?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [val, setVal] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);

  function submit() {
    const code = val.trim();
    if (!code) return;
    onScan(code);
    setVal(""); // ready for the next scan
    ref.current?.focus();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={{ display: "flex", gap: 8 }}
    >
      <input
        ref={ref}
        autoFocus={autoFocus}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        aria-label="Barcode"
        style={{ flex: 1, ...inputS }}
      />
      <button
        type="submit"
        className="btn-primary"
        disabled={disabled || !val.trim()}
        style={inputS}
      >
        {buttonLabel}
      </button>
    </form>
  );
}
