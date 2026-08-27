"use client";

import { useRouter } from "next/navigation";
import { inputS } from "@/lib/inputStyles";
import { useT, useLang } from "../../../LangProvider";
import { ROLE_LABEL } from "@/lib/roleLabel";
import type { Lang, Phrase } from "@/lib/lang";

export interface ActivityRow {
  id: string;
  userId: string;
  name: string;
  role: "super_admin" | "admin" | "mechanic";
  kind: string;
  detail: string | null;
  createdAt: number;
}

/**
 * What each kind of event says, and the colour of its dot. Red is the one you look for.
 *
 * Each one hands back BOTH languages and lets the screen pick, because this is a plain map — it
 * cannot reach the reader's language itself.
 */
const KIND: Record<string, { text: (d: string | null) => Phrase; colour: string }> = {
  password_changed: {
    text: () => ({ th: "เปลี่ยนรหัสผ่านของตัวเอง", en: "Changed their password" }),
    colour: "var(--text-muted)",
  },
  pin_changed: {
    text: () => ({ th: "เปลี่ยนรหัส 6 หลักของตัวเอง", en: "Changed their PIN" }),
    colour: "var(--text-muted)",
  },
  day_off: {
    text: (d) => ({ th: `บันทึกวันหยุด — ${d ?? ""}`, en: `Recorded a day off — ${d ?? ""}` }),
    colour: "var(--ok)",
  },
  day_off_edit: {
    text: (d) => ({ th: `แก้ไขวันหยุด — ${d ?? ""}`, en: `Edited a day off — ${d ?? ""}` }),
    colour: "var(--text-muted)",
  },
  // Coral, not grey: a deleted day off is the one day-off action that puts a day's wage back, and
  // it is the only one staff cannot do themselves. Worth being able to find in the list.
  day_off_delete: {
    text: (d) => ({ th: `ลบวันหยุด — ${d ?? ""}`, en: `Deleted a day off — ${d ?? ""}` }),
    colour: "var(--primary)",
  },
  locked: {
    text: (d) => ({
      th: `เข้าใช้งานผิด 3 ครั้ง — ล็อก ${d ?? ""}`,
      en: `3 failed sign-ins — locked ${d ?? ""}`,
    }),
    colour: "var(--danger)",
  },
  salary_paid: {
    text: (d) => ({ th: `จ่ายเงินเดือนแล้ว — ${d ?? ""}`, en: `Marked salary paid — ${d ?? ""}` }),
    colour: "var(--primary)",
  },
  /**
   * THE EMERGENCY DOOR BEING USED. Red, and deliberately the loudest thing in this list: it is the
   * one event the owner must be able to find afterwards, whether or not it was them who did it.
   */
  recovery_login: {
    text: () => ({
      th: "เข้าใช้งานผ่านทางเข้าฉุกเฉิน",
      en: "Signed in through the emergency entrance",
    }),
    colour: "var(--danger)",
  },
  recovery_key_set: {
    text: () => ({ th: "ตั้งกุญแจฉุกเฉินใหม่", en: "Set a new emergency key" }),
    colour: "var(--primary)",
  },
  recovery_key_cleared: {
    text: () => ({ th: "ลบกุญแจฉุกเฉิน", en: "Removed the emergency key" }),
    colour: "var(--primary)",
  },
  profile_edited: {
    text: (d) =>
      d ? { th: d, en: d } : { th: "แก้ไขโปรไฟล์ของตัวเอง", en: "Updated their profile" },
    colour: "var(--text-muted)",
  },
};

function describe(row: ActivityRow, t: (p: Phrase) => string): { text: string; colour: string } {
  const k = KIND[row.kind];
  return k
    ? { text: t(k.text(row.detail)), colour: k.colour }
    : { text: row.detail ?? row.kind, colour: "var(--text-muted)" };
}

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * Today / Yesterday / the date — the heading each run of rows sits under.
 *
 * The DATE follows the reader too, not just the words around it: a Thai heading with an English
 * month in the middle of it reads as neither language.
 */
function dayHeading(ms: number, lang: Lang, t: (p: Phrase) => string): string {
  const locale = lang === "th" ? "th-TH" : "en-GB";
  const d = new Date(ms);
  const today = new Date();
  const dayMonth = d.toLocaleDateString(locale, { day: "numeric", month: "long" });
  if (d.toDateString() === today.toDateString())
    return `${t({ th: "วันนี้", en: "Today" })} · ${dayMonth}`;
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString())
    return `${t({ th: "เมื่อวาน", en: "Yesterday" })} · ${dayMonth}`;
  return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}

export function ActivityView({
  activity,
  people,
  person,
  month,
  months,
}: {
  activity: ActivityRow[];
  people: { id: string; name: string }[];
  person: string;
  month: string;
  months: { value: string; label: string }[];
}) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();

  function go(next: { person?: string; month?: string }) {
    const p = next.person ?? person;
    const m = next.month ?? month;
    const qs = new URLSearchParams();
    if (p) qs.set("person", p);
    if (m) qs.set("month", m);
    router.push(`/settings/staff/activity${qs.toString() ? `?${qs}` : ""}`);
  }

  // Group into days as we go — the rows arrive newest first, so runs are already contiguous.
  const groups: { heading: string; rows: ActivityRow[] }[] = [];
  for (const row of activity) {
    const heading = dayHeading(row.createdAt, lang, t);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.rows.push(row);
    else groups.push({ heading, rows: [row] });
  }

  // The locked list-table pattern (docs/DESIGN_SYSTEM.md): one framed section holds the toolbar
  // and the table — including when the table is empty, so the filters that emptied it stay put.
  // Toolbar controls are S-size; an unset filter reads faint, a set one reads solid.
  return (
    <section className="card">
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 2px", fontSize: 16 }}>
          {t({ th: "ประวัติการทำงาน", en: "Activity" })}
        </h2>
        {/* Month and count, the same shape the วันหยุด card uses — so a reader moving between the
            Staff tabs meets one heading pattern rather than a different one per tab. */}
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          {months.find((m) => m.value === month)?.label ?? month} ·{" "}
          {activity.length === 0
            ? t({ th: "ไม่มีการเปลี่ยนแปลง", en: "no changes" })
            : t({
                th: `${activity.length} รายการ`,
                en: `${activity.length} change${activity.length === 1 ? "" : "s"}`,
              })}
          {person ? ` · ${people.find((p) => p.id === person)?.name ?? ""}` : ""}
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <select
          value={person}
          onChange={(e) => go({ person: e.target.value })}
          aria-label={t({ th: "กรองตามคน", en: "Filter by person" })}
          style={{
            ...inputS,
            color: person ? "var(--text)" : "var(--text-faint)",
            fontWeight: person ? 500 : 400,
          }}
        >
          <option value="">{t({ th: "ทุกคน", en: "Everyone" })}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => go({ month: e.target.value })}
          aria-label={t({ th: "กรองตามเดือน", en: "Filter by month" })}
          style={inputS}
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {activity.length === 0 ? (
        <div className="empty">
          <div className="empty-icon" aria-hidden>
            🕓
          </div>
          {person
            ? t({ th: "เดือนนี้เขาไม่มีรายการ", en: "Nothing recorded for them this month." })
            : t({ th: "เดือนนี้ไม่มีรายการ", en: "Nothing recorded for this month." })}
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.heading}>
              <div className="activity-day">{g.heading}</div>
              <div className="products-scroll">
                <table className="products-table activity-table">
                  <tbody>
                    {g.rows.map((row) => {
                      const d = describe(row, t);
                      return (
                        <tr key={row.id}>
                          <td className="muted num activity-time">{time(row.createdAt)}</td>
                          <td className="activity-person">
                            {row.name}{" "}
                            <span className="muted activity-role">{t(ROLE_LABEL[row.role]!)}</span>
                          </td>
                          <td className="activity-what">
                            <span className="activity-line">
                              <span
                                className="activity-dot"
                                aria-hidden
                                style={{ background: d.colour }}
                              />
                              {d.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
