"use client";

import { useEffect, useRef, useState } from "react";
import type { SignedInStaff } from "@/lib/staffSession";
import { useT } from "./LangProvider";
import { ROLE_LABEL } from "@/lib/roleLabel";

/**
 * Who is signed in, in the top bar on every page.
 *
 * This is deliberately not a menu entry: it belongs where you can always see it, because the
 * counter tablet is shared and "whose session is this?" has to be answerable at a glance before
 * anyone takes money on it.
 */
export function StaffChip({ staff }: { staff: SignedInStaff }) {
  const t = useT();
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

  async function signOut() {
    await fetch("/api/staff/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="staff-chip-wrap" ref={ref}>
      <button
        type="button"
        className="staff-chip"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="staff-chip-name">{staff.name}</span>
        <span className="staff-chip-role">{t(ROLE_LABEL[staff.role])}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="staff-chip-menu" role="menu">
          <a className="staff-chip-item" href="/me" role="menuitem">
            {t({ th: "โปรไฟล์ของฉัน", en: "My profile" })}
          </a>
          <button type="button" className="staff-chip-item" role="menuitem" onClick={signOut}>
            {t({ th: "ออกจากระบบ", en: "Sign out" })}
          </button>
        </div>
      )}
    </div>
  );
}
