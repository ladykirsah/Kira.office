"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { menuPosition } from "@/lib/menuPosition";
import { useT } from "../LangProvider";

/**
 * Per-row "Action ▾" dropdown for the orders table. Only View today — the menu exists so the
 * per-status actions (confirm COD, mark shipped, refund…) have somewhere to land.
 * Closes on outside-click or Escape, same as the products ActionsMenu.
 *
 * The menu is portalled to <body> and fixed-positioned: its row sits inside the table's
 * `overflow-x: auto` scroller, and CSS collapses `overflow-y` to `auto` alongside it, so an
 * absolutely-positioned menu on the last row is clipped by the frame instead of overhanging it.
 */
export function OrderActionsMenu({ orderId }: { orderId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Measure after paint so the menu's real height drives the flip decision.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? 0;
    setPos(menuPosition(rect, { width: window.innerWidth, height: window.innerHeight }, height));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // A fixed menu does not travel with its row, so close rather than drift out of alignment.
    const onReflow = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open]);

  function toggle() {
    setPos(null); // re-measure on every open
    setOpen((o) => !o);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="actions-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
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

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="actions-menu"
            role="menu"
            style={{
              position: "fixed",
              top: pos?.top ?? 0,
              right: pos?.right ?? 0,
              // Hidden for the first paint only, while we measure the real height.
              visibility: pos ? "visible" : "hidden",
            }}
          >
            <a className="actions-item" role="menuitem" href={`/orders/${orderId}`}>
              {t({ th: "ดู", en: "View" })}
            </a>
          </div>,
          document.body,
        )}
    </>
  );
}
