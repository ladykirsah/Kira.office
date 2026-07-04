"use client";

import { useEffect, useRef, useState } from "react";
import { refundSale } from "@/lib/api";
import { useToast } from "../ToastProvider";

/**
 * Per-row "Actions ▾" dropdown for the sales table: View · Reprint · Refund (inline confirm).
 * View deep-links to the sale's car on the Customers page (its data-collection record); Reprint
 * reopens the finalized bill read-only in the POS. Closes on outside-click or Escape.
 */
export function SalesActionsMenu({
  saleId,
  saleStatus,
  licensePlate,
}: {
  saleId: string;
  saleStatus: string;
  licensePlate: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const refunded = saleStatus === "refunded";

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

  async function doRefund() {
    setBusy(true);
    try {
      const r = await refundSale(saleId);
      if (r.applied) {
        toast(`Refunded — ${r.restockedLines} line(s) restocked`, "success");
        setTimeout(() => location.reload(), 700);
      } else {
        toast(r.reason ?? "Not applied", "error");
      }
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
          {licensePlate ? (
            <a
              className="actions-item"
              role="menuitem"
              href={`/customers?plate=${encodeURIComponent(licensePlate)}`}
            >
              View
            </a>
          ) : (
            <span className="actions-item is-disabled">View</span>
          )}
          <a
            className="actions-item"
            role="menuitem"
            href={`/pos?reprint=${encodeURIComponent(saleId)}`}
          >
            Reprint
          </a>
          {refunded ? (
            <span className="actions-item is-disabled">Refunded</span>
          ) : armed ? (
            <div className="actions-confirm">
              <span className="muted" style={{ fontSize: 12 }}>
                Refund this sale?
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn-danger" disabled={busy} onClick={doRefund}>
                  Refund
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
              Refund
            </button>
          )}
        </div>
      )}
    </div>
  );
}
