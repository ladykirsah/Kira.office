"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { summariseDaysOff } from "@l-shopee/core";
import { useToast } from "../../../ToastProvider";
import { DayOffTable, type DayOffEdit, type DayOffRow } from "../../../DayOffTable";
import { monthLabel } from "@/lib/dayOff";
import { MonthYearPicker } from "../../../MonthYearPicker";
import { useT, useLang } from "../../../LangProvider";

/**
 * One person's วันหยุด, on their profile (owner, 2026-08-24).
 *
 * The team screen under Staff → วันหยุด answers "who was off in August". This answers "when was
 * THIS person off", which is the question you actually have while looking at their day rate and
 * their wage — and the answer used to need a second screen and a scan down a list of everybody.
 *
 * ONE MONTH AT A TIME, with the month in the URL (owner's choice). That matches the other two
 * day-off screens, so the habit transfers, and it pairs with the Payments table below — which is
 * also month by month, because a month's days off are what produced that month's wage.
 *
 * READ, CORRECT, DELETE — but NOT add. Adding happens in Record above, which is the one input point
 * on this page (owner, 2026-08-24); this card carried its own add form for a few hours and that was
 * simply two ways to do the same thing on one screen. The staff member's own profile keeps its
 * inline form, because there is no Record section there.
 *
 * Deleting is the owner's alone and stays that way: editing leaves a record that the day was
 * claimed, while removing it erases that it was ever claimed at all, and that is the one that
 * quietly gives back a day's wage. Staff can edit their own rows on /me but never delete, which is
 * why /me tells them to ask the owner — and this card is where "ask the owner" ends up. The API
 * enforces the same rule itself (`canManageStaff`), so a page nobody else can open is not the
 * permission, it is the convenience.
 */
export function StaffDaysOff({
  userId,
  month,
  days,
  currentYear,
}: {
  userId: string;
  month: string;
  days: DayOffRow[];
  /** Passed down rather than read from a clock here, so a render is never a moving target. */
  currentYear: number;
}) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

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
            {t({ th: "วันหยุด", en: "Days off" })}
          </h2>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            {monthLabel(month)} · {summariseDaysOff(days).label}
          </p>
        </div>
        {/* This table's OWN month, and nothing else's (owner, 2026-08-24) — Payments below carries
            a separate one, and Record above works from the dates typed into it. Thai names and
            พ.ศ., matching the heading two inches to the left.

            REPLACE, AND DON'T SCROLL (owner, 2026-08-25: "make sure time setting here function the
            same"). The month stays in the URL because that keeps every month its own address, but a
            plain push made this behave nothing like the Payments picker beside it: the page came
            back scrolled to the top, so picking a month threw the card you were reading a thousand
            pixels below the fold. `scroll: false` keeps the card under your finger, and `replace`
            keeps a filter out of the history — Back returns to the staff list, not to the month you
            looked at before, which is the house rule for filters everywhere else. */}
        <MonthYearPicker
          value={month}
          lang={lang}
          label={t({ th: "เดือนของวันหยุด", en: "Month of days off" })}
          currentYear={currentYear}
          onChange={(period) => {
            const url = new URLSearchParams(window.location.search);
            url.set("month", period);
            router.replace(`/settings/staff/${userId}?${url}`, { scroll: false });
          }}
        />
      </div>

      <DayOffTable
        rows={days}
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
          th: "ลบได้ที่นี่ — เพราะการลบวันหยุดคือการคืนค่าแรงหนึ่งวัน จึงเป็นสิทธิ์ของเจ้าของ · พนักงานแก้ไขของตัวเองได้ แต่ลบไม่ได้ · เต็มวันและครึ่งวันหักจากวันทำงานของเดือนนั้น ส่วน ",
          en: "Deleting is yours alone — removing a day off gives back a day's wage. Staff may correct their own rows but never delete one. Full and half days come off that month's working days; ",
        })}
        <b>{t({ th: "เข้าสาย ไม่หักเงิน", en: "arriving late costs nothing" })}</b>
      </p>
    </section>
  );
}
