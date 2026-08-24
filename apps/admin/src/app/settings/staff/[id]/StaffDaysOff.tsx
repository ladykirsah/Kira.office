"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LEAVE_MODES, summariseDaysOff, type LeaveHalves } from "@l-shopee/core";
import { useToast } from "../../../ToastProvider";
import { DayOffTable, type DayOffEdit, type DayOffRow } from "../../../DayOffTable";
import { monthLabel } from "@/lib/dayOff";

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
 * EVERYTHING IS ALLOWED HERE — add, correct, delete. Deleting is the owner's alone and stays that
 * way: editing leaves a record that the day was claimed, while removing it erases that it was ever
 * claimed at all, and that is the one that quietly gives back a day's wage. Staff can edit their
 * own rows on /me but never delete, which is why /me tells them to ask the owner. This page is
 * where "ask the owner" ends up. The API enforces the same rule itself (`canManageStaff`), so a
 * page nobody else can open is not the permission — it is the convenience.
 */
export function StaffDaysOff({
  userId,
  month,
  days,
}: {
  userId: string;
  month: string;
  days: DayOffRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [day, setDay] = useState("");
  const [halves, setHalves] = useState<LeaveHalves>(2);
  const [reason, setReason] = useState("");

  async function call(url: string, init: RequestInit, ok: string) {
    const res = await fetch(url, { credentials: "include", ...init });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast(data.error || "ทำรายการไม่สำเร็จ", "error");
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
          <h2 style={{ margin: "0 0 2px", fontSize: 16 }}>วันหยุด</h2>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            {monthLabel(month)} · {summariseDaysOff(days).label}
          </p>
        </div>
        {/* The month lives in the URL, so every month is its own address — bookmarkable, and the
            back button behaves. Same control as the team screen. */}
        <input
          type="month"
          aria-label="เดือน"
          defaultValue={month}
          onChange={(e) => {
            if (e.target.value) router.push(`/settings/staff/${userId}?month=${e.target.value}`);
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
              "บันทึกแล้ว",
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
              "ลบวันหยุดแล้ว",
            );
          } finally {
            setBusy(null);
          }
        }}
      />

      {/* Recording for somebody who forgot. No person picker, unlike the team screen — you are
          already looking at exactly one person, and a picker here could only be used to get it
          wrong. */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginTop: 18,
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
        }}
      >
        <div>
          <label
            className="muted"
            style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}
            htmlFor="staff-day-off-date"
          >
            วันที่
          </label>
          <input
            id="staff-day-off-date"
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
        <div>
          <label
            className="muted"
            style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}
            htmlFor="staff-day-off-mode"
          >
            ลาแบบ
          </label>
          <select
            id="staff-day-off-mode"
            value={halves}
            onChange={(e) => setHalves(Number(e.target.value) as LeaveHalves)}
          >
            {LEAVE_MODES.map((m) => (
              <option key={m.halves} value={m.halves}>
                {m.th}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label
            className="muted"
            style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}
            htmlFor="staff-day-off-reason"
          >
            เหตุผล <span className="faint">(ไม่บังคับ)</span>
          </label>
          <input
            id="staff-day-off-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น ไข้"
            style={{ width: "100%" }}
          />
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!day || busy === "new"}
          onClick={async () => {
            setBusy("new");
            try {
              const ok = await call(
                `/api/worker/staff/${userId}/day-off`,
                {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ day, halves, reason: reason || undefined }),
                },
                "บันทึกวันหยุดแล้ว",
              );
              if (ok) {
                setDay("");
                setReason("");
                setHalves(2);
              }
            } finally {
              setBusy(null);
            }
          }}
        >
          {busy === "new" ? "กำลังบันทึก…" : "บันทึกให้"}
        </button>
      </div>

      <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0" }}>
        ลบได้ที่นี่ — เพราะการลบวันหยุดคือการคืนค่าแรงหนึ่งวัน จึงเป็นสิทธิ์ของเจ้าของ ·
        พนักงานแก้ไขของตัวเองได้ แต่ลบไม่ได้ · เต็มวันและครึ่งวันหักจากวันทำงานของเดือนนั้น ส่วน{" "}
        <b>เข้าสาย ไม่หักเงิน</b>
      </p>
    </section>
  );
}
