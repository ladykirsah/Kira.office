"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "../../ToastProvider";
import { useT } from "../../LangProvider";
import type { StaffRow } from "./PeopleTable";

/**
 * The per-row "Actions ▾" menu — deliberately down to two items (owner, 2026-08-03).
 *
 * View · Change role · Delete. Everything else about a person — password, PIN, pay, contact details
 * — moved onto their profile page, and On/Off became a switch in the table.
 *
 * "Change role" does not change anything by itself: it flips that row's Role column from its tag
 * into a dropdown with a Save beside it. The menu opens the door; the cell does the work.
 *
 * Delete arms before it fires: one click reveals "Really delete?", the second does it. Same pattern
 * the products table uses for Archive.
 */
export function StaffActions({
  row,
  isSelf,
  onChangeRole,
}: {
  row: StaffRow;
  isSelf: boolean;
  /** Puts this row's Role column into edit mode — the cell itself does the saving. */
  onChangeRole: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState<"delete" | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Where to draw the menu, in viewport coordinates.
   *
   * It has to be position:fixed rather than absolute, because the table sits inside an
   * `overflow-x: auto` wrapper (needed so a narrow phone scrolls the columns instead of the page).
   * Any absolutely-positioned child of that wrapper is CLIPPED at its edge — which is exactly what
   * happened: the menu opened and was sliced off at the bottom of the card.
   */
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const t = useT();

  function close() {
    setOpen(false);
    setArmed(null);
    setAt(null);
  }

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 6, right: window.innerWidth - r.right });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // A fixed menu would otherwise stay put while the page moves out from under it.
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  async function call(path: string, init: RequestInit, okMessage: string, reload = true) {
    setBusy(true);
    try {
      const res = await fetch(`/api/worker/staff/${path}`, { credentials: "include", ...init });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(data.error || t({ th: "ทำรายการไม่สำเร็จ", en: "That didn't work." }), "error");
        return;
      }
      toast(okMessage, "success");
      if (reload) setTimeout(() => location.reload(), 500);
    } catch {
      toast(t({ th: "ติดต่อเซิร์ฟเวอร์ไม่ได้", en: "Couldn't reach the server." }), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "inline-block" }} ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className="btn-sm"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => (open ? close() : openMenu())}
      >
        {t({ th: "จัดการ", en: "Actions" })} ▾
      </button>

      {open && at && (
        <div className="row-menu" role="menu" style={{ top: at.top, right: at.right }}>
          <a className="row-menu-item" href={`/settings/staff/${row.id}`} role="menuitem">
            {t({ th: "ดูข้อมูล", en: "View" })}
          </a>
          <button
            type="button"
            className="row-menu-item"
            disabled={isSelf}
            title={
              isSelf
                ? t({ th: "เปลี่ยนตำแหน่งตัวเองไม่ได้", en: "You can't change your own role" })
                : undefined
            }
            onClick={() => {
              onChangeRole();
              close();
            }}
          >
            {t({ th: "เปลี่ยนตำแหน่ง", en: "Change role" })}
          </button>

          <div className="row-menu-sep" />

          {armed === "delete" ? (
            <button
              type="button"
              className="row-menu-item danger"
              disabled={busy}
              onClick={() =>
                void call(
                  row.id,
                  { method: "DELETE" },
                  t({ th: `ลบ ${row.name} แล้ว`, en: `${row.name} deleted` }),
                )
              }
            >
              {busy
                ? t({ th: "กำลังลบ…", en: "Deleting…" })
                : t({ th: "ลบเลยใช่ไหม?", en: "Really delete?" })}
            </button>
          ) : (
            <button
              type="button"
              className="row-menu-item danger"
              onClick={() => setArmed("delete")}
              disabled={busy || isSelf}
              title={
                isSelf
                  ? t({ th: "ลบบัญชีตัวเองไม่ได้", en: "You can't delete your own account" })
                  : undefined
              }
            >
              {t({ th: "ลบ", en: "Delete" })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
