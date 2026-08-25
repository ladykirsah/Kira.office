"use client";

import { useCallback, useEffect, useState } from "react";
import { LEAVE_MODES, summariseDaysOff, type LeaveHalves } from "@l-shopee/core";
import { useToast } from "../ToastProvider";
import { DayOffTable, type DayOffEdit, type DayOffRow } from "../DayOffTable";
import { MonthYearPicker } from "../MonthYearPicker";
import { SecretRow } from "../settings/staff/[id]/SecretRow";
import { CopyButton } from "../products/CopyButton";
import { PaymentsTable, type StaffPayment } from "../settings/staff/[id]/PaymentsTable";
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
  /** Decrypted by the API, exactly like `password` — see ownProfile. */
  pin: string | null;
  hasPin: number;
  hasPassword: number;
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

export function MyProfile({
  profile,
  payments,
  month: currentMonth,
}: {
  profile: Profile;
  /** Every month, filtered by the ledger's own picker — the same shape the HRM page gets. */
  payments: StaffPayment[];
  /** The Bangkok month "now" falls in. The year comes from here, never from a UTC clock. */
  month: string;
}) {
  const toast = useToast();
  const [day, setDay] = useState("");
  const [halves, setHalves] = useState<LeaveHalves>(2);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const currentYear = Number(currentMonth.slice(0, 4)) || new Date().getFullYear();
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

  /**
   * Like `post`, but REPORTS whether it worked: SecretRow keeps its box open on a failure so the
   * value you typed is still there to correct.
   */
  async function save(path: string, body: unknown, okMessage: string): Promise<boolean> {
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
        return false;
      }
      toast(okMessage, "success");
      // The stored secret is only readable back FROM the server, so the page reloads rather than
      // guessing what it now holds.
      location.reload();
      return true;
    } catch {
      toast("Couldn't reach the server.", "error");
      return false;
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
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* THE HRM PAGE'S LAYOUT, applied here (owner, 2026-08-25) — two cards abreast, then วันหยุด,
          then the wage ledger, then Signing in. One page shape for both sides, so what the owner
          learns on the staff profile transfers straight to their own.

          THE ONE DIFFERENCE the owner asked for: there is no Record section here. On the owner's
          side Record is the single input point and the วันหยุด card only reads; here the submission
          form lives at the BOTTOM of the วันหยุด card instead — you look at the month first, then
          add to it, which is the order you actually do it in. */}
      <div className="profile-cols">
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
          <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>Pay</h2>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px,auto) 1fr",
              gap: "10px 16px",
              margin: 0,
            }}
          >
            <Row
              label="Day rate"
              value={profile.dayRateSatang != null ? `${baht(profile.dayRateSatang)} / day` : null}
            />
            <Row label="Paid" value="5th of each month" />
            {/* IN FULL, not masked (owner, 2026-08-25, asked directly). It is their own account and
                hiding it from them protects nobody — while showing it lets them check at a glance
                that the shop is paying into the right one. */}
            <Row
              label="Bank"
              value={
                profile.bankName || profile.bankAccountName || profile.bankAccountNo ? (
                  <div style={{ display: "grid", gap: 2 }}>
                    <span>{profile.bankName}</span>
                    <span>{profile.bankAccountName}</span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {profile.bankAccountNo}
                      {profile.bankAccountNo && (
                        <CopyButton value={profile.bankAccountNo} label="account number" />
                      )}
                    </span>
                  </div>
                ) : null
              }
            />
          </dl>
        </section>
      </div>

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
          {/* This card's own month, Thai names and พ.ศ. to match the heading beside it — the same
              control the owner's วันหยุด card carries. Local state rather than the URL: nothing on
              this page is server-rendered per month, so a refetch does the whole job without a
              navigation. */}
          <MonthYearPicker
            value={month}
            lang="th"
            label="เดือนของวันหยุด"
            currentYear={currentYear}
            onChange={setMonth}
          />
        </div>

        <DayOffTable rows={days} busy={busy} onSave={saveDay} />

        {/* The form sits UNDER the table (owner, 2026-08-25). It used to sit above it, which asked
            you to record a day before you could see which days you had already recorded. The three
            explanatory notes that stood here, above and below it were removed the same day — the
            owner's standing preference is that the control says what it does rather than a
            paragraph saying it for them. */}
        <hr className="field-divider" />
        {/* The same coral frame Record uses on the owner's side (owner, 2026-08-24): one look for
            "this is the bit you fill in and Save". There is no Record section on this page, so this
            form IS the input point and should read like one. */}
        <div
          className="fill-panel"
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}
        >
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
      </section>

      {/* The same ledger the owner reads, minus the account to pay INTO — that one belongs to
          whoever is making the transfer, and it is already in the Pay card above. */}
      <section className="card">
        <PaymentsTable userId={profile.id} payments={payments} currentYear={currentYear} />
      </section>

      <section className="card">
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Signing in</h2>

        {/* TWO THINGS PER SECRET, AND ONLY TWO (owner, 2026-08-25: "function here is messy · 2
            function requested here — view, change"). What was messy was a permanently open input
            box sitting under each secret: a form standing open when you are not filling anything in
            reads as a job left half done. The box now appears when you ask for it.

            This is the same SecretRow the owner's staff-profile page uses, which is the point — the
            card was the last one on this page still hand-rolled. */}
        <SecretRow
          label="Password"
          value={profile.password}
          hasValue={profile.hasPassword === 1}
          actionLabel="change"
          confirm
          onSave={async (next) => {
            // Checked HERE rather than by grey-ing out Save (owner, 2026-08-25): a dead button does
            // not say what is wrong with what you typed.
            if (next.trim().length < 8) {
              toast("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร", "error");
              return false;
            }
            return await save("password", { password: next.trim() }, "Password changed");
          }}
        />

        <SecretRow
          label="6-digit PIN"
          value={profile.pin}
          hasValue={profile.hasPin === 1}
          actionLabel="change"
          confirm
          inputMode="numeric"
          maxLength={6}
          onSave={async (next) => {
            if (!/^\d{6}$/.test(next)) {
              toast("PIN ต้องเป็นตัวเลข 6 หลัก", "error");
              return false;
            }
            return await save("pin", { pin: next }, "PIN set");
          }}
          hint="The PIN signs you in on its own — no email needed. Three wrong tries locks the account for 24 hours."
        />
      </section>
    </div>
  );
}
