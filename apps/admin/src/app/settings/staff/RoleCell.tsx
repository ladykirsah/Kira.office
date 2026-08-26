"use client";

import { useEffect, useState } from "react";
import { useToast } from "../../ToastProvider";
import { useT } from "../../LangProvider";
import { ROLE_LABEL } from "@/lib/roleLabel";

const ROLES = ["super_admin", "admin", "mechanic"] as const;

/**
 * The Role column, in two modes (owner, 2026-08-03).
 *
 *   view — a tag, which is what a table column should be: something to read, not a control.
 *   edit — a dropdown and a Save, entered deliberately from Actions → Change role.
 *
 * A permanently-live dropdown in every row was the wrong default: a role is not a thing you want to
 * be one stray click away from changing while scanning a list. Escape leaves edit mode without
 * saving, so opening it by mistake costs nothing.
 */
export function RoleCell({
  userId,
  role,
  off,
  editing,
  onDone,
}: {
  userId: string;
  role: string;
  off: boolean;
  editing: boolean;
  onDone: () => void;
}) {
  const [value, setValue] = useState(role);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const t = useT();

  // Leaving edit mode discards whatever was picked — nothing is saved until Save is pressed.
  useEffect(() => {
    if (!editing) setValue(role);
  }, [editing, role]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, onDone]);

  async function save() {
    if (value === role) {
      onDone();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/worker/staff/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(
          data.error || t({ th: "เปลี่ยนตำแหน่งไม่สำเร็จ", en: "Couldn't change that role." }),
          "error",
        );
        return;
      }
      const named = ROLE_LABEL[value] ? t(ROLE_LABEL[value]!) : value;
      toast(t({ th: `เปลี่ยนตำแหน่งเป็น ${named}`, en: `Role changed to ${named}` }), "success");
      setTimeout(() => location.reload(), 500);
    } catch {
      toast(t({ th: "ติดต่อเซิร์ฟเวอร์ไม่ได้", en: "Couldn't reach the server." }), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <span className={off ? "role-pill off" : `role-pill ${role}`}>
        {ROLE_LABEL[role] ? t(ROLE_LABEL[role]!) : role}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <select
        className="role-select"
        value={value}
        disabled={busy}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        aria-label={t({ th: "ตำแหน่ง", en: "Role" })}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {t(ROLE_LABEL[r]!)}
          </option>
        ))}
      </select>
      <button type="button" className="text-btn" disabled={busy} onClick={save}>
        {busy ? t({ th: "กำลังบันทึก…", en: "Saving…" }) : t({ th: "บันทึก", en: "Save" })}
      </button>
    </span>
  );
}
