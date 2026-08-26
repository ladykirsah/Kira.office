"use client";

import { useCallback, useEffect, useState } from "react";
import { LEAVE_MODES, summariseDaysOff, type LeaveHalves } from "@l-shopee/core";
import { useToast } from "../ToastProvider";
import { useT, useLang } from "../LangProvider";
import { DayOffTable, type DayOffEdit, type DayOffRow } from "../DayOffTable";
import { MonthYearPicker } from "../MonthYearPicker";
import { SecretRow } from "../settings/staff/[id]/SecretRow";
import { recoveryKeyProblem, RECOVERY_KEY_MIN } from "@l-shopee/core";
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
  /**
   * Whether an emergency key is set, and when — never the key. No readable copy of it is stored,
   * so there is nothing here to leak even if a screen asked.
   */
  hasRecoveryKey: number;
  recoverySetAt: number | null;
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
  const t = useT();
  const lang = useLang();
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
        toast(
          data.error ||
            t({
              th: "แก้ไขไม่สำเร็จ ลองใหม่อีกครั้ง",
              en: t({
                th: "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง",
                en: "That didn't work. Try again.",
              }),
            }),
          "error",
        );
        return;
      }
      toast(t({ th: "บันทึกแล้ว", en: "Saved" }), "success");
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
        toast(
          data.error ||
            t({ th: "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง", en: "That didn't work. Try again." }),
          "error",
        );
        return false;
      }
      toast(okMessage, "success");
      // The stored secret is only readable back FROM the server, so the page reloads rather than
      // guessing what it now holds.
      location.reload();
      return true;
    } catch {
      toast(t({ th: "ติดต่อเซิร์ฟเวอร์ไม่ได้", en: "Couldn't reach the server." }), "error");
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
        toast(
          data.error ||
            t({ th: "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง", en: "That didn't work. Try again." }),
          "error",
        );
        return;
      }
      toast(okMessage, "success");
      after();
    } catch {
      toast(t({ th: "ติดต่อเซิร์ฟเวอร์ไม่ได้", en: "Couldn't reach the server." }), "error");
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
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>
            {t({ th: "ข้อมูลของฉัน", en: "Your details" })}
          </h2>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px,auto) 1fr",
              gap: "10px 16px",
              margin: 0,
            }}
          >
            <Row label={t({ th: "ชื่อ (ภาษาไทย)", en: "Name (Thai)" })} value={profile.nameTh} />
            <Row
              label={t({ th: "ชื่อ (ภาษาอังกฤษ)", en: "Name (English)" })}
              value={profile.nameEn}
            />
            <Row label={t({ th: "อีเมล", en: "Email" })} value={profile.email} />
            <Row label={t({ th: "เบอร์โทร", en: "Phone" })} value={profile.phone} />
            <Row
              label={t({ th: "ผู้ติดต่อฉุกเฉิน", en: "Emergency contact" })}
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
            <Row
              label={t({ th: "เริ่มงาน", en: "Started" })}
              value={profile.startedOn ? thaiDate(profile.startedOn) : null}
            />
          </dl>
          <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0" }}>
            {t({ th: "ถ้าจะแก้ไข ให้บอกเจ้าของร้าน", en: "Ask the owner to change any of these." })}
          </p>
        </section>

        <section className="card">
          <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>{t({ th: "ค่าแรง", en: "Pay" })}</h2>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px,auto) 1fr",
              gap: "10px 16px",
              margin: 0,
            }}
          >
            <Row
              label={t({ th: "ค่าแรงต่อวัน", en: "Day rate" })}
              value={
                profile.dayRateSatang != null
                  ? t({
                      th: `${baht(profile.dayRateSatang)} / วัน`,
                      en: `${baht(profile.dayRateSatang)} / day`,
                    })
                  : null
              }
            />
            <Row
              label={t({ th: "จ่ายวันที่", en: "Paid" })}
              value={t({ th: "ทุกวันที่ 5 ของเดือน", en: "5th of each month" })}
            />
            {/* IN FULL, not masked (owner, 2026-08-25, asked directly). It is their own account and
                hiding it from them protects nobody — while showing it lets them check at a glance
                that the shop is paying into the right one. */}
            <Row
              label={t({ th: "ธนาคาร", en: "Bank" })}
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
            <h2 style={{ margin: "0 0 2px", fontSize: 16 }}>
              {t({ th: "วันหยุด", en: "Days off" })}
            </h2>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {monthLabel(month, lang)} · {summariseDaysOff(days, lang).label}
            </p>
          </div>
          {/* This card's own month, Thai names and พ.ศ. to match the heading beside it — the same
              control the owner's วันหยุด card carries. Local state rather than the URL: nothing on
              this page is server-rendered per month, so a refetch does the whole job without a
              navigation. */}
          <MonthYearPicker
            value={month}
            lang={lang}
            label={t({ th: "เดือนของวันหยุด", en: "Month of the day off" })}
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
              placeholder={t({ th: "เช่น พาแม่ไปหาหมอ", en: "e.g. taking mum to the doctor" })}
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
                t({ th: "บันทึกวันหยุดแล้ว", en: "Day off saved" }),
                () => {
                  setDay("");
                  setReason("");
                  void refreshDays();
                },
              )
            }
          >
            {busy === "day-off"
              ? t({ th: "กำลังบันทึก…", en: "Saving…" })
              : t({ th: "บันทึก", en: "Save" })}
          </button>
        </div>
      </section>

      {/* The same ledger the owner reads, minus the account to pay INTO — that one belongs to
          whoever is making the transfer, and it is already in the Pay card above. */}
      <section className="card">
        <PaymentsTable userId={profile.id} payments={payments} currentYear={currentYear} />
      </section>

      <section className="card">
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>
          {t({ th: "การเข้าใช้งาน", en: "Signing in" })}
        </h2>

        {/* TWO THINGS PER SECRET, AND ONLY TWO (owner, 2026-08-25: "function here is messy · 2
            function requested here — view, change"). What was messy was a permanently open input
            box sitting under each secret: a form standing open when you are not filling anything in
            reads as a job left half done. The box now appears when you ask for it.

            This is the same SecretRow the owner's staff-profile page uses, which is the point — the
            card was the last one on this page still hand-rolled. */}
        <SecretRow
          label={t({ th: "รหัสผ่าน", en: "Password" })}
          value={profile.password}
          hasValue={profile.hasPassword === 1}
          actionLabel={{ th: "เปลี่ยน", en: "change" }}
          confirm
          onSave={async (next) => {
            // Checked HERE rather than by grey-ing out Save (owner, 2026-08-25): a dead button does
            // not say what is wrong with what you typed.
            if (next.trim().length < 8) {
              toast(
                t({
                  th: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร",
                  en: "A password must be at least 8 characters.",
                }),
                "error",
              );
              return false;
            }
            return await save(
              "password",
              { password: next.trim() },
              t({ th: "เปลี่ยนรหัสผ่านแล้ว", en: "Password changed" }),
            );
          }}
        />

        <SecretRow
          label={t({ th: "รหัส 6 หลัก", en: "6-digit PIN" })}
          value={profile.pin}
          hasValue={profile.hasPin === 1}
          actionLabel={{ th: "เปลี่ยน", en: "change" }}
          confirm
          inputMode="numeric"
          maxLength={6}
          onSave={async (next) => {
            if (!/^\d{6}$/.test(next)) {
              toast(
                t({ th: "รหัสต้องเป็นตัวเลข 6 หลัก", en: "The PIN must be 6 digits." }),
                "error",
              );
              return false;
            }
            return await save(
              "pin",
              { pin: next },
              t({ th: "ตั้งรหัส 6 หลักแล้ว", en: "PIN set" }),
            );
          }}
          hint={t({
            th: "รหัส 6 หลักใช้เข้าใช้งานได้เลย ไม่ต้องใส่อีเมล · ใส่ผิด 3 ครั้ง บัญชีถูกล็อก 24 ชั่วโมง",
            en: "The PIN signs you in on its own — no email needed. Three wrong tries locks the account for 24 hours.",
          })}
        />

        {/*
          THE EMERGENCY KEY — the owner's alone (owner, 2026-08-26).

          A second way back in, standing beside the emailed Cloudflare code rather than replacing
          it, because the two fail differently: an emailed code is no use when the mailbox or
          Cloudflare is itself what is broken, which is the situation this guards against.

          Only drawn for the shop owner. The API refuses anyone else independently — this just
          keeps a control off screens where it would only mislead.
        */}
        {profile.role === "super_admin" && (
          <SecretRow
            label={t({ th: "กุญแจฉุกเฉิน", en: "Emergency key" })}
            /* No readable copy is kept, deliberately — so there is nothing to reveal, ever. */
            value={null}
            hasValue={profile.hasRecoveryKey === 1}
            actionLabel={{ th: "เปลี่ยน", en: "change" }}
            confirm
            onSave={async (next) => {
              const problem = recoveryKeyProblem(next);
              if (problem) {
                toast(
                  t({
                    th: `กุญแจต้องยาวอย่างน้อย ${RECOVERY_KEY_MIN} ตัวอักษร`,
                    en: problem,
                  }),
                  "error",
                );
                return false;
              }
              return await save(
                "recovery-key",
                { key: next.trim() },
                t({ th: "ตั้งกุญแจฉุกเฉินแล้ว", en: "Emergency key set" }),
              );
            }}
            hint={t({
              th: `ใช้เปิด "ทางเข้าฉุกเฉิน" ที่หน้าเข้าใช้งาน เมื่อรหัส 6 หลักและรหัสผ่านใช้ไม่ได้ · ตัวอักษร ตัวเลข หรือสัญลักษณ์ก็ได้ อย่างน้อย ${RECOVERY_KEY_MIN} ตัว · เก็บแบบอ่านย้อนหลังไม่ได้ ลืมแล้วต้องตั้งใหม่`,
              en: `Opens the emergency entrance on the sign-in screen when neither your PIN nor your password will. Letters, numbers or symbols, at least ${RECOVERY_KEY_MIN} of them. It is stored so that nobody can read it back — forget it and you set a new one.`,
            })}
          />
        )}
      </section>
    </div>
  );
}
