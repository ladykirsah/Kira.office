"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LEAVE_MODES, type LeaveHalves, type PayMethod } from "@l-shopee/core";
import { useToast } from "../../../ToastProvider";
import { useT, useLang } from "../../../LangProvider";
import type { Phrase } from "@/lib/lang";
import { FilePickButton } from "../../../FilePickButton";
import type { StaffPayment } from "./PaymentsTable";
import { MonthYearPicker } from "../../../MonthYearPicker";

/**
 * "Record" — the one place you write anything down about a person (owner, 2026-08-24).
 *
 * Built on the car-fitment page's **Add new**, which the owner picked as the working flow: pick
 * what you are recording, fill it in, Save. Three things go in — วันหยุด, เบิกล่วงหน้า and
 * จ่ายเงินเดือน — and it replaces the add form that used to sit *underneath* the วันหยุด table,
 * where you had to scroll past the data to reach the input.
 *
 * WHAT MARKS MONEY OUT, AND WHAT DOES NOT. Car brands and car models are the same kind of thing, so
 * equal tabs are honest there. A day off and a cash advance are not: one is attendance, the other is
 * money leaving the shop, and given no distinction at all they would earn equal weight and equal
 * muscle memory. Two things carry that distinction now:
 *
 *   · a divider in the tab row, and a panel behind the two money forms;
 *   · the Save button ALWAYS ENDS WITH THE AMOUNT — `บันทึกการเบิก ฿3,000`, never a bare "Save".
 *
 * The second is the one that does the work, and it is the one that survived. Four colour treatments
 * were tried and removed by the owner on 2026-08-24 — a เงิน label on the divider, amber tabs, a ⚠
 * line above the form, and finally the amber panel and amber button — each of them restating what
 * the button already says in words. Everything is the house coral now. Worth remembering before
 * reaching for a colour again: the number in the label is the safeguard.
 *
 * The slip rule is the API's (`payoutProblem` in core): cash needs nothing, a transfer needs its
 * slip. This mirrors it for the person filling the form — the field appears, and Save stays
 * disabled — but the refusal that matters happens on the server either way.
 */

type Tab = "off" | "advance" | "salary";

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("en-US")}`;
/** "1,250.50" → 125050. Commas and spaces tolerated, because people type money the way they say it. */
const toSatang = (thb: string): number =>
  Math.round((parseFloat(thb.replace(/[, ]/g, "")) || 0) * 100);

const label: Record<Tab, Phrase> = {
  off: { th: "วันหยุด", en: "Day off" },
  advance: { th: "เบิกล่วงหน้า", en: "Advance" },
  salary: { th: "จ่ายเงินเดือน", en: "Salary payment" },
};

function Field({
  label: text,
  children,
  wide,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div style={{ display: "grid", minWidth: 0, ...(wide ? { gridColumn: "1 / -1" } : {}) }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{text}</span>
      {children}
    </div>
  );
}

export function RecordSection({
  userId,
  payments,
  currentYear,
  defaultPeriod,
}: {
  userId: string;
  /**
   * Every month's figures, so the จ่ายเงินเดือน tab can state what is due for whichever month is
   * chosen — and refuse one already paid.
   */
  payments: StaffPayment[];
  currentYear: number;
  /** The month จ่ายเงินเดือน opens on. The other two tabs derive theirs from the date typed. */
  defaultPeriod: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const lang = useLang();
  const [tab, setTab] = useState<Tab>("off");
  const [busy, setBusy] = useState(false);

  // วันหยุด
  const [day, setDay] = useState("");
  const [halves, setHalves] = useState<LeaveHalves>(2);
  const [reason, setReason] = useState("");

  // shared by both money tabs
  const [method, setMethod] = useState<PayMethod>("cash");
  const [slip, setSlip] = useState<File | null>(null);

  // เบิกล่วงหน้า
  const [givenOn, setGivenOn] = useState("");
  const [amountThb, setAmountThb] = useState("");
  const [note, setNote] = useState("");

  // จ่ายเงินเดือน — the month being paid FOR, which is not the day it is paid: August's wage is
  // handed over on 5 September. This is the one tab that still needs a month chooser; the other two
  // take theirs from the date field they already have (owner, 2026-08-24).
  const [payPeriod, setPayPeriod] = useState(defaultPeriod);
  const [paidOn, setPaidOn] = useState("");

  const isMoney = tab !== "off";
  const amountSatang = toSatang(amountThb);
  const slipMissing = method === "transfer" && !slip;

  /** An advance belongs to the month it was handed over in — read straight off its own date box. */
  const advancePeriod = givenOn.length >= 7 ? givenOn.slice(0, 7) : "";
  const payRow = payments.find((p) => p.period === payPeriod);
  const dueSatang = payRow?.dueSatang ?? 0;
  const payMonthIsPaid = payRow?.paidAt != null;
  // Only the month being paid can be already-paid; an advance is blocked by ITS month's state.
  const advanceMonthIsPaid =
    !!advancePeriod && payments.find((p) => p.period === advancePeriod)?.paidAt != null;

  function resetAll() {
    setDay("");
    setHalves(2);
    setReason("");
    setGivenOn("");
    setAmountThb("");
    setNote("");
    setPaidOn("");
    setPayPeriod(defaultPeriod);
    setMethod("cash");
    setSlip(null);
  }

  async function send(url: string, init: RequestInit, ok: string) {
    setBusy(true);
    try {
      const res = await fetch(url, { credentials: "include", ...init });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(data.error || t({ th: "ทำรายการไม่สำเร็จ", en: "That didn't work." }), "error");
        return;
      }
      toast(ok, "success");
      resetAll();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const canSave =
    !busy &&
    (tab === "off"
      ? !!day
      : tab === "advance"
        ? !!givenOn && amountSatang > 0 && !slipMissing && !advanceMonthIsPaid
        : !!paidOn && !!payPeriod && !slipMissing && !payMonthIsPaid);

  const saveText =
    tab === "off"
      ? t({ th: "บันทึกวันหยุด", en: "Save the day off" })
      : tab === "advance"
        ? t({
            th: `บันทึกการเบิก ${baht(amountSatang)}`,
            en: `Save the ${baht(amountSatang)} advance`,
          })
        : t({ th: `บันทึกการจ่าย ${baht(dueSatang)}`, en: `Save the ${baht(dueSatang)} payment` });

  function submit() {
    if (tab === "off") {
      void send(
        `/api/worker/staff/${userId}/day-off`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ day, halves, reason: reason || undefined }),
        },
        t({ th: "บันทึกวันหยุดแล้ว", en: "Day off saved" }),
      );
      return;
    }
    if (tab === "advance") {
      // The slip travels as JSON here rather than a raw body, because the advance carries other
      // fields with it. A wage payment has no such fields, so that one keeps the raw-image shape
      // the route already had.
      const post = async () => {
        const slipKey = slip ? await uploadSlip(userId, advancePeriod, slip) : null;
        if (slip && !slipKey) {
          toast(t({ th: "อัปโหลดสลิปไม่สำเร็จ", en: "The slip didn't upload." }), "error");
          return;
        }
        await send(
          `/api/worker/staff/${userId}/advances`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              period: advancePeriod,
              givenOn,
              amountSatang,
              method,
              slipKey,
              note: note || undefined,
            }),
          },
          t({ th: "บันทึกการเบิกแล้ว", en: "Advance saved" }),
        );
      };
      setBusy(true);
      void post().finally(() => setBusy(false));
      return;
    }
    // จ่ายเงินเดือน — the slip IS the body for a transfer; cash sends none at all.
    const qs = new URLSearchParams({ period: payPeriod, method, paidOn });
    void send(
      `/api/worker/staff/${userId}/salary-paid?${qs}`,
      slip
        ? { method: "POST", headers: { "content-type": slip.type }, body: slip }
        : { method: "POST" },
      t({ th: "บันทึกการจ่ายแล้ว", en: "Payment saved" }),
    );
  }

  // Field for field, the same grid Add new uses on the car-fitment page. `.record-fields` gives the
  // controls inside it that page's SMALL size; the admin default is the larger 40px one.
  const fields = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
    gap: 12,
  } as const;

  const methodSwitch = (
    <>
      <Field label={t({ th: "จ่ายด้วย", en: "Paid by" })}>
        <div className="pay-method">
          {(["cash", "transfer"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={method === m ? "on" : ""}
              onClick={() => {
                setMethod(m);
                if (m === "cash") setSlip(null);
              }}
            >
              {m === "cash" ? t({ th: "เงินสด", en: "Cash" }) : t({ th: "โอน", en: "Transfer" })}
            </button>
          ))}
        </div>
      </Field>
      {method === "transfer" && (
        <Field
          label={
            <>
              {t({ th: "สลิป", en: "Slip" })} <b>{t({ th: "(ต้องแนบ)", en: "(required)" })}</b>
            </>
          }
        >
          <FilePickButton
            file={slip}
            onPick={setSlip}
            label={t({ th: "สลิปการโอน", en: "Transfer slip" })}
          />
        </Field>
      )}
    </>
  );

  return (
    <section className="card">
      <div style={{ fontWeight: 600, marginBottom: 12 }}>
        {t({ th: "เพิ่มรายการต่างๆ", en: "Record" })}
      </div>

      <div className="record-tabs">
        {(["off", "advance", "salary"] as const).map((key, i) => (
          <span key={key} style={{ display: "contents" }}>
            {/* The line the owner asked for: time on one side, money on the other. */}
            {i === 1 && <span className="record-rule" aria-hidden />}
            <button
              type="button"
              className={`record-tab${key !== "off" ? " money" : ""}${tab === key ? " on" : ""}`}
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
            >
              {t(label[key])}
            </button>
          </span>
        ))}
      </div>

      <div className={isMoney ? "fill-panel" : undefined}>
        {tab === "off" && (
          <div className="record-fields" style={fields}>
            <Field label={t({ th: "วันที่", en: "Date" })}>
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <Field label={t({ th: "ลาแบบ", en: "Kind of leave" })}>
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
            </Field>
            <Field
              label={
                <>
                  {t({ th: "เหตุผล", en: "Reason" })}{" "}
                  <span className="muted">{t({ th: "(ไม่บังคับ)", en: "(optional)" })}</span>
                </>
              }
            >
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t({ th: "เช่น พาแม่ไปหาหมอ", en: "e.g. taking mum to the doctor" })}
              />
            </Field>
          </div>
        )}

        {tab === "advance" && (
          <div className="record-fields" style={fields}>
            <Field label={t({ th: "วันที่", en: "Date" })}>
              <input type="date" value={givenOn} onChange={(e) => setGivenOn(e.target.value)} />
            </Field>
            <Field label={t({ th: "จำนวน (บาท)", en: "Amount (฿)" })}>
              <input
                inputMode="decimal"
                value={amountThb}
                onChange={(e) => setAmountThb(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            {methodSwitch}
            <Field
              label={
                <>
                  {t({ th: "หมายเหตุ", en: "Note" })}{" "}
                  <span className="muted">{t({ th: "(ไม่บังคับ)", en: "(optional)" })}</span>
                </>
              }
            >
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t({
                  th: "เช่น ขอเบิกก่อนเปิดเทอม",
                  en: "e.g. before the school term starts",
                })}
              />
            </Field>
          </div>
        )}

        {tab === "salary" && (
          <div className="record-fields" style={fields}>
            <Field label={t({ th: "เดือนที่จ่าย", en: "For the month of" })}>
              <MonthYearPicker
                value={payPeriod}
                lang={lang}
                label={t({ th: "เดือนที่จ่าย", en: "For the month of" })}
                currentYear={currentYear}
                onChange={setPayPeriod}
              />
            </Field>
            <Field label={t({ th: "วันที่จ่าย", en: "Paid on" })}>
              <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </Field>
            <Field label={t({ th: "ยอดจ่าย", en: "Amount due" })}>
              <input value={baht(dueSatang)} readOnly />
            </Field>
            {methodSwitch}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <button type="button" className="btn-primary btn-sm" disabled={!canSave} onClick={submit}>
          {busy ? t({ th: "กำลังบันทึก…", en: "Saving…" }) : saveText}
        </button>
      </div>

      <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0" }}>
        {tab === "off" ? (
          <>
            {t({
              th: "เต็มวันและครึ่งวันหักจากวันทำงานของเดือนนั้น ส่วน ",
              en: "Full and half days come off that month's working days. ",
            })}
            <b>{t({ th: "เข้าสาย ไม่หักเงิน", en: "Arriving late costs nothing." })}</b>
          </>
        ) : (tab === "advance" ? advanceMonthIsPaid : payMonthIsPaid) ? (
          <>
            {t({ th: "เดือนนี้จ่ายไปแล้ว — ", en: "This month is already paid — " })}
            <b>{t({ th: "บันทึกเพิ่มไม่ได้", en: "nothing more can be recorded" })}</b>
            {t({
              th: " เพราะสลิปที่ออกไปแล้วจะไม่ตรงกัน",
              en: ", because the slip already handed over would no longer match.",
            })}
          </>
        ) : method === "transfer" ? (
          <>
            {t({ th: "โอน — ", en: "Transfer — " })}
            <b>{t({ th: "ต้องแนบสลิป", en: "the slip is required" })}</b>
            {t({ th: " ถึงจะบันทึกได้", en: " before this can be saved." })}
          </>
        ) : (
          <>{t({ th: "เงินสด — ไม่ต้องแนบสลิป", en: "Cash — no slip needed." })}</>
        )}
      </p>
    </section>
  );
}

/**
 * Put a slip in R2 and hand back its key.
 *
 * Advances need this as a separate step because the record itself is JSON with several fields; the
 * wage payment has none, so that route keeps taking the image as its raw body. Returns null on
 * failure so the caller can refuse to write a record that would claim a slip it does not have.
 */
async function uploadSlip(userId: string, period: string, file: File): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/worker/staff/${userId}/advance-slip?period=${encodeURIComponent(period)}`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": file.type },
        body: file,
      },
    );
    if (!res.ok) return null;
    return ((await res.json()) as { key?: string }).key ?? null;
  } catch {
    return null;
  }
}
