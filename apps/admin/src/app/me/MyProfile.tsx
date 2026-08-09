"use client";

import { useCallback, useEffect, useState } from "react";
import { LEAVE_MODES, bangkokMonth, summariseDaysOff, type LeaveHalves } from "@l-shopee/core";
import { useToast } from "../ToastProvider";
import { DayOffTable, type DayOffEdit, type DayOffRow } from "../DayOffTable";
import { monthLabel } from "@/lib/dayOff";

export interface Profile {
  id: string;
  name: string;
  nameTh: string | null;
  nameEn: string | null;
  email: string;
  role: string;
  phone: string | null;
  emergencyPhone: string | null;
  emergencyName: string | null;
  startedOn: number | null;
  dayRateSatang: number | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  password: string | null;
  hasPin: number;
}

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("en-US")}`;
const thaiDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** A read-only row. Everything here is the owner's to change, not the staff member's. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="muted">{label}</dt>
      <dd style={{ margin: 0 }}>{value ?? <span className="faint">—</span>}</dd>
    </>
  );
}

export function MyProfile({ profile }: { profile: Profile }) {
  const toast = useToast();
  const [shown, setShown] = useState(false);
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [day, setDay] = useState("");
  const [halves, setHalves] = useState<LeaveHalves>(2);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [month] = useState(() => bangkokMonth(Date.now()));
  const [days, setDays] = useState<DayOffRow[]>([]);

  const refreshDays = useCallback(async () => {
    try {
      const res = await fetch(`/api/worker/staff/me/days-off?month=${month}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) setDays(((await res.json()) as { days: DayOffRow[] }).days);
    } catch {
      // A list that will not load is not worth interrupting the page for; the form still works.
    }
  }, [month]);

  useEffect(() => {
    void refreshDays();
  }, [refreshDays]);

  /**
   * An edit PATCHes the row by id so it MOVES, rather than re-posting it — a re-post keys on
   * (person, day) and would leave the original date behind as a day off nobody took.
   */
  async function saveDay(row: DayOffRow, next: DayOffEdit) {
    setBusy(row.id);
    try {
      const res = await fetch(`/api/worker/staff/days-off/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          day: next.day,
          halves: next.halves,
          reason: next.reason || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(data.error || "แก้ไขไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
        return;
      }
      toast("บันทึกแล้ว", "success");
      await refreshDays();
    } finally {
      setBusy(null);
    }
  }

  async function post(path: string, body: unknown, okMessage: string, after: () => void) {
    setBusy(path);
    try {
      const res = await fetch(`/api/worker/staff/me/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(data.error || "That didn't work. Try again.", "error");
        return;
      }
      toast(okMessage, "success");
      after();
    } catch {
      toast("Couldn't reach the server.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 560 }}>
      <section className="card">
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Your details</h2>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px,auto) 1fr",
            gap: "10px 16px",
            margin: 0,
          }}
        >
          <Row label="ชื่อ (Thai)" value={profile.nameTh} />
          <Row label="Name (English)" value={profile.nameEn} />
          <Row label="Email" value={profile.email} />
          <Row label="Phone" value={profile.phone} />
          <Row
            label="Emergency contact"
            value={
              profile.emergencyPhone ? (
                <>
                  {profile.emergencyPhone}
                  {profile.emergencyName && (
                    <span className="faint"> · {profile.emergencyName}</span>
                  )}
                </>
              ) : null
            }
          />
          <Row label="Started" value={profile.startedOn ? thaiDate(profile.startedOn) : null} />
        </dl>
        <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0" }}>
          Ask the owner to change any of these.
        </p>
      </section>

      <section className="card">
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Signing in</h2>

        <div style={{ marginBottom: 16 }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Password
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ fontSize: 15, padding: "6px 10px" }}>
              {shown ? (profile.password ?? "—") : "••••••••••"}
            </code>
            <button type="button" className="btn-sm" onClick={() => setShown((v) => !v)}>
              {shown ? "Hide" : "Show"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ flex: 1, minWidth: 180 }}
            />
            <button
              type="button"
              className="btn-soft"
              disabled={busy === "password" || password.length < 8}
              onClick={() =>
                post("password", { password }, "Password changed", () => {
                  setPassword("");
                  location.reload();
                })
              }
            >
              {busy === "password" ? "Saving…" : "Change"}
            </button>
          </div>
        </div>

        <div>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            6-digit PIN {profile.hasPin ? "" : "— not set yet"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={{ width: 130, letterSpacing: "0.3em", textAlign: "center" }}
            />
            <button
              type="button"
              className="btn-soft"
              disabled={busy === "pin" || !/^\d{6}$/.test(pin)}
              onClick={() =>
                post("pin", { pin }, "PIN set", () => {
                  setPin("");
                  location.reload();
                })
              }
            >
              {busy === "pin" ? "Saving…" : profile.hasPin ? "Change PIN" : "Set PIN"}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
            The PIN signs you in on its own — no email needed. Three wrong tries locks the account
            for 24 hours.
          </p>
        </div>
      </section>

      <section className="card">
        <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>วันหยุด</h2>
        <p className="muted" style={{ fontSize: 13.5, margin: "0 0 14px" }}>
          บันทึกได้เลย ไม่ต้องรออนุมัติ · บันทึกทีละวัน — หยุด 3 วันคือบันทึก 3 ครั้ง ·
          ย้อนหลังได้ถ้าลืมบันทึกวันที่หยุดไปแล้ว
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label
              className="muted"
              style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}
            >
              วันที่
            </label>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div>
            <label
              className="muted"
              style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}
            >
              ลาแบบ
            </label>
            <select
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
            >
              เหตุผล <span className="faint">(ไม่บังคับ)</span>
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น พาแม่ไปหาหมอ"
              style={{ width: "100%" }}
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy === "day-off" || !day}
            onClick={() =>
              post(
                "day-off",
                { day, halves, reason: reason || undefined },
                "บันทึกวันหยุดแล้ว",
                () => {
                  setDay("");
                  setReason("");
                  void refreshDays();
                },
              )
            }
          >
            {busy === "day-off" ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
          {/* Said here rather than discovered on payday: the shop pays by the day, so a day not
              worked is a day not paid — but เข้าสาย is a record only and never touches the wage. */}
          ร้านจ่ายเป็นรายวัน — เต็มวันและครึ่งวันจะถูกหักออกจากวันทำงานของเดือนนั้น ส่วน{" "}
          <b>เข้าสาย ไม่หักเงิน</b> บันทึกไว้เป็นประวัติเท่านั้น
        </p>
      </section>

      <section className="card">
        <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>วันหยุดของฉัน</h2>
        <p className="muted" style={{ fontSize: 13.5, margin: "0 0 14px" }}>
          {monthLabel(month)} · {summariseDaysOff(days).label}
        </p>
        <DayOffTable rows={days} busy={busy} onSave={saveDay} />
        <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
          กด <b>แก้ไข</b> แล้วแก้ในตารางได้เลย — ทั้งวันที่ ลาแบบ และเหตุผล · ลบไม่ได้
          ถ้าบันทึกผิดจนต้องลบจริง ๆ ให้แจ้งเจ้าของ
        </p>
      </section>

      {profile.dayRateSatang != null && (
        <section className="card">
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Salary</h2>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px,auto) 1fr",
              gap: "10px 16px",
              margin: 0,
            }}
          >
            <Row label="Day rate" value={`${baht(profile.dayRateSatang)} / day`} />
            <Row label="Paid" value="5th of each month" />
            <Row
              label="Bank"
              value={
                profile.bankAccountNo ? (
                  <>
                    {profile.bankName} ····{profile.bankAccountNo.slice(-4)}
                    {profile.bankAccountName && (
                      <span className="faint"> · {profile.bankAccountName}</span>
                    )}
                  </>
                ) : null
              }
            />
          </dl>
        </section>
      )}
    </div>
  );
}
