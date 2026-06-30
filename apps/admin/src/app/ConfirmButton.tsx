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
  onArmedChange,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  disabled?: boolean;
  /** Styling for the trigger button (e.g. "icon-btn" for an icon-only trigger). */
  className?: string;
  /** Accessible name for the trigger — required when `children` is an icon. */
  ariaLabel?: string;
  /** Notified when the inline confirm is shown/hidden — e.g. to hide sibling controls while armed. */
  onArmedChange?: (armed: boolean) => void;
}) {
  const [armed, setArmed] = useState(false);
  const arm = (next: boolean) => {
    setArmed(next);
    onArmedChange?.(next);
  };

  if (armed) {
    return (
      <span className="confirm">
        <button
          className="btn-danger btn-sm"
          onClick={() => {
            arm(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button className="btn-sm" onClick={() => arm(false)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={() => arm(true)}
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
