"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LEAVE_MODES, summariseDaysOff, type LeaveHalves } from "@l-shopee/core";
import { useToast } from "../../../ToastProvider";
import { useT, useLang } from "../../../LangProvider";
import { DayOffTable, type DayOffEdit, type DayOffRow } from "../../../DayOffTable";
import { monthLabel } from "@/lib/dayOff";

/**
 * The owner's view of the team's month: who was off, and the form for recording a day somebody
 * forgot to enter themselves.
 *
 * Only this screen can delete (owner, 5 Aug 2026). Staff may edit their own rows, which keeps a
 * record that the day was claimed; removing it altogether restores a day's wage, so that stays with
 * the person who signs the wages.
 */

export interface TeamPerson {
  id: string;
  name: string;
  nameTh?: string | null;
  role: string;
}

export function TeamDaysOff({
  month,
  days,
  people,
}: {
  month: string;
  days: DayOffRow[];
  people: TeamPerson[];
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const lang = useLang();
  const [busy, setBusy] = useState<string | null>(null);
  const [who, setWho] = useState(people[0]?.id ?? "");
  const [day, setDay] = useState("");
  const [halves, setHalves] = useState<LeaveHalves>(2);
  const [reason, setReason] = useState("");

  async function call(url: string, init: RequestInit, ok: string) {
    const res = await fetch(url, { credentials: "include", ...init });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast(data.error || t({ th: "ทำรายการไม่สำเร็จ", en: "That didn't work." }), "error");
      return false;
    }
    toast(ok, "success");
    router.refresh();
    return true;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section className="card">
        <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>
          {t({ th: "บันทึกให้พนักงาน", en: "Record for someone" })}
        </h2>
        <p className="muted" style={{ fontSize: 13.5, margin: "0 0 14px" }}>
          {t({
            th: "เมื่อพนักงานลืมบันทึกเอง — บันทึกทีละวันเหมือนกัน",
            en: "For when they forgot to record it themselves — one day at a time, as they would.",
          })}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label
              className="muted"
              style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}
            >
              {t({ th: "พนักงาน", en: "Person" })}
            </label>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameTh || p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="muted"
              style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}
            >
              {t({ th: "วันที่", en: "Date" })}
            </label>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div>
            <label
              className="muted"
              style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}
            >
              {t({ th: "ลาแบบ", en: "Kind of leave" })}
            </label>
            <select
              value={halves}
              onChange={(e) => setHalves(Number(e.target.value) as LeaveHalves)}
            >
              {LEAVE_MODES.map((m) => (
                <option key={m.halves} value={m.halves}>
                  {lang === "th" ? m.th : m.en}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label
              className="muted"
              style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}
            >
              {t({ th: "เหตุผล", en: "Reason" })}{" "}
              <span className="muted">{t({ th: "(ไม่บังคับ)", en: "(optional)" })}</span>
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t({ th: "เช่น ไข้", en: "e.g. fever" })}
              style={{ width: "100%" }}
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={!who || !day || busy === "new"}
            onClick={async () => {
              setBusy("new");
              try {
                const ok = await call(
                  `/api/worker/staff/${who}/day-off`,
                  {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ day, halves, reason: reason || undefined }),
                  },
                  t({ th: "บันทึกแล้ว", en: "Saved" }),
                );
                if (ok) {
                  setDay("");
                  setReason("");
                }
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "new"
              ? t({ th: "กำลังบันทึก…", en: "Saving…" })
              : t({ th: "บันทึก", en: "Save" })}
          </button>
        </div>
      </section>

      <section className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <h2 style={{ margin: "0 0 2px", fontSize: 16 }}>
              {t({ th: "วันหยุดของทีม", en: "The team's days off" })}
            </h2>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {monthLabel(month, lang)} · {summariseDaysOff(days, lang).label}
            </p>
          </div>
          {/* A plain link per month keeps every month its own URL — bookmarkable, and the back
              button behaves. */}
          <input
            type="month"
            aria-label={t({ th: "เดือน", en: "Month" })}
            defaultValue={month}
            onChange={(e) => {
              if (e.target.value) router.push(`/settings/staff/days-off?month=${e.target.value}`);
            }}
          />
        </div>

        <DayOffTable
          rows={days}
          showWho
          canDelete
          busy={busy}
          onSave={async (row: DayOffRow, next: DayOffEdit) => {
            setBusy(row.id);
            try {
              await call(
                `/api/worker/staff/days-off/${row.id}`,
                {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    day: next.day,
                    halves: next.halves,
                    reason: next.reason || undefined,
                  }),
                },
                t({ th: "บันทึกแล้ว", en: "Saved" }),
              );
            } finally {
              setBusy(null);
            }
          }}
          onDelete={async (row: DayOffRow) => {
            setBusy(row.id);
            try {
              await call(
                `/api/worker/staff/days-off/${row.id}`,
                { method: "DELETE" },
                t({ th: "ลบวันหยุดแล้ว", en: "Day off deleted" }),
              );
            } finally {
              setBusy(null);
            }
          }}
        />

        <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0" }}>
          {t({
            th: "ลบได้เฉพาะที่นี่ — พนักงานแก้ไขของตัวเองได้อย่างเดียว · เต็มวันและครึ่งวันหักจากวันทำงานของเดือนนั้น ส่วน ",
            en: "Only here can a day off be deleted — staff can edit their own and nothing more. Full and half days come off that month's working days. ",
          })}
          <b>{t({ th: "เข้าสาย ไม่หักเงิน", en: "Arriving late costs nothing." })}</b>
        </p>
      </section>
    </div>
  );
}
