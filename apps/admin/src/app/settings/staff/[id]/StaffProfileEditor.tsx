"use client";

import { useState } from "react";
import { PageHeader } from "../../../PageHeader";
import { BackLink } from "../../../BackLink";
import { useToast } from "../../../ToastProvider";
import { CopyButton } from "../../../products/CopyButton";
import { SecretRow } from "./SecretRow";
import { PaymentsTable, type StaffPayment } from "./PaymentsTable";
import { StaffDaysOff } from "./StaffDaysOff";
import { RecordSection } from "./RecordSection";
import { useT } from "../../../LangProvider";
import type { DayOffRow } from "../../../DayOffTable";

export interface StaffProfile {
  id: string;
  name: string;
  nameTh: string | null;
  nameEn: string | null;
  email: string;
  role: string;
  status: string;
  phone: string | null;
  emergencyPhone: string | null;
  emergencyName: string | null;
  startedOn: number | null;
  dayRateSatang: number | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  lastLoginAt: number | null;
  lockedUntil: number | null;
  password: string | null;
  pin: string | null;
  hasPin: number;
  /** 1 when a password is set, whether or not it can be revealed. */
  hasPassword: number;
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  mechanic: "Mechanic",
};

// Same alphabet the API generates from — no I, l, 1, O or 0, because these get read out loud.
const PASSWORD_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generatePassword(): string {
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return [...bytes].map((n) => PASSWORD_ALPHABET[n % PASSWORD_ALPHABET.length]).join("");
}
/** Six digits, avoiding the ones the API refuses anyway (111111, 123456, …). */
function generatePin(): string {
  const banned = /^(\d)\1{5}$|^(012345|123456|234567|345678|456789|543210|654321|121212|112233)$/;
  for (;;) {
    const bytes = new Uint32Array(6);
    crypto.getRandomValues(bytes);
    const pin = [...bytes].map((n) => n % 10).join("");
    if (!banned.test(pin)) return pin;
  }
}

/** A date input wants 'YYYY-MM-DD'; the database holds milliseconds. */
const toDateInput = (ms: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : "");
const fromDateInput = (v: string) => (v ? Date.parse(`${v}T00:00:00Z`) : null);
const longDate = (ms: number | null) =>
  ms
    ? new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
const baht = (satang: number | null) =>
  satang == null ? null : `฿${(satang / 100).toLocaleString("en-US")} / day`;

/** An editable field: label above the control, optional hint below. */
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 160 }}>
      <label className="login-label">{label}</label>
      {children}
      {hint && (
        <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** The same field, read-only — a label and a value, not a disabled input pretending to be one. */
function Reading({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="muted">{label}</dt>
      <dd style={{ margin: 0 }}>{value || <span className="faint">—</span>}</dd>
    </>
  );
}

const readingList: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(140px, auto) 1fr",
  gap: "10px 16px",
  margin: 0,
};
const row: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 12,
};

/**
 * A staff profile, in the two modes the product page established: read-only by default, with one
 * Edit in the header that opens Details AND Pay together, and Cancel / Save to leave.
 *
 * The header lives in here rather than in the page because Save and Cancel need the form's state
 * next to them. The title, subtitle and back link are unchanged — only their owner moved.
 *
 * "Signing in" is deliberately outside all of this (owner, 2026-08-04): it has its own two-step
 * reset flow, and hiding a password behind an Edit would add a click to simply reading one out.
 */
export function StaffProfileEditor({
  profile,
  payments,
  month,
  days,
}: {
  profile: StaffProfile;
  payments: StaffPayment[];
  /** The month the Record section and the วันหยุด card are working in, from ?month= on the URL. */
  month: string;
  days: DayOffRow[];
}) {
  const toast = useToast();
  // The year the year-dropdowns offer, taken once here rather than inside each control, so nothing
  // on this page can disagree about what "this year" is mid-render.
  const t = useT();
  const currentYear = Number(month.slice(0, 4)) || new Date().getFullYear();
  const initial = {
    nameTh: profile.nameTh ?? "",
    nameEn: profile.nameEn ?? "",
    email: profile.email,
    phone: profile.phone ?? "",
    emergencyName: profile.emergencyName ?? "",
    emergencyPhone: profile.emergencyPhone ?? "",
    startedOn: toDateInput(profile.startedOn),
    dayRate: profile.dayRateSatang != null ? String(profile.dayRateSatang / 100) : "",
    bankName: profile.bankName ?? "",
    bankAccountNo: profile.bankAccountNo ?? "",
    bankAccountName: profile.bankAccountName ?? "",
  };
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function call(path: string, init: RequestInit, ok: string, reload = true) {
    setBusy(path);
    try {
      const res = await fetch(`/api/worker/staff/${path}`, { credentials: "include", ...init });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(data.error || "That didn't work.", "error");
        return false;
      }
      toast(ok, "success");
      if (reload) setTimeout(() => location.reload(), 600);
      return true;
    } catch {
      toast("Couldn't reach the server.", "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function cancel() {
    // Put every box back to what was loaded — Cancel means the visit never happened.
    setForm(initial);
    setEditing(false);
  }

  async function save() {
    const rate = form.dayRate.trim();
    // Baht in the box, satang in the database — the same split every other amount here uses.
    const dayRateSatang = rate === "" ? null : Math.round(Number(rate) * 100);
    if (dayRateSatang !== null && !Number.isFinite(dayRateSatang)) {
      toast("Day rate must be a number.", "error");
      return;
    }
    await call(
      `${profile.id}/profile`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nameTh: form.nameTh,
          nameEn: form.nameEn,
          email: form.email,
          phone: form.phone,
          emergencyName: form.emergencyName,
          emergencyPhone: form.emergencyPhone,
          startedOn: fromDateInput(form.startedOn),
          dayRateSatang,
          bankName: form.bankName,
          bankAccountNo: form.bankAccountNo,
          bankAccountName: form.bankAccountName,
        }),
      },
      "Saved",
    );
  }

  const locked = profile.lockedUntil !== null && profile.lockedUntil > Date.now();
  const saving = busy?.endsWith("/profile");

  return (
    <>
      <PageHeader
        title={profile.nameTh || profile.name}
        subtitle={`${ROLE_LABEL[profile.role] ?? profile.role}${
          profile.status === "active" ? "" : " · switched off"
        }`}
        below={<BackLink href="/settings/staff">Staff</BackLink>}
        action={
          editing ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
              <button type="button" onClick={cancel} disabled={!!saving}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={save} disabled={!!saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
              <button type="button" className="btn-primary" onClick={() => setEditing(true)}>
                Edit
              </button>
            </div>
          )
        }
      />

      {/* Full page width (owner, 2026-08-04) — the Payments table needs the room. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {locked && (
          <div className="salary-note">
            <strong>Locked until {new Date(profile.lockedUntil!).toLocaleString("en-GB")}.</strong>{" "}
            Three failed sign-ins in a row. Resetting their password below lets them straight back
            in.
          </div>
        )}

        {/* Details and Signing in share a row (owner, 2026-08-04). auto-fit means
            they stack on a narrow screen rather than squeezing. */}
        {/* Row 1 — who they are, and what they earn (owner, 2026-08-04). auto-fit means
            these stack rather than squeeze on a narrow screen. */}
        <div className="profile-cols">
          <section className="card">
            <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>
              {t({ th: "ข้อมูล", en: "Details" })}
            </h2>

            {editing ? (
              <>
                <div style={row}>
                  <Field label="ชื่อ (Thai name)">
                    <input value={form.nameTh} onChange={set("nameTh")} style={{ width: "100%" }} />
                  </Field>
                  <Field label="Name (English)">
                    <input value={form.nameEn} onChange={set("nameEn")} style={{ width: "100%" }} />
                  </Field>
                </div>
                <div style={row}>
                  <Field label="Email" hint="This is what they type to sign in.">
                    <input
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      style={{ width: "100%" }}
                    />
                  </Field>
                  <Field label="Phone">
                    <input value={form.phone} onChange={set("phone")} style={{ width: "100%" }} />
                  </Field>
                </div>
                {/* Started belongs with who they are, not with who to call in an emergency. */}
                <div style={row}>
                  <Field label="Started">
                    <input type="date" value={form.startedOn} onChange={set("startedOn")} />
                  </Field>
                </div>

                <hr className="field-divider" />

                <div style={{ ...row, marginBottom: 0 }}>
                  <Field label="Emergency contact — name">
                    <input
                      value={form.emergencyName}
                      onChange={set("emergencyName")}
                      style={{ width: "100%" }}
                    />
                  </Field>
                  <Field label="Emergency contact — phone">
                    <input
                      value={form.emergencyPhone}
                      onChange={set("emergencyPhone")}
                      style={{ width: "100%" }}
                    />
                  </Field>
                </div>
              </>
            ) : (
              <>
                <dl style={readingList}>
                  <Reading label="ชื่อ (Thai)" value={profile.nameTh} />
                  <Reading label="Name (English)" value={profile.nameEn} />
                  <Reading label="Email" value={profile.email} />
                  <Reading label="Phone" value={profile.phone} />
                  <Reading label="Started" value={longDate(profile.startedOn)} />
                </dl>

                <hr className="field-divider" />

                <dl style={readingList}>
                  <Reading
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
                </dl>
              </>
            )}
          </section>

          <section className="card">
            <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>{t({ th: "ค่าแรง", en: "Pay" })}</h2>

            {editing ? (
              <>
                <div style={row}>
                  <Field
                    label="Day rate (฿)"
                    hint="Salary = day rate × working days. Paid on the 5th."
                  >
                    <input
                      inputMode="decimal"
                      value={form.dayRate}
                      onChange={set("dayRate")}
                      style={{ width: "100%" }}
                    />
                  </Field>
                  <Field label="Bank">
                    <input
                      value={form.bankName}
                      onChange={set("bankName")}
                      style={{ width: "100%" }}
                    />
                  </Field>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Field label="Account number">
                    <input
                      value={form.bankAccountNo}
                      onChange={set("bankAccountNo")}
                      style={{ width: "100%" }}
                    />
                  </Field>
                  <Field label="Account name">
                    <input
                      value={form.bankAccountName}
                      onChange={set("bankAccountName")}
                      style={{ width: "100%" }}
                    />
                  </Field>
                </div>
              </>
            ) : (
              <dl style={readingList}>
                <Reading
                  label={t({ th: "ค่าแรงต่อวัน", en: "Day rate" })}
                  value={baht(profile.dayRateSatang)}
                />
                <Reading
                  label={t({ th: "จ่ายวันที่", en: "Paid" })}
                  value={t({ th: "ทุกวันที่ 5 ของเดือน", en: "5th of each month" })}
                />
                <Reading
                  label={t({ th: "ธนาคาร", en: "Bank" })}
                  value={
                    profile.bankName || profile.bankAccountName || profile.bankAccountNo ? (
                      /* Three lines, in the order you'd read them onto a transfer form. The account
                         number is shown in full: a masked number cannot be paid into, which is the
                         only reason this field exists. */
                      <div style={{ display: "grid", gap: 2 }}>
                        <span>{profile.bankName}</span>
                        <span>{profile.bankAccountName}</span>
                        {/* The number gets typed into a banking app, so it gets a copy button —
                            reading ten digits off a screen is where transfers go wrong. */}
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
            )}
          </section>
        </div>

        {/* Outside the Edit switch on purpose — see the note at the top of this file. */}
        {/* Record → what happened → what it came to. The page reads downwards as cause then
            effect (owner, 2026-08-24): a month's เต็มวัน and ครึ่งวัน are subtracted from its
            working days, and its advances come off the wage. */}
        <RecordSection
          userId={profile.id}
          payments={payments}
          currentYear={currentYear}
          defaultPeriod={month}
        />

        <StaffDaysOff userId={profile.id} month={month} days={days} currentYear={currentYear} />

        {/* Wages paid, and the transfer slip for each — on the person, not the salary run
            (owner, 2026-08-04). Outside the Edit flow: a payment record is history, not a field. */}
        {/* The heading lives inside PaymentsTable, so it can share a row with that table's own month
            picker — the same shape the วันหยุด card uses. */}
        <section className="card">
          <PaymentsTable
            userId={profile.id}
            payments={payments}
            currentYear={currentYear}
            /* The account to pay INTO, shown under the Total where you actually need it. Only the
               owner's HRM view passes this — /me is the person's own page and has no Total. */
            bank={{
              name: profile.bankName,
              accountNo: profile.bankAccountNo,
              accountName: profile.bankAccountName,
            }}
          />
        </section>

        <section className="card">
          <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>
            {t({ th: "การเข้าสู่ระบบ", en: "Signing in" })}
          </h2>

          <SecretRow
            label="Password"
            value={profile.password}
            hasValue={profile.hasPassword === 1}
            generate={generatePassword}
            onSave={(next) =>
              call(
                `${profile.id}/password`,
                {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ password: next }),
                },
                "Password reset — signed out everywhere, and any lock lifted",
              )
            }
          />

          <hr className="field-divider" />

          <SecretRow
            label="6-digit PIN"
            value={profile.pin}
            hasValue={profile.hasPin === 1}
            generate={generatePin}
            inputMode="numeric"
            maxLength={6}
            hint="Signs them in on its own, with no email. Resetting it signs them out everywhere."
            onSave={(next) =>
              call(
                `${profile.id}/pin`,
                {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ pin: next }),
                },
                "PIN reset — signed out everywhere",
              )
            }
          />
        </section>
      </div>
    </>
  );
}
