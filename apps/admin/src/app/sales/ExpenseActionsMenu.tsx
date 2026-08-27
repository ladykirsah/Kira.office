"use client";

import { useEffect, useRef, useState } from "react";
import { deleteExpense } from "@/lib/api";
import { useToast } from "../ToastProvider";
import { useT } from "../LangProvider";

/**
 * Per-row "Actions ▾" dropdown for an expense: Edit (opens the inline editor via onEdit) and Delete
 * (inline confirm → soft-delete). Same look as the Orders / Den Air row menus. Closes on outside
 * click or Escape.
 */
export function ExpenseActionsMenu({
  expenseId,
  onEdit,
  onDeleted,
}: {
  expenseId: string;
  onEdit: () => void;
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const t = useT();

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

  async function doDelete() {
    setBusy(true);
    try {
      await deleteExpense(expenseId);
      toast(t({ th: "ลบค่าใช้จ่ายแล้ว", en: "Expense deleted" }), "success");
      onDeleted(expenseId);
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
          <button
            type="button"
            className="actions-item"
            role="menuitem"
            onClick={() => {
              close();
              onEdit();
            }}
          >
            {t({ th: "แก้ไข", en: "Edit" })}
          </button>
          {armed ? (
            <div className="actions-confirm">
              <span className="muted" style={{ fontSize: 12 }}>
                {t({ th: "ลบค่าใช้จ่ายนี้?", en: "Delete this expense?" })}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn-danger" disabled={busy} onClick={doDelete}>
                  {t({ th: "ลบ", en: "Delete" })}
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
              {t({ th: "ลบ", en: "Delete" })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
