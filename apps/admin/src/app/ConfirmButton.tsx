"use client";

import { useState, type ReactNode } from "react";

/** A button that arms an inline confirm step instead of using window.confirm. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Confirm",
  disabled,
  className,
  ariaLabel,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  disabled?: boolean;
  /** Styling for the trigger button (e.g. "icon-btn" for an icon-only trigger). */
  className?: string;
  /** Accessible name for the trigger — required when `children` is an icon. */
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);

  if (armed) {
    return (
      <span className="confirm">
        <button
          className="btn-danger"
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button onClick={() => setArmed(false)}>Cancel</button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={() => setArmed(true)}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/** Plain cross icon for delete/remove triggers (stroke, inherits the button's color). */
export function XIcon() {
  return (
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
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
