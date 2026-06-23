"use client";

import { useState, type ReactNode } from "react";

/** A button that arms an inline confirm step instead of using window.confirm. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Confirm",
  disabled,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  disabled?: boolean;
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
    <button onClick={() => setArmed(true)} disabled={disabled}>
      {children}
    </button>
  );
}
