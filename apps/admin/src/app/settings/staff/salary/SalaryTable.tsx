"use client";

import type { CSSProperties } from "react";
import { Fragment, useState } from "react";
import Link from "next/link";
import { useToast } from "../../../ToastProvider";
import { CopyButton } from "../../../products/CopyButton";
import { useT, useLang } from "../../../LangProvider";
import { ROLE_LABEL } from "@/lib/roleLabel";
import type { Lang } from "@/lib/lang";
import { FilePickButton } from "../../../FilePickButton";

export interface SalaryRow {
  userId: string;
  name: string;
  role: "super_admin" | "admin" | "mechanic";
  dayRateSatang: number;
  offHalves: number;
  workingHalves: number;
  amountSatang: number;
  paidAt: number | null;
  /** Where the money goes — carried on the row so paying never needs a second screen. */
  bankName: string | null;
  bankAccountNo: string | null;
}

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("en-US")}`;
/** Halves as days: 58 → "29", 59 → "29½". Nobody wants to read 29.5 on a wage sheet. */
const days = (halves: number) => {
  const whole = Math.floor(halves / 2);
  return halves % 2 ? `${whole || ""}½` : String(whole);
};

function monthLabel(period: string, lang: Lang): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
function shift(period: string, by: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/** Wages for a month are paid on the 5th of the next one. */
function payDate(period: string, lang: Lang): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 5)).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** Written once: the `th` reads them wide, every `td` carries the matching one as `data-label`,
 *  which the phone prints beside the value once the table becomes cards. They cannot drift. */
const COLUMN = {
  person: { th: "พนักงาน", en: "Person" },
  dayRate: { th: "ค่าแรงต่อวัน", en: "Day rate" },
  daysOff: { th: "วันหยุด", en: "Days off" },
  workingDays: { th: "วันทำงาน", en: "Working days" },
  salary: { th: "เงินเดือน", en: "Salary" },
  actions: { th: "จัดการ", en: "Actions" },
};

export function SalaryTable({
  rows,
  period,
  daysInMonth,
}: {
  rows: SalaryRow[];
  period: string;
  daysInMonth: number;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  /** Whose pay panel is open. One at a time: paying is one person at a time. */
  const [paying, setPaying] = useState<string | null>(null);
  const [slip, setSlip] = useState<File | null>(null);
  const toast = useToast();
  const t = useT();
  const lang = useLang();

  function openPay(userId: string) {
    setPaying(userId);
    setSlip(null);
  }

  /**
   * Confirm the payment. The slip image IS the request body — the same shape the refund slips use
   * — and the API refuses to record the payment without one, so a paid month always has proof.
   */
  async function confirmPaid(row: SalaryRow) {
    if (!slip) return;
    setBusy(row.userId);
    try {
      const res = await fetch(
        `/api/worker/staff/${row.userId}/salary-paid?period=${encodeURIComponent(period)}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": slip.type || "image/jpeg" },
          body: slip,
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(
          data.error || t({ th: "บันทึกว่าจ่ายแล้วไม่สำเร็จ", en: "Couldn't mark that paid." }),
          "error",
        );
        return;
      }
      toast(`${row.name} marked paid`, "success");
      setTimeout(() => location.reload(), 500);
    } catch {
      toast(t({ th: "ติดต่อเซิร์ฟเวอร์ไม่ได้", en: "Couldn't reach the server." }), "error");
    } finally {
      setBusy(null);
    }
  }

  const total = rows.reduce((n, r) => n + r.amountSatang, 0);
  const unpaid = rows.filter((r) => r.paidAt === null).length;

  if (rows.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon" aria-hidden>
          💵
        </div>
        {t({
          th: "ยังไม่มีใครตั้งค่าแรงต่อวัน — ตั้งได้ที่ คนในร้าน → จัดการ → ตั้งค่าแรงต่อวัน",
          en: "Nobody has a day rate yet. Set one from People → Actions → Set day rate.",
        })}
      </div>
    );
  }

  // The locked list-table pattern (docs/DESIGN_SYSTEM.md): one framed section holds the toolbar
  // and the table. Here the toolbar is the month stepper — this list has exactly one control.
  return (
    <section className="card">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Bare icon buttons — no frame (owner's brief) — at 24px, which is target enough for a
            glyph sitting beside the month it moves. The class carries its own colour, so no inline
            override is needed to stop an <a> reading as a link. */}
        <Link
          className="icon-btn icon-btn-24"
          href={`?month=${shift(period, -1)}`}
          aria-label={t({ th: "เดือนก่อนหน้า", en: "Previous month" })}
        >
          ‹
        </Link>
        <span style={{ fontSize: 19, fontWeight: 700 }}>{monthLabel(period, lang)}</span>
        <Link
          className="icon-btn icon-btn-24"
          href={`?month=${shift(period, 1)}`}
          aria-label={t({ th: "เดือนถัดไป", en: "Next month" })}
        >
          ›
        </Link>
        <span className="muted" style={{ fontSize: 13.5 }}>
          {t({
            th: `เดือนนี้ ${daysInMonth} วัน · จ่ายวันที่ ${payDate(period, lang)}`,
            en: `${daysInMonth} days · pay date ${payDate(period, lang)}`,
          })}
        </span>
      </div>

      <div className="products-scroll list-cards-scroll">
        <table
          className="products-table list-cards"
          style={{ "--list-min-width": "780px" } as CSSProperties}
        >
          {/* Fixed widths for the figures, so the columns line up between months and between
              people instead of resizing around whatever this month's numbers happen to be. Person
              takes the slack; the min-width makes the table scroll rather than crush it. */}
          <colgroup>
            <col />
            <col style={{ width: 110 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 100 }} />
          </colgroup>
          <thead>
            <tr>
              <th>{t(COLUMN.person)}</th>
              <th style={{ textAlign: "right" }}>{t(COLUMN.dayRate)}</th>
              <th style={{ textAlign: "right" }}>{t(COLUMN.daysOff)}</th>
              <th style={{ textAlign: "right" }}>{t(COLUMN.workingDays)}</th>
              <th style={{ textAlign: "right" }}>{t(COLUMN.salary)}</th>
              <th style={{ textAlign: "right" }} aria-label={t(COLUMN.actions)} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.userId}>
                <tr>
                  <td>
                    {r.name} <span className="muted">· {t(ROLE_LABEL[r.role]!)}</span>
                  </td>
                  <td className="num" data-label={t(COLUMN.dayRate)}>
                    {baht(r.dayRateSatang)}
                  </td>
                  <td className="num" data-label={t(COLUMN.daysOff)}>
                    {r.offHalves ? days(r.offHalves) : "0"}
                  </td>
                  <td className="num" data-label={t(COLUMN.workingDays)}>
                    {days(r.workingHalves)}
                  </td>
                  <td className="num" data-label={t(COLUMN.salary)} style={{ fontWeight: 700 }}>
                    {baht(r.amountSatang)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {/* No slip link here (owner, 2026-08-04): this table answers "who do I still
                        owe this month". Slips live on the person's page, with their wage history. */}
                    {r.paidAt ? (
                      // The state, not the date (owner, 2026-08-04) — same pill as the person's
                      // own Payments table. When it was paid is on the slip.
                      <span className="role-pill" style={{ color: "var(--ok)" }}>
                        {t({ th: "จ่ายแล้ว", en: "Paid" })}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-soft"
                        disabled={paying === r.userId}
                        onClick={() => openPay(r.userId)}
                      >
                        {t({ th: "จ่าย", en: "Pay" })}
                      </button>
                    )}
                  </td>
                </tr>

                {/* The payment: where the money goes, and the slip, which must be attached before
                    it can be confirmed. The amount is not repeated here — it is on the row
                    directly above (owner, 2026-08-04). */}
                {paying === r.userId && (
                  <tr className="pay-drawer">
                    <td colSpan={6}>
                      <div className="pay-grid">
                        <div>
                          <div className="pay-label">{t({ th: "โอนเข้า", en: "Into" })}</div>
                          {r.bankAccountNo ? (
                            <div style={{ display: "grid", gap: 2, fontSize: 14 }}>
                              <span>{r.bankName}</span>
                              <span
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {r.bankAccountNo}
                                <CopyButton
                                  value={r.bankAccountNo}
                                  label={t({ th: "เลขที่บัญชี", en: "the account number" })}
                                />
                              </span>
                            </div>
                          ) : (
                            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                              {t({
                                th: "ยังไม่มีบัญชีธนาคาร — ไปเพิ่มที่หน้าโปรไฟล์ของเขาก่อน",
                                en: "No bank account yet — add one on their profile first.",
                              })}
                            </p>
                          )}
                        </div>

                        <div>
                          <div className="pay-label">
                            {t({ th: "สลิปการโอน", en: "Transfer slip" })}
                          </div>
                          <FilePickButton
                            file={slip}
                            onPick={setSlip}
                            label={t({
                              th: `สลิปการโอนของ ${r.name}`,
                              en: `Transfer slip for ${r.name}`,
                            })}
                            disabled={busy === r.userId}
                          />
                          <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
                            {t({
                              th: "เก็บไว้ 3 เดือน แล้วลบทิ้ง",
                              en: "Kept for 3 months, then deleted.",
                            })}
                          </p>
                        </div>

                        {/* S size (32px): these sit inside a table row, not in a page header —
                            `.btn-sm` is the size-only modifier, so Confirm keeps its coral. */}
                        <div className="pay-acts">
                          <button
                            type="button"
                            className="btn-sm"
                            onClick={() => setPaying(null)}
                            disabled={busy === r.userId}
                          >
                            {t({ th: "ยกเลิก", en: "Cancel" })}
                          </button>
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            disabled={!slip || busy === r.userId}
                            onClick={() => confirmPaid(r)}
                            title={
                              slip
                                ? undefined
                                : t({
                                    th: "แนบสลิปการโอนก่อน",
                                    en: "Attach the transfer slip first",
                                  })
                            }
                          >
                            {busy === r.userId
                              ? t({ th: "กำลังบันทึก…", en: "Saving…" })
                              : t({ th: "ยืนยันว่าจ่ายแล้ว", en: "Confirm paid" })}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            <tr className="salary-total">
              <td>{t({ th: "รวม", en: "Total" })}</td>
              <td />
              <td className="num" data-label={t(COLUMN.daysOff)}>
                {days(rows.reduce((n, r) => n + r.offHalves, 0)) || "0"}
              </td>
              <td className="num" data-label={t(COLUMN.workingDays)}>
                {days(rows.reduce((n, r) => n + r.workingHalves, 0))}
              </td>
              <td className="num" data-label={t(COLUMN.salary)}>
                {baht(total)}
              </td>
              <td className="num muted" style={{ fontWeight: 400 }}>
                {unpaid === 0
                  ? t({ th: "จ่ายครบแล้ว", en: "all paid" })
                  : t({ th: `ยังไม่จ่าย ${unpaid} คน`, en: `${unpaid} unpaid` })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
