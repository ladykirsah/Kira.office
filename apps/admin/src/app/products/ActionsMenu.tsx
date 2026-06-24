"use client";

import { useEffect, useRef, useState } from "react";
import { archiveProduct } from "@/lib/api";
import { useToast } from "../ToastProvider";

/**
 * Per-row "Actions ▾" dropdown for the products table: Edit + Archive (with an inline confirm).
 * Closes on outside-click or Escape. Room to add more actions later (Duplicate, View on Shopee…).
 */
export function ActionsMenu({ productId, status }: { productId: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const archived = status === "archived";

  function close() {
    setOpen(false);
    setArmed(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function doArchive() {
    setBusy(true);
    try {
      await archiveProduct(productId);
      toast("Product archived", "success");
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

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
          <a className="actions-item" role="menuitem" href={`/products/${productId}/edit`}>
            Edit
          </a>
          {archived ? (
            <span className="actions-item is-disabled">Archived</span>
          ) : armed ? (
            <div className="actions-confirm">
              <span className="muted" style={{ fontSize: 13 }}>
                Archive this product?
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn-danger" disabled={busy} onClick={doArchive}>
                  Archive
                </button>
                <button type="button" disabled={busy} onClick={() => setArmed(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="actions-item danger"
              role="menuitem"
              onClick={() => setArmed(true)}
            >
              Archive
            </button>
          )}
        </div>
      )}
    </div>
  );
}
