"use client";

import { useRef } from "react";

/**
 * THE file picker for this admin (owner's brief, locked 2026-08-04).
 *
 * A bare `<input type="file">` renders whatever the browser feels like — a grey "Choose File" chip
 * and the words "No file chosen", in the browser's font, at the browser's size, ignoring every
 * token in the design system. Affiliate Promote solved this by hiding the input and clicking it
 * from a real button; that is now the default everywhere.
 *
 * Use this rather than an `<input type="file">` on any new screen.
 */
export function FilePickButton({
  file,
  onPick,
  accept = "image/*",
  label,
  disabled,
}: {
  file: File | null;
  onPick: (file: File | null) => void;
  accept?: string;
  /** What the button reads for a screen reader, e.g. "Transfer slip for สมชาย". */
  label: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        aria-label={label}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className="btn-sm"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        style={{ whiteSpace: "nowrap" }}
      >
        {/* Once something is chosen the button becomes the receipt for it — truncated, because a
            phone camera's filename is longer than the column it sits in. */}
        ＋ {file ? file.name.slice(0, 18) : "Choose…"}
      </button>
    </>
  );
}
