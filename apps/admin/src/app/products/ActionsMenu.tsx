"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Per-row "Actions ▾" dropdown for the products table. Closes on outside-click or Escape.
 *
 * Archive used to live here and was removed on 2026-08-24 (owner: "just delete all current archive
 * menu item"). Two reasons it did not belong in a row menu: it called the same endpoint as the
 * product page's delete box, so the table said "Archive" for the thing the product page called
 * "Delete"; and it was not role-gated, so an admin met a 403 instead of simply not seeing it.
 *
 * Taking a product off the shop — archiving it, or deleting it outright — now happens in one place,
 * at the bottom of the product's own page, where there is room to say what each one does.
 */
export function ActionsMenu({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="actions-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Actions
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .12s" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="actions-menu" role="menu">
          <a className="actions-item" role="menuitem" href={`/products/${productId}/edit?edit=1`}>
            Edit
          </a>
          <a className="actions-item" role="menuitem" href={`/products/${productId}`}>
            View
          </a>
        </div>
      )}
    </div>
  );
}
