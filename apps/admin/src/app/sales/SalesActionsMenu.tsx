"use client";

import { useEffect, useRef, useState } from "react";
import { refundSale } from "@/lib/api";
import { useToast } from "../ToastProvider";
import { useT } from "../LangProvider";

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
  const t = useT();
  const view = t({ th: "ดู", en: "View" });
  const refund = t({ th: "คืนเงิน", en: "Refund" });
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
        toast(
          t({
            th: `คืนเงินแล้ว — คืนสต็อก ${r.restockedLines} รายการ`,
            en: `Refunded — ${r.restockedLines} line(s) restocked`,
          }),
          "success",
        );
        setTimeout(() => location.reload(), 700);
      } else {
        toast(r.reason ?? t({ th: "ทำรายการไม่สำเร็จ", en: "Not applied" }), "error");
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
        {t({ th: "จัดการ", en: "Actions" })}
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
              {view}
            </a>
          ) : (
            <span className="actions-item is-disabled">{view}</span>
          )}
          <a
            className="actions-item"
            role="menuitem"
            href={`/pos?reprint=${encodeURIComponent(saleId)}`}
          >
            {t({ th: "พิมพ์ซ้ำ", en: "Reprint" })}
          </a>
          {refunded ? (
            <span className="actions-item is-disabled">
              {t({ th: "คืนเงินแล้ว", en: "Refunded" })}
            </span>
          ) : armed ? (
            <div className="actions-confirm">
              <span className="muted" style={{ fontSize: 12 }}>
                {t({ th: "คืนเงินรายการขายนี้?", en: "Refund this sale?" })}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn-danger" disabled={busy} onClick={doRefund}>
                  {refund}
                </button>
                <button type="button" disabled={busy} onClick={() => setArmed(false)}>
                  {t({ th: "ยกเลิก", en: "Cancel" })}
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
              {refund}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
