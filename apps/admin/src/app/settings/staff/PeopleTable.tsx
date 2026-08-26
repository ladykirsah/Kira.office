"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "../../ToastProvider";
import { useT, useLang } from "../../LangProvider";
import type { Lang, Phrase } from "@/lib/lang";
import { StaffTabs } from "./StaffTabs";
import { StaffActions } from "./StaffActions";
import { RoleCell } from "./RoleCell";
import { ActiveSwitch } from "./ActiveSwitch";
import { AddPersonCard } from "./AddPersonCard";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "mechanic";
  status: string;
  createdAt: number;
  lastLoginAt: number | null;
  hasPassword: number;
}

/** "Today, 13:04" for something recent, a plain date once it stops being useful to know the hour. */
function lastSeen(ms: number | null, lang: Lang, t: (p: Phrase) => string): string {
  if (!ms) return t({ th: "ยังไม่เคย", en: "Never" });
  const d = new Date(ms);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return t({ th: `วันนี้ ${time}`, en: `Today, ${time}` });
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString())
    return t({ th: `เมื่อวาน ${time}`, en: `Yesterday, ${time}` });
  return d.toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PeopleTable({ staff, meId }: { staff: StaffRow[]; meId: string }) {
  const [adding, setAdding] = useState(false);
  // Which row is currently in role-edit mode. Held here, not in the cell, because the thing that
  // opens it lives in a different component — the Actions menu.
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const toast = useToast();
  const t = useT();
  const lang = useLang();

  return (
    <>
      {/* Add person rides on the tab row (owner, 2026-08-04) rather than sitting inside the frame,
          so the framed section holds nothing but the list itself. */}
      <StaffTabs
        active="people"
        action={
          <button type="button" className="btn-primary" onClick={() => setAdding((v) => !v)}>
            {adding ? t({ th: "ยกเลิก", en: "Cancel" }) : t({ th: "เพิ่มคน", en: "Add person" })}
          </button>
        }
      />

      {adding && (
        <AddPersonCard
          onDone={(name) => {
            toast(`${name} added`, "success");
            location.reload();
          }}
        />
      )}

      {/* The locked list-table pattern (docs/DESIGN_SYSTEM.md): the table lives in a framed
          section. No search or tabs of its own — a shop has a handful of staff, and a filter with
          nothing to filter is furniture. */}
      <section className="card">
        <div className="products-scroll">
          <table className="products-table">
            <thead>
              <tr>
                <th>{t({ th: "ชื่อ", en: "Name" })}</th>
                <th>{t({ th: "ตำแหน่ง", en: "Role" })}</th>
                <th>{t({ th: "เปิด", en: "On" })}</th>
                <th>{t({ th: "เข้าใช้งานล่าสุด", en: "Last signed in" })}</th>
                <th
                  style={{ textAlign: "right" }}
                  aria-label={t({ th: "จัดการ", en: "Actions" })}
                />
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const off = s.status !== "active";
                return (
                  <tr key={s.id}>
                    <td>
                      {/* Identity cell: the name is the link to the record, as on every other
                          list. No thumbnail — staff have no picture, and an empty square is
                          decoration (owner, 2026-08-04). */}
                      <Link href={`/settings/staff/${s.id}`} style={{ fontWeight: 600 }}>
                        {s.name}
                      </Link>
                      {s.id === meId && (
                        <span className="faint" style={{ fontWeight: 400 }}>
                          {" "}
                          — you
                        </span>
                      )}
                      <div className="muted" style={{ fontSize: 13 }}>
                        {s.email}
                      </div>
                    </td>
                    <td>
                      <RoleCell
                        userId={s.id}
                        role={s.role}
                        off={off}
                        editing={editingRole === s.id}
                        onDone={() => setEditingRole(null)}
                      />
                    </td>
                    <td>
                      <ActiveSwitch
                        userId={s.id}
                        name={s.name}
                        active={!off}
                        disabled={s.id === meId}
                      />
                    </td>
                    <td className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {lastSeen(s.lastLoginAt, lang, t)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <StaffActions
                        row={s}
                        isSelf={s.id === meId}
                        onChangeRole={() => setEditingRole(s.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="muted" style={{ fontSize: 13, marginTop: 12, maxWidth: "70ch" }}>
        {t({
          th: "ลบคนออกจะลบทางเข้าใช้งาน ข้อมูลติดต่อ และรหัส 6 หลักของเขา — แต่ชื่อยังอยู่บนบิลและรายการสต็อกที่เขาทำไว้ ย้อนดูได้เสมอว่าใครทำอะไร",
          en: "Deleting someone destroys their login, contact details and PIN — but their name stays on the bills and stock movements they made, so you can always ask who did what.",
        })}
      </p>
    </>
  );
}
