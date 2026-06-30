"use client";

import { useEffect, useRef, useState } from "react";
import type { ServiceRow } from "@/lib/api";

/**
 * Service picker styled like the products "Actions" dropdown: a full-width button that opens a
 * popover menu of the saved services. Closes on outside-click, Escape, or scroll. (Ad-hoc items
 * are handled by the separate "Add-on" mode, so there's no manual-entry option here.)
 *
 * The menu is `position: fixed` (anchored to the button via getBoundingClientRect) because the POS
 * service workspace sits inside `.pos-groups-scroll` (overflow:auto) — an absolute popover would be
 * clipped by that scroll container; a fixed one escapes it.
 */
export function ServiceSelect({
  services,
  value,
  onSelect,
}: {
  services: ServiceRow[];
  value: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const dismiss = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  const placeholder = value === "";
  const label = placeholder
    ? "Choose a service…"
    : (services.find((s) => s.id === value)?.name ?? "Choose a service…");

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        ref={btnRef}
        type="button"
        className="actions-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        style={{
          width: "100%",
          justifyContent: "space-between",
          padding: "8px 10px",
          fontSize: 14,
          color: placeholder ? "var(--text-muted)" : "var(--text)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
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
          style={{
            flex: "none",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .12s",
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="actions-menu"
          role="menu"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            right: "auto",
            width: pos.width,
            minWidth: 0,
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              className="actions-item"
              role="menuitem"
              aria-current={s.id === value}
              onClick={() => choose(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
