"use client";

import { useState } from "react";
import { useToast } from "../../ToastProvider";
import { useT } from "../../LangProvider";

/**
 * On / Off, straight from the table (owner, 2026-08-03). On = active, Off = paused.
 *
 * Off is not a soft state: it ends every session that person has open, immediately. So the switch
 * is a real checkbox with a real label rather than a decorative div — it has to be reachable by
 * keyboard and announce what it does.
 */
export function ActiveSwitch({
  userId,
  name,
  active,
  disabled,
}: {
  userId: string;
  name: string;
  active: boolean;
  disabled: boolean;
}) {
  const [on, setOn] = useState(active);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const t = useT();

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/worker/staff/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next ? "active" : "disabled" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setOn(!next);
        toast(data.error || t({ th: "เปลี่ยนไม่สำเร็จ", en: "Couldn't change that." }), "error");
        return;
      }
      toast(
        next
          ? t({ th: `เปิดใช้งาน ${name} แล้ว`, en: `${name} switched on` })
          : t({
              th: `ปิดใช้งาน ${name} แล้ว — ออกจากระบบทุกเครื่อง`,
              en: `${name} switched off — signed out everywhere`,
            }),
        "success",
      );
      setTimeout(() => location.reload(), 600);
    } catch {
      setOn(!next);
      toast(t({ th: "ติดต่อเซิร์ฟเวอร์ไม่ได้", en: "Couldn't reach the server." }), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label
      className="switch switch-wide"
      title={
        disabled
          ? t({ th: "ปิดใช้งานตัวเองไม่ได้", en: "You can't switch yourself off" })
          : undefined
      }
    >
      <input
        type="checkbox"
        checked={on}
        disabled={disabled || busy}
        onChange={toggle}
        aria-label={t({
          th: `${name} ${on ? "เปิดอยู่" : "ปิดอยู่"}`,
          en: `${name} is ${on ? "on" : "off"}`,
        })}
      />
      <span className="switch-track" aria-hidden>
        <span className="switch-knob" />
      </span>
      <span className="switch-text">
        {on ? t({ th: "เปิด", en: "On" }) : t({ th: "ปิด", en: "Off" })}
      </span>
    </label>
  );
}
